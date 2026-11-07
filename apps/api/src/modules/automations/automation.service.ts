import { prisma } from "../../config/database";
import {
  AutomationValidator,
  WorkflowDefinition,
} from "./automation.validator";
import {
  addStartAutomationJob,
} from "../../queues/automation.queue";
import {
  AutomationStatus,
  AutomationExecutionStatus,
} from "@prisma/client";

export interface CreateAutomationDTO {
  name: string;
  description?: string;
  triggerType?: string;
  workflowDefinition?: WorkflowDefinition;
}

export interface UpdateAutomationDTO {
  name?: string;
  description?: string;
  triggerType?: string;
  workflowDefinition?: WorkflowDefinition;
}

export class AutomationService {
  /**
   * Default starter workflow definition
   */
  static getDefaultWorkflow(): WorkflowDefinition {
    return {
      nodes: [
        {
          id: "trigger_1",
          type: "contact_subscribed",
          data: { label: "Contact Subscribed" },
          position: { x: 250, y: 50 },
        },
        {
          id: "delay_1",
          type: "delay",
          data: { label: "Wait 1 Hour", duration: 1, unit: "hours" },
          position: { x: 250, y: 180 },
        },
        {
          id: "action_1",
          type: "send_email",
          data: {
            label: "Send Welcome Email",
            subject: "Welcome to our community!",
            htmlContent: "<p>Welcome aboard! We are excited to have you.</p>",
          },
          position: { x: 250, y: 310 },
        },
      ],
      edges: [
        { id: "e1", source: "trigger_1", target: "delay_1" },
        { id: "e2", source: "delay_1", target: "action_1" },
      ],
    };
  }

  /**
   * List automations in workspace
   */
  static async getAutomations(
    workspaceId: string,
    params?: { status?: string; search?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };
    if (params?.status && params.status !== "all") {
      where.status = params.status.toUpperCase();
    }
    if (params?.search?.trim()) {
      where.OR = [
        { name: { contains: params.search.trim(), mode: "insensitive" } },
        { description: { contains: params.search.trim(), mode: "insensitive" } },
      ];
    }

    const [total, automations] = await Promise.all([
      prisma.automation.count({ where }),
      prisma.automation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: { executions: true },
          },
        },
      }),
    ]);

    // Attach completed execution counts
    const items = await Promise.all(
      automations.map(async (auto) => {
        const completedCount = await prisma.automationExecution.count({
          where: {
            automationId: auto.id,
            status: AutomationExecutionStatus.COMPLETED,
          },
        });

        const workflow = auto.workflowDefinition as unknown as WorkflowDefinition;
        const stepCount = (workflow?.nodes || []).filter((n) => !n.type.startsWith("trigger")).length;

        return {
          id: auto.id,
          name: auto.name,
          description: auto.description,
          status: auto.status,
          triggerType: auto.triggerType,
          stepCount,
          totalEnrolled: auto._count.executions,
          completedCount,
          createdAt: auto.createdAt.toISOString(),
          updatedAt: auto.updatedAt.toISOString(),
          activatedAt: auto.activatedAt?.toISOString() || null,
        };
      })
    );

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single automation by ID
   */
  static async getAutomationById(workspaceId: string, id: string) {
    const automation = await prisma.automation.findFirst({
      where: { id, workspaceId },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });

    if (!automation) {
      const err: any = new Error("Automation not found");
      err.statusCode = 404;
      throw err;
    }

    return automation;
  }

  /**
   * Create a new automation
   */
  static async createAutomation(workspaceId: string, data: CreateAutomationDTO) {
    const workflow = data.workflowDefinition || this.getDefaultWorkflow();
    const triggerNode = workflow.nodes?.find(
      (n) =>
        n.type.startsWith("trigger") ||
        ["contact_subscribed", "contact_added_to_list", "tag_assigned", "contact_birthday"].includes(n.type)
    );

    const triggerType = data.triggerType || triggerNode?.type || "contact_subscribed";

    return prisma.automation.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        status: AutomationStatus.DRAFT,
        triggerType,
        workflowDefinition: workflow as any,
      },
    });
  }

  /**
   * Update automation
   */
  static async updateAutomation(
    workspaceId: string,
    id: string,
    data: UpdateAutomationDTO
  ) {
    await this.getAutomationById(workspaceId, id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
    if (data.workflowDefinition !== undefined) {
      updateData.workflowDefinition = data.workflowDefinition;
      // Auto-update triggerType from trigger node if present
      const triggerNode = data.workflowDefinition.nodes?.find(
        (n) =>
          n.type.startsWith("trigger") ||
          ["contact_subscribed", "contact_added_to_list", "tag_assigned", "contact_birthday"].includes(n.type)
      );
      if (triggerNode) {
        updateData.triggerType = triggerNode.type;
      }
    }

    return prisma.automation.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete automation
   */
  static async deleteAutomation(workspaceId: string, id: string) {
    await this.getAutomationById(workspaceId, id);

    await prisma.automation.delete({
      where: { id },
    });

    return { id, deleted: true };
  }

  /**
   * Validate workflow definition
   */
  static async validateWorkflow(workspaceId: string, id: string) {
    const automation = await this.getAutomationById(workspaceId, id);
    const workflow = automation.workflowDefinition as unknown as WorkflowDefinition;
    return AutomationValidator.validate(workflow);
  }

  /**
   * Activate automation workflow
   */
  static async activateAutomation(workspaceId: string, id: string) {
    const automation = await this.getAutomationById(workspaceId, id);
    const workflow = automation.workflowDefinition as unknown as WorkflowDefinition;

    const validation = AutomationValidator.validate(workflow);
    if (!validation.isValid) {
      const err: any = new Error(
        `Cannot activate invalid workflow: ${validation.errors.join("; ")}`
      );
      err.statusCode = 400;
      err.errors = validation.errors;
      throw err;
    }

    const triggerType = validation.triggerNode?.type || automation.triggerType;

    return prisma.automation.update({
      where: { id },
      data: {
        status: AutomationStatus.ACTIVE,
        triggerType,
        activatedAt: new Date(),
      },
    });
  }

  /**
   * Pause automation
   */
  static async pauseAutomation(workspaceId: string, id: string) {
    await this.getAutomationById(workspaceId, id);

    return prisma.automation.update({
      where: { id },
      data: {
        status: AutomationStatus.PAUSED,
      },
    });
  }

  /**
   * Get execution runs for an automation
   */
  static async getExecutions(
    workspaceId: string,
    automationId: string,
    params?: { page?: number; limit?: number; status?: string }
  ) {
    await this.getAutomationById(workspaceId, automationId);

    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { automationId, workspaceId };
    if (params?.status && params.status !== "all") {
      where.status = params.status.toUpperCase();
    }

    const [total, executions] = await Promise.all([
      prisma.automationExecution.count({ where }),
      prisma.automationExecution.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        include: {
          contact: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: {
            select: { stepExecutions: true },
          },
        },
      }),
    ]);

    return {
      items: executions.map((e) => ({
        id: e.id,
        status: e.status,
        contact: e.contact,
        currentNodeId: e.currentNodeId,
        stepCount: e._count.stepExecutions,
        startedAt: e.startedAt.toISOString(),
        completedAt: e.completedAt?.toISOString() || null,
        errorMessage: e.errorMessage,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get detailed execution run with step timeline
   */
  static async getExecutionDetail(
    workspaceId: string,
    automationId: string,
    executionId: string
  ) {
    await this.getAutomationById(workspaceId, automationId);

    const execution = await prisma.automationExecution.findFirst({
      where: { id: executionId, automationId, workspaceId },
      include: {
        contact: {
          select: { id: true, email: true, firstName: true, lastName: true, status: true },
        },
        stepExecutions: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!execution) {
      const err: any = new Error("Automation execution not found");
      err.statusCode = 404;
      throw err;
    }

    return execution;
  }

  /**
   * Ingest and trigger automations for contact events
   */
  static async triggerAutomationsForEvent(
    workspaceId: string,
    triggerType: string,
    contactId: string,
    payload: { listId?: string; tagId?: string; [key: string]: any } = {}
  ): Promise<{ triggeredCount: number; executionIds: string[] }> {
    // Only ACTIVE automations execute
    const activeAutomations = await prisma.automation.findMany({
      where: {
        workspaceId,
        status: AutomationStatus.ACTIVE,
        triggerType,
      },
    });

    if (activeAutomations.length === 0) {
      return { triggeredCount: 0, executionIds: [] };
    }

    const executionIds: string[] = [];

    for (const auto of activeAutomations) {
      const workflow = auto.workflowDefinition as unknown as WorkflowDefinition;
      const triggerNode = workflow.nodes?.find(
        (n) => n.type === triggerType || n.type.startsWith("trigger")
      );

      // Verify node specific conditions (e.g. specific listId or tagId)
      if (triggerType === "contact_added_to_list" && triggerNode?.data?.listId) {
        if (triggerNode.data.listId !== payload.listId) continue;
      }

      if (triggerType === "tag_assigned" && triggerNode?.data?.tagId) {
        if (triggerNode.data.tagId !== payload.tagId) continue;
      }

      // Check for active running execution to prevent duplicate loop
      const existingRunning = await prisma.automationExecution.findFirst({
        where: {
          automationId: auto.id,
          contactId,
          status: AutomationExecutionStatus.RUNNING,
        },
      });

      if (existingRunning) {
        console.log(`[AutomationService] Contact ${contactId} already running in automation ${auto.id}. Skipping duplicate.`);
        continue;
      }

      // Create new Execution
      const execution = await prisma.automationExecution.create({
        data: {
          workspaceId,
          automationId: auto.id,
          contactId,
          status: AutomationExecutionStatus.RUNNING,
          contextData: payload as any,
        },
      });

      executionIds.push(execution.id);

      // Dispatch async BullMQ start job
      await addStartAutomationJob({
        executionId: execution.id,
        automationId: auto.id,
        contactId,
        workspaceId,
      });

      console.log(`[AutomationService] Enqueued automation execution #${execution.id} (${auto.name}) for contact ${contactId}`);
    }

    return {
      triggeredCount: executionIds.length,
      executionIds,
    };
  }
}
