import { Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { prisma } from "../config/database";
import {
  AUTOMATION_QUEUE_NAME,
  AutomationJobData,
  addStepAutomationJob,
} from "../queues/automation.queue";
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from "../modules/automations/automation.validator";
import { GmailSmtpProvider } from "../providers";
import {
  AutomationStatus,
  AutomationExecutionStatus,
  AutomationStepStatus,
  ContactStatus,
} from "@prisma/client";

export class AutomationExecutionEngine {
  /**
   * Process a single node step within an automation execution
   */
  static async executeStep(
    jobData: AutomationJobData
  ): Promise<{ status: string; nodeId?: string; delayed?: boolean; skipped?: boolean; reason?: string }> {
    const { executionId, automationId, contactId, workspaceId } = jobData;

    // 1. Fetch Execution and Contact
    const execution = await prisma.automationExecution.findUnique({
      where: { id: executionId },
      include: {
        automation: true,
        contact: {
          include: {
            tagAssignments: { include: { tag: true } },
            listMemberships: true,
          },
        },
      },
    });

    if (!execution) {
      console.warn(`[AutomationWorker] Execution #${executionId} not found. Skipping.`);
      return { status: "not_found" };
    }

    if (
      execution.status === AutomationExecutionStatus.COMPLETED ||
      execution.status === AutomationExecutionStatus.CANCELLED ||
      execution.status === AutomationExecutionStatus.FAILED
    ) {
      console.log(`[AutomationWorker] Execution #${executionId} is already ${execution.status}.`);
      return { status: execution.status };
    }

    if (execution.automation.status !== AutomationStatus.ACTIVE) {
      console.log(`[AutomationWorker] Automation #${automationId} is not ACTIVE (${execution.automation.status}). Halting execution.`);
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          status: AutomationExecutionStatus.CANCELLED,
          errorMessage: "Automation is not active",
          completedAt: new Date(),
        },
      });
      return { status: "cancelled" };
    }

    const contact = execution.contact;
    const workflow = execution.automation.workflowDefinition as unknown as WorkflowDefinition;
    const { nodes = [], edges = [] } = workflow;

    // Determine target node to execute
    let currentNodeId = jobData.nodeId || execution.currentNodeId;

    if (!currentNodeId) {
      // Starting from trigger node
      const triggerNode = nodes.find(
        (n) =>
          n.type.startsWith("trigger") ||
          ["contact_subscribed", "contact_added_to_list", "tag_assigned", "contact_birthday"].includes(n.type)
      );

      if (!triggerNode) {
        throw new Error("No trigger node found in workflow definition.");
      }

      // Record trigger step completion
      await this.recordStep(executionId, triggerNode.id, triggerNode.type, AutomationStepStatus.COMPLETED, {
        triggeredAt: new Date().toISOString(),
      });

      // Find next node from trigger
      const firstEdge = edges.find((e) => e.source === triggerNode.id);
      if (!firstEdge) {
        // No actions follow trigger
        await prisma.automationExecution.update({
          where: { id: executionId },
          data: {
            status: AutomationExecutionStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
        return { status: "completed" };
      }

      currentNodeId = firstEdge.target;
    }

    // Step-by-step traversal loop (synchronous until delay or end)
    let activeNodeId: string | undefined = currentNodeId;

    while (activeNodeId) {
      const node = nodes.find((n) => n.id === activeNodeId);
      if (!node) {
        console.warn(`[AutomationWorker] Node #${activeNodeId} not found in definition.`);
        break;
      }

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { currentNodeId: activeNodeId },
      });

      console.log(`[AutomationWorker] Executing node #${node.id} (${node.type}) for contact ${contact.email}`);

      // Handle Delay Node: Schedule delayed job and halt synchronous loop
      if (node.type === "delay") {
        const duration = Number(node.data?.duration) || 1;
        const unit = (node.data?.unit || "minutes").toLowerCase();
        let delayMs = duration * 60 * 1000;
        if (unit.startsWith("hour")) delayMs = duration * 3600 * 1000;
        if (unit.startsWith("day")) delayMs = duration * 86400 * 1000;

        const scheduledAt = new Date(Date.now() + delayMs);

        await this.recordStep(
          executionId,
          node.id,
          node.type,
          AutomationStepStatus.PENDING,
          {
            delayMs,
            scheduledResumeAt: scheduledAt.toISOString(),
          },
          null,
          scheduledAt
        );

        // Find outgoing edge
        const nextEdge = edges.find((e) => e.source === node.id);
        if (nextEdge) {
          console.log(`[AutomationWorker] Scheduling delay of ${delayMs}ms before node #${nextEdge.target}`);
          await addStepAutomationJob(
            {
              executionId,
              automationId,
              contactId,
              workspaceId,
              nodeId: nextEdge.target,
            },
            delayMs
          );
        } else {
          // Delay was last node
          await prisma.automationExecution.update({
            where: { id: executionId },
            data: {
              status: AutomationExecutionStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
        }

        return { status: "pending", delayed: true, nodeId: node.id };
      }

      // Handle Condition Node: Evaluate logic and select branch
      if (node.type === "condition") {
        const conditionMet = this.evaluateCondition(node, contact);

        await this.recordStep(executionId, node.id, node.type, AutomationStepStatus.COMPLETED, {
          conditionMet,
          conditionType: node.data?.conditionType,
        });

        // Branching: match edge sourceHandle
        const branchHandle = conditionMet ? "true" : "false";
        const branchEdge = edges.find(
          (e) =>
            e.source === node.id &&
            (e.sourceHandle === branchHandle ||
              e.sourceHandle === (conditionMet ? "yes" : "no") ||
              (!e.sourceHandle && conditionMet))
        );

        activeNodeId = branchEdge ? branchEdge.target : undefined;
        continue;
      }

      // Handle Action Nodes
      try {
        const actionResult = await this.executeActionNode(node, contact, workspaceId);

        await this.recordStep(
          executionId,
          node.id,
          node.type,
          actionResult.skipped ? AutomationStepStatus.SKIPPED : AutomationStepStatus.COMPLETED,
          actionResult
        );
      } catch (err: any) {
        console.error(`[AutomationWorker] Action node #${node.id} failed:`, err.message);

        await this.recordStep(
          executionId,
          node.id,
          node.type,
          AutomationStepStatus.FAILED,
          null,
          err.message
        );

        await prisma.automationExecution.update({
          where: { id: executionId },
          data: {
            status: AutomationExecutionStatus.FAILED,
            errorMessage: err.message,
            completedAt: new Date(),
          },
        });

        throw err;
      }

      // Find next sequential edge
      const nextEdge = edges.find((e) => e.source === node.id);
      activeNodeId = nextEdge ? nextEdge.target : undefined;
    }

    // Workflow reached termination
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: AutomationExecutionStatus.COMPLETED,
        completedAt: new Date(),
        currentNodeId: null,
      },
    });

    console.log(`[AutomationWorker] Execution #${executionId} completed successfully.`);
    return { status: "completed" };
  }

  /**
   * Helper to execute Action Nodes
   */
  private static async executeActionNode(
    node: WorkflowNode,
    contact: any,
    workspaceId: string
  ): Promise<any> {
    const data = node.data || {};

    switch (node.type) {
      case "send_email": {
        // Suppression check: Do not send to unsubscribed or bounced contacts
        if (contact.status === ContactStatus.UNSUBSCRIBED || contact.status === ContactStatus.BOUNCED) {
          console.log(`[AutomationWorker] Suppressed send_email for ${contact.email} (Status: ${contact.status})`);
          return { skipped: true, reason: "contact_suppressed", contactStatus: contact.status };
        }

        const subject = data.subject || "Important update from MailPilot";
        const htmlContent = data.htmlContent || `<p>Hello ${contact.firstName || "there"},</p><p>This is an automated workflow message.</p>`;
        const fromName = data.fromName || "MailPilot Automations";
        const fromEmail = data.fromEmail || "automations@mailpilot.io";

        const res = await GmailSmtpProvider.send({
          to: contact.email,
          subject,
          html: htmlContent,
          fromName,
          fromEmail,
          workspaceId,
        });

        return {
          sent: true,
          messageId: res.messageId,
          to: contact.email,
          subject,
        };
      }

      case "add_tag": {
        let tagId = data.tagId;
        if (!tagId && data.tagName) {
          const tag = await prisma.contactTag.upsert({
            where: {
              workspaceId_name: {
                workspaceId,
                name: data.tagName.trim(),
              },
            },
            update: {},
            create: {
              workspaceId,
              name: data.tagName.trim(),
              color: "#4f46e5",
            },
          });
          tagId = tag.id;
        }

        if (tagId) {
          await prisma.contactTagAssignment.upsert({
            where: {
              contactId_tagId: {
                contactId: contact.id,
                tagId,
              },
            },
            update: {},
            create: {
              contactId: contact.id,
              tagId,
            },
          });
        }
        return { tagAdded: true, tagId };
      }

      case "remove_tag": {
        if (data.tagId) {
          await prisma.contactTagAssignment.deleteMany({
            where: {
              contactId: contact.id,
              tagId: data.tagId,
            },
          });
        }
        return { tagRemoved: true, tagId: data.tagId };
      }

      case "add_to_list": {
        if (data.listId) {
          await prisma.contactListMember.upsert({
            where: {
              contactId_listId: {
                contactId: contact.id,
                listId: data.listId,
              },
            },
            update: {},
            create: {
              contactId: contact.id,
              listId: data.listId,
            },
          });
        }
        return { listAdded: true, listId: data.listId };
      }

      case "remove_from_list": {
        if (data.listId) {
          await prisma.contactListMember.deleteMany({
            where: {
              contactId: contact.id,
              listId: data.listId,
            },
          });
        }
        return { listRemoved: true, listId: data.listId };
      }

      default:
        return { executed: true, nodeType: node.type };
    }
  }

  /**
   * Helper to evaluate Condition Nodes
   */
  private static evaluateCondition(node: WorkflowNode, contact: any): boolean {
    const data = node.data || {};
    const conditionType = data.conditionType;
    const value = String(data.value || data.conditionValue || data.tagName || data.tagId || "").toLowerCase().trim();

    switch (conditionType) {
      case "has_tag": {
        const tagTokens: string[] = (contact.tagAssignments || []).flatMap((ta: any) => [
          ta.tagId?.toLowerCase(),
          ta.tag?.name?.toLowerCase(),
          ta.tag?.id?.toLowerCase(),
        ].filter(Boolean));
        return tagTokens.includes(value);
      }

      case "in_list": {
        const listTokens: string[] = (contact.listMemberships || []).flatMap((lm: any) => [
          lm.listId?.toLowerCase(),
          lm.list?.name?.toLowerCase(),
        ].filter(Boolean));
        return listTokens.includes(value);
      }

      case "domain_matches": {
        return contact.email.toLowerCase().endsWith(value);
      }

      default:
        return false;
    }
  }

  /**
   * Alias for executeStep
   */
  static processStep = AutomationExecutionEngine.executeStep;

  /**
   * Helper to record Step Executions idempotently
   */
  private static async recordStep(
    executionId: string,
    nodeId: string,
    nodeType: string,
    status: AutomationStepStatus,
    result: any = null,
    errorMessage: string | null = null,
    scheduledAt: Date | null = null
  ) {
    return prisma.automationStepExecution.create({
      data: {
        executionId,
        nodeId,
        nodeType,
        status,
        result: result as any,
        errorMessage,
        scheduledAt,
        completedAt: status === AutomationStepStatus.COMPLETED ? new Date() : null,
      },
    });
  }
}

/**
 * Creates and initializes the BullMQ Automation Worker
 */
export function createAutomationWorker(): Worker<AutomationJobData> {
  const worker = new Worker<AutomationJobData>(
    AUTOMATION_QUEUE_NAME,
    async (job: Job<AutomationJobData>) => {
      console.log(`[AutomationWorker] Processing automation job #${job.id} (${job.name})`);
      return AutomationExecutionEngine.executeStep(job.data);
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[AutomationWorker] Job #${job.id} completed.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[AutomationWorker] Job #${job?.id} failed:`, err.message);
  });

  return worker;
}
