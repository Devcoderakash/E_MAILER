import { GeminiProvider, MockAIProvider, setTestAIProvider } from "./ai.provider";
import { AIService } from "./ai.service";
import { AutomationValidator } from "../automations/automation.validator";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${details ? ` - ${details}` : ""}`);
    failed++;
  }
}

async function run() {
  console.log("\n🧪 STARTING GOOGLE GEMINI AI COPILOT TEST SUITE\n");

  const testWorkspaceId = `test_ws_ai_${Date.now()}`;

  try {
    // 1. Unconfigured Gemini Provider graceful degradation
    console.log("--- 1. Unconfigured Provider Graceful Degradation ---");
    const unconfigured = new GeminiProvider("");
    assert(unconfigured.isConfigured() === false, "Reports isConfigured() = false when key is missing");

    try {
      await unconfigured.generateText("Hello");
      assert(false, "Should have thrown error on unconfigured generateText");
    } catch (err: any) {
      assert(err.statusCode === 503, "Throws 503 Service Unavailable when Gemini key is missing");
      assert(err.message.includes("Google Gemini AI is unconfigured"), "Provides clear configuration message to user");
    }

    // 2. Active Test Provider Setup
    console.log("--- 2. Mock Test Provider ---");
    setTestAIProvider(new MockAIProvider());
    assert(AIService.isConfigured() === true, "Reports isConfigured() = true with test provider");

    // 3. Email Draft Generation
    console.log("--- 3. Email Draft Generation ---");
    const draftRes = await AIService.generateEmailDraft(testWorkspaceId, {
      goal: "Product launch announcement for v2.0",
      productDetails: "New analytics dashboards and Gmail SMTP engine",
      tone: "Exciting",
    });

    assert(draftRes.draft !== undefined, "Returns email draft payload");
    assert(typeof draftRes.draft.subject === "string", "Draft includes subject line");
    assert(typeof draftRes.draft.bodyHtml === "string", "Draft includes HTML body");
    assert(draftRes.draft.bodyHtml.includes("<p>"), "HTML body contains paragraph markup");

    // 4. Subject Lines & Preheaders
    console.log("--- 4. Subject Lines & Preheaders ---");
    const subjectRes = await AIService.generateSubjectLines(testWorkspaceId, {
      purpose: "Black Friday Sale",
      count: 3,
    });
    assert(Array.isArray(subjectRes.suggestions), "Returns array of subject suggestions");
    assert(subjectRes.suggestions.length > 0, "Provides subject line variants");

    const preheaderRes = await AIService.generatePreheader(testWorkspaceId, {
      subject: "Exclusive Black Friday Deals Inside",
      count: 2,
    });
    assert(Array.isArray(preheaderRes.suggestions), "Returns array of preheader suggestions");

    // 5. Campaign Content Improvement & Spam Audit
    console.log("--- 5. Campaign Improvement & Spam Audit ---");
    const improveRes = await AIService.improveCampaign(testWorkspaceId, {
      subject: "ACT NOW FREE MONEY WINNER",
      htmlContent: "<p>Click here to claim your prize.</p>",
    });

    assert(improveRes.analysis !== undefined, "Returns analysis payload");
    assert(typeof improveRes.analysis.readabilityScore === "number", "Includes readability score");
    assert(Array.isArray(improveRes.analysis.suggestions), "Includes improvement suggestions");

    // 6. Natural Language Workflow Generation & Validation
    console.log("--- 6. Natural Language Automation Workflow Generation ---");
    const wfRes = await AIService.generateWorkflow(testWorkspaceId, {
      prompt: "When a subscriber joins, wait 2 days, then send a welcome discount email.",
    });

    assert(wfRes.workflow !== undefined, "Returns generated workflow");
    assert(Array.isArray(wfRes.workflow.nodes), "Workflow has nodes array");
    assert(Array.isArray(wfRes.workflow.edges), "Workflow has edges array");
    assert(wfRes.validation.isValid === true, "Generated workflow passes AutomationValidator schema");
    assert(wfRes.workflow.nodes.some((n: any) => n.type === "contact_subscribed"), "Contains trigger node");
    assert(wfRes.workflow.nodes.some((n: any) => n.type === "delay"), "Contains delay node");
    assert(wfRes.workflow.nodes.some((n: any) => n.type === "send_email"), "Contains send email action node");

    // 7. Interactive Copilot Chat
    console.log("--- 7. Copilot Chat Interaction ---");
    const chatRes = await AIService.chatCopilot(testWorkspaceId, {
      messages: [
        { role: "user", content: "How can I improve my open rates for a B2B audience?" },
      ],
    });
    assert(typeof chatRes.reply === "string" && chatRes.reply.length > 0, "Returns conversational AI advice");

  } catch (err: any) {
    console.error("❌ Exception during AI test suite:", err);
    failed++;
  } finally {
    console.log(`\n========================================`);
    console.log(`AI TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  }
}

run();

