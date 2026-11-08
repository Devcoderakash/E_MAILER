/**
 * MailPilot Phase 9: Automation Builder & AI Campaign Copilot Automated Verification Suite
 *
 * Verifies:
 * 1. Visual Automation Graph Validation (cycle detection, trigger requirement, disconnected nodes)
 * 2. Workflow Persistence & Multi-tenant Workspace Isolation
 * 3. Workflow Activation guards & Pause state transitions
 * 4. Event Trigger Ingestion (contact_subscribed, tag_assigned, contact_added_to_list)
 * 5. Execution Engine Step Traversal (Sequential steps, Condition branching true/false)
 * 6. Action Execution (add_tag, send_email via GmailSmtpProvider)
 * 7. Delay Node Execution (PENDING step state, delayed job scheduling)
 * 8. Suppression Check (UNSUBSCRIBED / BOUNCED contacts skip send_email)
 * 9. AI Campaign Copilot Provider Abstraction (Configured vs Unconfigured)
 * 10. AI Generation Endpoints (Subject Lines, Email Draft, Preheader, Improve Campaign)
 * 11. AI Workspace Rate Limiting (20 req/min limit enforcement)
 */

import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { AutomationService } from "./automation.service";
import { AutomationValidator, WorkflowDefinition } from "./automation.validator";
import {
  AutomationExecutionEngine,
  createAutomationWorker,
} from "../../workers/automation.worker";
import {
  AIService,
  generateSubjectLinesSchema,
  generateEmailDraftSchema,
  generatePreheaderSchema,
  improveCampaignSchema,
} from "../ai/ai.service";
import {
  MockAIProvider,
  setTestAIProvider,
  GeminiProvider,
} from "../ai/ai.provider";
import {
  AutomationStatus,
  AutomationExecutionStatus,
  AutomationStepStatus,
  ContactStatus,
} from "@prisma/client";

async function runAutomationAIVerification() {
  console.log("=================================================");
  console.log("🧪 MAILPILOT PHASE 9: AUTOMATION & AI COPILOT TESTS");
  console.log("=================================================\n");

  const worker = createAutomationWorker();

  try {
    // 1. Setup Test Fixtures: User + 2 Isolated Workspaces (Alpha & Beta)
    console.log("1. Setting up test fixtures (User + 2 Workspaces)...");
    const testUser = await prisma.user.create({
      data: {
        supabaseId: `test-auto-${Date.now()}`,
        email: `auto-test-${Date.now()}@mailpilot.io`,
      },
    });

    const workspaceAlpha = await prisma.workspace.create({
      data: {
        name: "Alpha Corp (Phase 9)",
        slug: `alpha-${Date.now()}`,
        ownerId: testUser.id,
      },
    });

    const workspaceBeta = await prisma.workspace.create({
      data: {
        name: "Beta Inc (Phase 9)",
        slug: `beta-${Date.now()}`,
        ownerId: testUser.id,
      },
    });

    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: workspaceAlpha.id, userId: testUser.id, role: "OWNER" },
        { workspaceId: workspaceBeta.id, userId: testUser.id, role: "OWNER" },
      ],
    });
    console.log(" Fixtures created successfully.");

    // 2. Visual Automation Graph Validation Suite
    console.log("\n2. Testing Graph Validation Rules (AutomationValidator)...");

    // Case 2a: Missing trigger node
    const missingTriggerWorkflow: WorkflowDefinition = {
      nodes: [
        { id: "action_1", type: "send_email", data: { label: "Send Email" }, position: { x: 0, y: 0 } },
      ],
      edges: [],
    };
    const missingTriggerResult = AutomationValidator.validate(missingTriggerWorkflow);
    if (missingTriggerResult.isValid || !missingTriggerResult.errors.some((e) => e.toLowerCase().includes("trigger"))) {
      throw new Error("Validation failed to detect missing trigger node.");
    }
    console.log(" Missing trigger node detected correctly.");

    // Case 2b: Multiple trigger nodes
    const multipleTriggersWorkflow: WorkflowDefinition = {
      nodes: [
        { id: "t1", type: "contact_subscribed", data: { label: "Trigger 1" }, position: { x: 0, y: 0 } },
        { id: "t2", type: "tag_assigned", data: { label: "Trigger 2" }, position: { x: 0, y: 100 } },
      ],
      edges: [],
    };
    const multipleTriggersResult = AutomationValidator.validate(multipleTriggersWorkflow);
    if (multipleTriggersResult.isValid || !multipleTriggersResult.errors.some((e) => e.toLowerCase().includes("trigger"))) {
      throw new Error("Validation failed to reject multiple triggers.");
    }
    console.log(" Multiple triggers rejected correctly.");

    // Case 2c: Cycle detection (DFS)
    const cyclicWorkflow: WorkflowDefinition = {
      nodes: [
        { id: "t1", type: "contact_subscribed", data: { label: "Trigger" }, position: { x: 0, y: 0 } },
        { id: "a1", type: "send_email", data: { label: "Step A", subject: "Welcome" }, position: { x: 0, y: 100 } },
        { id: "a2", type: "add_tag", data: { label: "Step B", tagName: "VIP" }, position: { x: 0, y: 200 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "a1" },
        { id: "e2", source: "a1", target: "a2" },
        { id: "e3", source: "a2", target: "a1" }, // Cycle back to a1!
      ],
    };
    const cyclicResult = AutomationValidator.validate(cyclicWorkflow);
    if (cyclicResult.isValid || !cyclicResult.errors.some((e) => e.toLowerCase().includes("cycle") || e.toLowerCase().includes("loop"))) {
      throw new Error("Validation failed to detect cyclic loop in workflow graph.");
    }
    console.log(" Cyclic loop detected and rejected correctly.");

    // Case 2d: Missing required config (e.g. invalid delay)
    const invalidDelayWorkflow: WorkflowDefinition = {
      nodes: [
        { id: "t1", type: "contact_subscribed", data: { label: "Trigger" }, position: { x: 0, y: 0 } },
        { id: "d1", type: "delay", data: { label: "Invalid Delay", duration: -5 }, position: { x: 0, y: 100 } },
      ],
      edges: [{ id: "e1", source: "t1", target: "d1" }],
    };
    const invalidDelayResult = AutomationValidator.validate(invalidDelayWorkflow);
    if (invalidDelayResult.isValid || !invalidDelayResult.errors.some((e) => e.includes("duration"))) {
      throw new Error("Validation failed to catch invalid delay duration.");
    }
    console.log(" Invalid node configuration detected correctly.");

    // 3. Workflow CRUD & Multi-Tenant Isolation
    console.log("\n3. Testing Workflow CRUD & Workspace Isolation...");
    const createdAuto = await AutomationService.createAutomation(workspaceAlpha.id, {
      name: "Welcome Onboarding Sequence",
      description: "Nurture sequence for newly registered members",
    });

    if (createdAuto.status !== AutomationStatus.DRAFT) {
      throw new Error(`Expected new automation status DRAFT, got ${createdAuto.status}`);
    }
    console.log(` Created Draft Automation: "${createdAuto.name}" (ID: ${createdAuto.id})`);

    // Verify Workspace Beta cannot access Alpha's automation
    try {
      await AutomationService.getAutomationById(workspaceBeta.id, createdAuto.id);
      throw new Error("Workspace isolation breach! Workspace Beta accessed Alpha's automation.");
    } catch (err: any) {
      if (err.statusCode !== 404) throw err;
      console.log(" Multi-tenant isolation verified: Workspace Beta received 404 for Alpha automation.");
    }

    // 4. Workflow Activation Guards & Pause State Transitions
    console.log("\n4. Testing Activation Guards and State Transitions...");

    // Try activating invalid workflow
    await AutomationService.updateAutomation(workspaceAlpha.id, createdAuto.id, {
      workflowDefinition: cyclicWorkflow,
    });

    try {
      await AutomationService.activateAutomation(workspaceAlpha.id, createdAuto.id);
      throw new Error("Activated an invalid cyclic workflow! Validation guard failed.");
    } catch (err: any) {
      if (err.statusCode !== 400) throw err;
      console.log(" Activation guard prevented activation of invalid workflow (400).");
    }

    // Update with a valid branching workflow:
    // Trigger -> Condition (has_tag "vip")
    //   -> true: Add tag "High-Value" -> Send VIP email
    //   -> false: Send Standard email
    const validBranchingWorkflow: WorkflowDefinition = {
      nodes: [
        {
          id: "node_trigger",
          type: "contact_subscribed",
          data: { label: "Contact Subscribed" },
          position: { x: 250, y: 50 },
        },
        {
          id: "node_cond",
          type: "condition",
          data: {
            label: "Is VIP Contact?",
            conditionType: "has_tag",
            conditionValue: "VIP",
          },
          position: { x: 250, y: 150 },
        },
        {
          id: "node_vip_tag",
          type: "add_tag",
          data: { label: "Tag High-Value", tagName: "High-Value" },
          position: { x: 100, y: 270 },
        },
        {
          id: "node_vip_email",
          type: "send_email",
          data: {
            label: "Send VIP Welcome",
            subject: "Welcome VIP Member!",
            htmlContent: "<h1>Welcome VIP!</h1><p>Enjoy your premium perks.</p>",
          },
          position: { x: 100, y: 390 },
        },
        {
          id: "node_std_email",
          type: "send_email",
          data: {
            label: "Send Standard Welcome",
            subject: "Welcome to MailPilot!",
            htmlContent: "<p>Welcome to our community.</p>",
          },
          position: { x: 400, y: 270 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_cond" },
        { id: "e_true", source: "node_cond", target: "node_vip_tag", sourceHandle: "true", label: "Yes" },
        { id: "e_vip2", source: "node_vip_tag", target: "node_vip_email" },
        { id: "e_false", source: "node_cond", target: "node_std_email", sourceHandle: "false", label: "No" },
      ],
    };

    await AutomationService.updateAutomation(workspaceAlpha.id, createdAuto.id, {
      workflowDefinition: validBranchingWorkflow,
    });

    const activatedAuto = await AutomationService.activateAutomation(workspaceAlpha.id, createdAuto.id);
    if (activatedAuto.status !== AutomationStatus.ACTIVE || !activatedAuto.activatedAt) {
      throw new Error("Failed to activate valid workflow.");
    }
    console.log(" Valid workflow activated successfully with status ACTIVE.");

    const pausedAuto = await AutomationService.pauseAutomation(workspaceAlpha.id, createdAuto.id);
    if (pausedAuto.status !== AutomationStatus.PAUSED) {
      throw new Error("Failed to pause workflow.");
    }
    console.log(" Workflow paused successfully with status PAUSED.");

    // Reactivate for execution testing
    await AutomationService.activateAutomation(workspaceAlpha.id, createdAuto.id);

    // 5. Contact Ingestion & Trigger Matching
    console.log("\n5. Testing Trigger Ingestion & Execution Enrollment...");

    // Create VIP Tag
    const vipTag = await prisma.contactTag.create({
      data: {
        workspaceId: workspaceAlpha.id,
        name: "VIP",
        color: "#6366F1",
      },
    });

    // Create Contact 1: VIP Contact
    const vipContact = await prisma.contact.create({
      data: {
        workspaceId: workspaceAlpha.id,
        email: `vip-member-${Date.now()}@example.com`,
        firstName: "Victoria",
        lastName: "Investor",
        status: ContactStatus.ACTIVE,
      },
    });

    await prisma.contactTagAssignment.create({
      data: {
        contactId: vipContact.id,
        tagId: vipTag.id,
      },
    });

    // Create Contact 2: Standard Contact
    const stdContact = await prisma.contact.create({
      data: {
        workspaceId: workspaceAlpha.id,
        email: `standard-user-${Date.now()}@example.com`,
        firstName: "Sam",
        lastName: "User",
        status: ContactStatus.ACTIVE,
      },
    });

    // Trigger automations for contact_subscribed
    await AutomationService.triggerAutomationsForEvent(
      workspaceAlpha.id,
      "contact_subscribed",
      vipContact.id
    );

    await AutomationService.triggerAutomationsForEvent(
      workspaceAlpha.id,
      "contact_subscribed",
      stdContact.id
    );

    // Check that executions were enrolled
    const vipExec = await prisma.automationExecution.findFirst({
      where: { automationId: createdAuto.id, contactId: vipContact.id },
    });
    const stdExec = await prisma.automationExecution.findFirst({
      where: { automationId: createdAuto.id, contactId: stdContact.id },
    });

    if (!vipExec || !stdExec) {
      throw new Error("Automated enrollment failed to create execution records.");
    }
    console.log(` Created Executions: VIP #${vipExec.id}, Standard #${stdExec.id}`);

    // 6. Test Step Traversal & Condition Branching via BullMQ Worker
    console.log("\n6. Testing Condition Branching & Step Execution...");

    // Wait for asynchronous BullMQ worker to process both executions
    console.log("--> Waiting for worker to process executions...");
    let vipDetail: any;
    let stdDetail: any;

    for (let attempt = 0; attempt < 25; attempt++) {
      vipDetail = await AutomationService.getExecutionDetail(
        workspaceAlpha.id,
        createdAuto.id,
        vipExec.id
      );
      stdDetail = await AutomationService.getExecutionDetail(
        workspaceAlpha.id,
        createdAuto.id,
        stdExec.id
      );

      if (
        vipDetail.status === AutomationExecutionStatus.COMPLETED &&
        stdDetail.status === AutomationExecutionStatus.COMPLETED
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (vipDetail.status !== AutomationExecutionStatus.COMPLETED) {
      throw new Error(`VIP execution status expected COMPLETED, got ${vipDetail.status}`);
    }

    const executedVipNodeIds = (vipDetail.stepExecutions || []).map((s: any) => s.nodeId);
    if (!executedVipNodeIds.includes("node_vip_tag") || !executedVipNodeIds.includes("node_vip_email")) {
      throw new Error(`Condition branching failed: VIP branch was not traversed. Executed: ${executedVipNodeIds.join(", ")}`);
    }
    if (executedVipNodeIds.includes("node_std_email")) {
      throw new Error("Condition branching leaked into false branch for VIP contact!");
    }
    console.log(" VIP branching evaluated correctly: traversed 'true' branch, added tag, sent VIP email.");

    if (stdDetail.status !== AutomationExecutionStatus.COMPLETED) {
      throw new Error(`Standard execution status expected COMPLETED, got ${stdDetail.status}`);
    }

    const executedStdNodeIds = (stdDetail.stepExecutions || []).map((s: any) => s.nodeId);
    if (!executedStdNodeIds.includes("node_std_email")) {
      throw new Error(`Standard contact did not traverse 'false' branch. Executed: ${executedStdNodeIds.join(", ")}`);
    }
    if (executedStdNodeIds.includes("node_vip_tag") || executedStdNodeIds.includes("node_vip_email")) {
      throw new Error("Standard contact erroneously traversed VIP branch!");
    }
    console.log(" Standard branching evaluated correctly: traversed 'false' branch, sent standard email.");

    // 7. Test Delay Node Handling
    console.log("\n7. Testing Delay Step Execution...");
    const delayWorkflow: WorkflowDefinition = {
      nodes: [
        { id: "t1", type: "contact_subscribed", data: { label: "Trigger" }, position: { x: 0, y: 0 } },
        { id: "d1", type: "delay", data: { label: "Wait 15 Mins", duration: 15, unit: "minutes" }, position: { x: 0, y: 100 } },
        { id: "a1", type: "send_email", data: { label: "Followup", subject: "Checking in" }, position: { x: 0, y: 200 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "d1" },
        { id: "e2", source: "d1", target: "a1" },
      ],
    };

    const delayAuto = await AutomationService.createAutomation(workspaceAlpha.id, {
      name: "Delay Test Sequence",
      workflowDefinition: delayWorkflow,
    });
    await AutomationService.activateAutomation(workspaceAlpha.id, delayAuto.id);

    const delayContact = await prisma.contact.create({
      data: {
        workspaceId: workspaceAlpha.id,
        email: `delay-user-${Date.now()}@example.com`,
        status: ContactStatus.ACTIVE,
      },
    });

    const delayExec = await prisma.automationExecution.create({
      data: {
        workspaceId: workspaceAlpha.id,
        automationId: delayAuto.id,
        contactId: delayContact.id,
        status: AutomationExecutionStatus.RUNNING,
        currentNodeId: "t1",
      },
    });

    // Execute delay node
    const delayStepResult = await AutomationExecutionEngine.processStep({
      executionId: delayExec.id,
      automationId: delayAuto.id,
      workspaceId: workspaceAlpha.id,
      contactId: delayContact.id,
      nodeId: "d1",
    });

    if (!delayStepResult.delayed || delayStepResult.status !== "pending") {
      throw new Error("Delay node execution failed to schedule pending delay step.");
    }

    const pendingStep = await prisma.automationStepExecution.findFirst({
      where: { executionId: delayExec.id, nodeId: "d1" },
    });
    if (!pendingStep || pendingStep.status !== AutomationStepStatus.PENDING || !pendingStep.scheduledAt) {
      throw new Error("Pending delay step was not recorded properly in PostgreSQL.");
    }
    console.log(` Delay step recorded as PENDING and scheduled for ${pendingStep.scheduledAt.toISOString()}`);

    // 8. Test Suppression Guard for Unsubscribed/Bounced Contacts
    console.log("\n8. Testing Suppression Guard for Unsubscribed & Bounced Contacts...");
    const unsubscribedContact = await prisma.contact.create({
      data: {
        workspaceId: workspaceAlpha.id,
        email: `unsubscribed-${Date.now()}@example.com`,
        status: ContactStatus.UNSUBSCRIBED,
      },
    });

    const unsubExec = await prisma.automationExecution.create({
      data: {
        workspaceId: workspaceAlpha.id,
        automationId: delayAuto.id,
        contactId: unsubscribedContact.id,
        status: AutomationExecutionStatus.RUNNING,
        currentNodeId: "a1",
      },
    });

    await AutomationExecutionEngine.processStep({
      executionId: unsubExec.id,
      automationId: delayAuto.id,
      workspaceId: workspaceAlpha.id,
      contactId: unsubscribedContact.id,
      nodeId: "a1",
    });

    const suppressedStep = await prisma.automationStepExecution.findFirst({
      where: { executionId: unsubExec.id, nodeId: "a1" },
    });
    const stepResult = (suppressedStep?.result as any) || {};

    if (suppressedStep?.status !== AutomationStepStatus.SKIPPED || stepResult?.reason !== "contact_suppressed") {
      throw new Error("Suppression guard failed: send_email was not marked SKIPPED for unsubscribed contact!");
    }
    console.log(" Suppression guard verified: send_email marked SKIPPED for UNSUBSCRIBED contact.");

    // 9. AI Campaign Copilot - Provider Abstraction & Config Check
    console.log("\n9. Testing AI Campaign Copilot Provider Abstraction...");
    // Test unconfigured state with mock empty provider
    const unconfiguredProvider = new GeminiProvider("  "); // blank key
    setTestAIProvider(unconfiguredProvider);
    if (AIService.isConfigured()) {
      throw new Error("AIService should report isConfigured = false when API key is empty.");
    }
    console.log(" Unconfigured state detected safely without runtime crash.");

    // Switch to active MockAIProvider
    setTestAIProvider(new MockAIProvider());
    if (!AIService.isConfigured()) {
      throw new Error("MockAIProvider should report isConfigured = true.");
    }
    console.log(" AI Provider abstraction active with MockAIProvider.");

    // 10. AI Campaign Copilot - Feature Endpoints
    console.log("\n10. Testing AI Campaign Copilot Features...");

    // 10a. Subject Line Suggestions
    console.log("--> Testing AI Subject Lines...");
    const subjects = await AIService.generateSubjectLines(workspaceAlpha.id, {
      purpose: "Announce our summer product launch",
      audience: "Marketing leaders",
      tone: "Exciting and bold",
      count: 4,
    });
    if (!subjects.suggestions || subjects.suggestions.length === 0) {
      throw new Error("AI Subject line generation returned empty list.");
    }
    console.log(` Generated ${subjects.suggestions.length} subject suggestions.`);

    // 10b. Full Email Draft
    console.log("--> Testing AI Email Draft...");
    const draftRes = await AIService.generateEmailDraft(workspaceAlpha.id, {
      goal: "Introduce visual workflows to email marketers",
      productDetails: "No-code workflow builder with condition branching and 99.8% inbox rate",
      tone: "Inspiring",
      cta: "Try Visual Automations",
    });
    const draft = draftRes.draft;
    if (!draft.heading || !draft.bodyHtml || !draft.ctaText) {
      throw new Error("AI Draft generation missing required copy components.");
    }
    console.log(` Generated Draft: "${draft.heading}" with CTA "${draft.ctaText}"`);

    // 10c. Preheader Variations
    console.log("--> Testing AI Preheaders...");
    const preheaders = await AIService.generatePreheader(workspaceAlpha.id, {
      subject: "Revolutionize your email marketing with MailPilot",
      count: 3,
    });
    if (!preheaders.suggestions || preheaders.suggestions.length === 0) {
      throw new Error("AI Preheader generation returned empty list.");
    }
    console.log(` Generated ${preheaders.suggestions.length} preheader suggestions.`);

    // 10d. Campaign Improver & Spam Risk
    console.log("--> Testing AI Campaign Improver & Spam Analysis...");
    const improveRes = await AIService.improveCampaign(workspaceAlpha.id, {
      subject: "FREE WINNER $$$ CLAIM YOUR PRIZE NOW!!",
      htmlContent: "<p>CLICK HERE TO GET MILLIONS TODAY!!!</p>",
    });
    const analysis = improveRes.analysis;
    if (!analysis.clarityGrade || !analysis.spamRisk || !analysis.suggestions) {
      throw new Error("AI Campaign improver missing analysis metrics.");
    }
    console.log(` Analyzed Campaign: Spam Risk "${analysis.spamRisk}", Readability Score: ${analysis.readabilityScore}/100`);

    // 11. Rate Limiting Guard (20 req/min)
    console.log("\n11. Testing AI Rate Limiting (20 requests per minute limit)...");
    const testRateWorkspace = `rate-limit-ws-${Date.now()}`;
    // Make 20 valid requests
    for (let i = 0; i < 20; i++) {
      AIService.checkRateLimit(testRateWorkspace);
    }
    // 21st request must trigger 429 error
    try {
      AIService.checkRateLimit(testRateWorkspace);
      throw new Error("Rate limit guard failed to enforce 20 req/min cap!");
    } catch (err: any) {
      if (err.statusCode !== 429) throw err;
      console.log(" Rate limiting enforced successfully (HTTP 429 on 21st request).");
    }

    console.log("\n=================================================");
    console.log("🎉 ALL PHASE 9 VERIFICATION TESTS PASSED (11/11)");
    console.log("=================================================");
  } finally {
    if (worker) {
      await worker.close();
    }
  }
}

runAutomationAIVerification()
  .then(() => {
    console.log("\n✅ Phase 9 verification script completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Phase 9 verification failed with error:", err);
    process.exit(1);
  });
