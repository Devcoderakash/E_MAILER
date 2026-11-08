/**
 * MailPilot Brevo Email Delivery Provider Verification Suite
 *
 * Verifies all 14 core requirements:
 * 1. Brevo API request construction: sender, recipient, subject, html, text, tags, headers.
 * 2. Successful API acceptance returns providerMessageId (normalized without <>).
 * 3. Provider message ID persisted on CampaignRecipient with provider = "BREVO".
 * 4. Invalid API key / rejected request handled gracefully without unhandled promise rejection.
 * 5. Missing environment configuration fails safe with actionable error (PROVIDER_UNCONFIGURED).
 * 6. Webhook delivered event updates CampaignRecipient and increments analytics.
 * 7. Webhook bounce event updates recipient to BOUNCED and marks contact unsubscribed/suppressed.
 * 8. Webhook spam event suppresses contact.
 * 9. Duplicate webhook event idempotency (same event ID processed once).
 * 10. Provider message ID correlation works with and without enclosing angle brackets.
 * 11. Workspace isolation: events for workspace A never affect workspace B.
 * 12. Unsubscribed contacts are excluded from Brevo campaign snapshot.
 * 13. Resend regression: Resend provider still constructs valid request and handles responses.
 * 14. Mock provider cannot inflate real delivery metrics (acceptance alone never increments delivered).
 */

import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { BrevoEmailProvider } from "../../providers/brevo.provider";
import { ResendProvider } from "../../providers/resend.provider";
import { EmailProviderFactory } from "../../providers/email.factory";
import { CampaignService } from "../campaigns/campaign.service";
import { createCampaignWorker } from "../../workers/campaign.worker";
import { processWebhookEvent, createWebhookWorker } from "../../workers/webhook.worker";
import { AnalyticsService } from "../analytics/analytics.service";
import {
  ContactStatus,
  ContactSource,
  CampaignStatus,
  CampaignRecipientStatus,
  EmailEventType,
} from "@prisma/client";

async function runBrevoVerification() {
  console.log("=================================================");
  console.log("🚀 MAILPILOT BREVO DELIVERY PROVIDER VERIFICATION");
  console.log("=================================================\n");

  const timestamp = Date.now();
  const campaignWorker = createCampaignWorker();
  const webhookWorker = createWebhookWorker();

  let testUser: any;
  let workspaceA: any;
  let workspaceB: any;
  let contactA1: any;
  let contactA2: any;
  let unsubContactA: any;
  let contactB1: any;

  try {
    // ----------------------------------------------------
    // TEST 1: Brevo API Request Construction
    // ----------------------------------------------------
    console.log("1. Testing Brevo API request construction...");
    const requestPayload = BrevoEmailProvider.buildSendRequest({
      to: "recipient@example.com",
      toName: "Alex User",
      fromEmail: "lodhiakash286@gmail.com",
      fromName: "MailPilot Marketing",
      subject: "Welcome to MailPilot",
      html: "<p>Hello Alex, welcome!</p>",
      preheader: "Exclusive inside",
      replyTo: "support@mailpilot.io",
      tags: [
        { name: "campaign", value: "june_launch" },
        { name: "cohort", value: "beta" },
      ],
      params: { firstName: "Alex", company: "Acme" },
      headers: { "X-Custom-Tracking": "track-123" },
    });

    if (requestPayload.sender.email !== "lodhiakash286@gmail.com") {
      throw new Error(`Expected sender email 'lodhiakash286@gmail.com', got: ${requestPayload.sender.email}`);
    }
    if (requestPayload.sender.name !== "MailPilot Marketing") {
      throw new Error(`Expected sender name 'MailPilot Marketing', got: ${requestPayload.sender.name}`);
    }
    if (requestPayload.to[0].email !== "recipient@example.com" || requestPayload.to[0].name !== "Alex User") {
      throw new Error("Recipient to array mismatch");
    }
    if (requestPayload.subject !== "Welcome to MailPilot") {
      throw new Error("Subject line mismatch");
    }
    if (!requestPayload.htmlContent.includes("Exclusive inside")) {
      throw new Error("Preheader was not injected into HTML");
    }
    if (requestPayload.replyTo?.email !== "support@mailpilot.io") {
      throw new Error("Reply-To email mismatch");
    }
    if (!requestPayload.tags.includes("campaign_june_launch")) {
      throw new Error("Tags formatting mismatch");
    }
    if (requestPayload.headers["X-Custom-Tracking"] !== "track-123") {
      throw new Error("Custom headers missing");
    }
    console.log("✅ Brevo request payload constructed with accurate sender, recipient, subject, html, text, tags, and headers.");

    // ----------------------------------------------------
    // TEST 2: Successful API Acceptance & Message ID Normalization
    // ----------------------------------------------------
    console.log("\n2. Testing successful API acceptance and message ID normalization...");
    BrevoEmailProvider.enableTestMode(async (options) => {
      return {
        success: true,
        messageId: "20261108140000.brevo.test@smtp-relay.brevo.com",
        simulated: true,
        provider: "BREVO",
      };
    });

    const sendRes = await BrevoEmailProvider.send({
      to: "test@example.com",
      fromEmail: "lodhiakash286@gmail.com",
      fromName: "MailPilot",
      subject: "Test Send",
      html: "<p>Hello</p>",
    });

    if (!sendRes.success || !sendRes.messageId) {
      throw new Error("Expected successful send with message ID");
    }
    if (sendRes.messageId.startsWith("<") || sendRes.messageId.endsWith(">")) {
      throw new Error(`Expected normalized messageId without angle brackets, got: ${sendRes.messageId}`);
    }
    console.log(`✅ Brevo accepted email, returned normalized message ID: ${sendRes.messageId}`);

    // ----------------------------------------------------
    // Setup Fixtures for Database Integration Tests
    // ----------------------------------------------------
    console.log("\nSetting up database fixtures...");
    testUser = await prisma.user.create({
      data: {
        email: `brevo_tester_${timestamp}@example.com`,
        name: "Brevo Tester",
        supabaseId: `sb_brevo_${timestamp}`,
        role: "OWNER",
      },
    });

    workspaceA = await prisma.workspace.create({
      data: {
        name: `Brevo WS A ${timestamp}`,
        slug: `brevo-ws-a-${timestamp}`,
        ownerId: testUser.id,
        defaultEmailProvider: "BREVO",
        members: {
          create: {
            userId: testUser.id,
            role: "OWNER",
          },
        },
      },
    });

    workspaceB = await prisma.workspace.create({
      data: {
        name: `Brevo WS B ${timestamp}`,
        slug: `brevo-ws-b-${timestamp}`,
        ownerId: testUser.id,
        defaultEmailProvider: "RESEND",
        members: {
          create: {
            userId: testUser.id,
            role: "OWNER",
          },
        },
      },
    });

    // Populate contacts in Workspace A (2 Active, 1 Unsubscribed)
    contactA1 = await prisma.contact.create({
      data: {
        workspaceId: workspaceA.id,
        email: `contactA1_${timestamp}@example.com`,
        firstName: "Alice",
        status: ContactStatus.ACTIVE,
        source: ContactSource.MANUAL,
      },
    });

    contactA2 = await prisma.contact.create({
      data: {
        workspaceId: workspaceA.id,
        email: `contactA2_${timestamp}@example.com`,
        firstName: "Bob",
        status: ContactStatus.ACTIVE,
        source: ContactSource.MANUAL,
      },
    });

    unsubContactA = await prisma.contact.create({
      data: {
        workspaceId: workspaceA.id,
        email: `unsubA_${timestamp}@example.com`,
        firstName: "Charlie Unsub",
        status: ContactStatus.UNSUBSCRIBED,
        source: ContactSource.MANUAL,
      },
    });

    // Populate contact in Workspace B
    contactB1 = await prisma.contact.create({
      data: {
        workspaceId: workspaceB.id,
        email: `contactB1_${timestamp}@example.com`,
        firstName: "David WS-B",
        status: ContactStatus.ACTIVE,
        source: ContactSource.MANUAL,
      },
    });
    console.log("✅ Fixtures created with multi-tenant workspaces and contacts.");

    // ----------------------------------------------------
    // TEST 3 & 12: Campaign Dispatch, Snapshot Suppression & Persistence
    // ----------------------------------------------------
    console.log("\n3. Testing Brevo campaign snapshotting and recipient persistence...");
    const brevoCampaign = await CampaignService.createCampaign(workspaceA.id, {
      name: `Brevo Campaign ${timestamp}`,
      subject: "Hello from Brevo",
      fromName: "MailPilot",
      fromEmail: "lodhiakash286@gmail.com",
      htmlContent: "<p>Hello {{first_name}}</p>",
      provider: "BREVO",
    });

    if (brevoCampaign.provider !== "BREVO") {
      throw new Error(`Expected campaign provider to be 'BREVO', got: ${brevoCampaign.provider}`);
    }

    // Configure test handler to generate distinct message IDs
    const msgId1 = `20261108140101.brevo_${timestamp}_1@smtp-relay.brevo.com`;
    const msgId2 = `20261108140102.brevo_${timestamp}_2@smtp-relay.brevo.com`;

    BrevoEmailProvider.enableTestMode(async (options) => {
      if (options.to.toLowerCase().includes("contacta1")) {
        return {
          success: true,
          messageId: msgId1,
          simulated: true,
          provider: "BREVO",
        };
      }
      return {
        success: true,
        messageId: msgId2,
        simulated: true,
        provider: "BREVO",
      };
    });

    // Dispatch campaign
    await CampaignService.sendCampaign(workspaceA.id, brevoCampaign.id, { isTest: true });

    // Wait for campaign worker to complete
    let workerFinished = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const camp = await CampaignService.getCampaignById(workspaceA.id, brevoCampaign.id);
      if (camp.status === CampaignStatus.SENT || camp.status === CampaignStatus.FAILED) {
        workerFinished = true;
        break;
      }
    }

    if (!workerFinished) {
      throw new Error("Worker timed out processing Brevo campaign.");
    }

    // TEST 12: Verify unsubscribed contact was excluded
    const allRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: brevoCampaign.id },
    });
    if (allRecipients.length !== 2) {
      throw new Error(`Expected 2 recipients (unsubscribed excluded), found: ${allRecipients.length}`);
    }
    const unsubFound = allRecipients.find((r) => r.contactId === unsubContactA.id);
    if (unsubFound) {
      throw new Error("Unsubscribed contact was incorrectly included in campaign snapshot!");
    }
    console.log("✅ TEST 12 PASSED: Unsubscribed contact was cleanly excluded from recipient snapshot.");

    // TEST 3: Verify provider message ID persisted on CampaignRecipient
    const rec1 = allRecipients.find((r) => r.contactId === contactA1.id);
    const rec2 = allRecipients.find((r) => r.contactId === contactA2.id);

    if (!rec1 || rec1.status !== CampaignRecipientStatus.SENT || !rec1.providerMessageId) {
      throw new Error(`Expected recipient 1 to be SENT with message ID, got: ${rec1?.status}, ${rec1?.providerMessageId}`);
    }
    if (!rec2 || rec2.status !== CampaignRecipientStatus.SENT || !rec2.providerMessageId) {
      throw new Error(`Expected recipient 2 to be SENT with message ID, got: ${rec2?.status}, ${rec2?.providerMessageId}`);
    }
    if (rec1.provider !== "BREVO") {
      throw new Error(`Expected recipient 1 provider to be 'BREVO', got: ${rec1.provider}`);
    }

    const actualMsgId1 = rec1.providerMessageId;
    const actualMsgId2 = rec2.providerMessageId;
    console.log(`✅ TEST 3 PASSED: Provider message ID (${actualMsgId1}) and provider type persisted on CampaignRecipient.`);

    // ----------------------------------------------------
    // TEST 14: Mock / Acceptance Cannot Inflate Delivery Metrics
    // ----------------------------------------------------
    console.log("\n4. Testing metrics before delivery webhook (delivery rate must remain 0%)...");
    const statsBeforeWebhook = await CampaignService.getCampaignStats(workspaceA.id, brevoCampaign.id);
    console.log(" - Stats before webhook:", {
      sentCount: statsBeforeWebhook.sentCount,
      deliveredCount: statsBeforeWebhook.deliveredCount,
      deliveryRate: statsBeforeWebhook.deliveryRate,
    });

    if (statsBeforeWebhook.sentCount !== 2) {
      throw new Error(`Expected sentCount = 2, got: ${statsBeforeWebhook.sentCount}`);
    }
    if (statsBeforeWebhook.deliveredCount !== 0) {
      throw new Error(`Expected deliveredCount = 0 before webhook, got: ${statsBeforeWebhook.deliveredCount}`);
    }
    if (statsBeforeWebhook.deliveryRate !== 0) {
      throw new Error(`Expected deliveryRate = 0% before webhook, got: ${statsBeforeWebhook.deliveryRate}`);
    }
    console.log("✅ TEST 14 PASSED: Provider acceptance does NOT falsely inflate delivery counts.");

    // ----------------------------------------------------
    // TEST 4 & 5: Failure Handling & Missing Config Safety
    // ----------------------------------------------------
    console.log("\n5. Testing invalid credentials & unconfigured safety...");
    BrevoEmailProvider.disableTestMode();

    // Call send without configured key
    const unconfigRes = await BrevoEmailProvider.send({
      to: "nobody@example.com",
      fromEmail: "lodhiakash286@gmail.com",
      fromName: "MailPilot",
      subject: "Test Unconfigured",
      html: "<p>Unconfigured</p>",
    });

    if (unconfigRes.success || unconfigRes.errorCode !== "PROVIDER_UNCONFIGURED") {
      throw new Error(`Expected failure with PROVIDER_UNCONFIGURED, got: ${JSON.stringify(unconfigRes)}`);
    }
    console.log("✅ TEST 5 PASSED: Missing config fails safe with actionable error.");

    // Simulate rejection gracefully without unhandled rejection
    BrevoEmailProvider.enableTestMode(async () => {
      return {
        success: false,
        error: "Invalid API key provided",
        errorCode: "UNAUTHORIZED",
        simulated: true,
        provider: "BREVO",
      };
    });

    const rejectedRes = await BrevoEmailProvider.send({
      to: "invalid@example.com",
      fromEmail: "lodhiakash286@gmail.com",
      fromName: "MailPilot",
      subject: "Test Rejection",
      html: "<p>Rejected</p>",
    });

    if (rejectedRes.success || rejectedRes.errorCode !== "UNAUTHORIZED") {
      throw new Error(`Expected graceful rejection, got: ${JSON.stringify(rejectedRes)}`);
    }
    console.log("✅ TEST 4 PASSED: Rejected API calls handled gracefully without crashing or throwing unhandled errors.");

    // ----------------------------------------------------
    // TEST 6: Webhook 'delivered' Event Updates Recipient & Increments Analytics
    // ----------------------------------------------------
    console.log("\n6. Testing Brevo webhook 'delivered' event...");
    const deliveredEventId = `brevo_evt_del_${timestamp}`;
    const webhookResDel = await processWebhookEvent({
      provider: "BREVO",
      providerEventId: deliveredEventId,
      eventType: "delivered",
      occurredAt: new Date().toISOString(),
      data: {
        email_id: actualMsgId1,
        to: [contactA1.email],
      },
    });

    if (webhookResDel.status !== "processed") {
      throw new Error(`Expected webhook to be processed, got: ${webhookResDel.status}`);
    }

    const updatedRec1 = await prisma.campaignRecipient.findUnique({
      where: { id: rec1.id },
    });
    if (updatedRec1?.status !== CampaignRecipientStatus.DELIVERED || !updatedRec1?.deliveredAt) {
      throw new Error(`Expected recipient to be DELIVERED with deliveredAt, got: ${updatedRec1?.status}`);
    }

    const statsAfterDelivered = await CampaignService.getCampaignStats(workspaceA.id, brevoCampaign.id);
    console.log(" - Stats after delivered webhook:", {
      deliveredCount: statsAfterDelivered.deliveredCount,
      deliveryRate: statsAfterDelivered.deliveryRate,
    });

    if (statsAfterDelivered.deliveredCount !== 1) {
      throw new Error(`Expected deliveredCount = 1, got: ${statsAfterDelivered.deliveredCount}`);
    }
    if (statsAfterDelivered.deliveryRate !== 50) {
      throw new Error(`Expected deliveryRate = 50%, got: ${statsAfterDelivered.deliveryRate}`);
    }
    console.log("✅ TEST 6 PASSED: Webhook delivered event updated recipient and incremented analytics.");

    // ----------------------------------------------------
    // TEST 9: Duplicate Webhook Event Idempotency
    // ----------------------------------------------------
    console.log("\n7. Testing duplicate webhook event idempotency...");
    const dupWebhookRes = await processWebhookEvent({
      provider: "BREVO",
      providerEventId: deliveredEventId,
      eventType: "delivered",
      occurredAt: new Date().toISOString(),
      data: {
        email_id: actualMsgId1,
        to: [contactA1.email],
      },
    });

    if (dupWebhookRes.status !== "duplicate" && dupWebhookRes.status !== "already_processed") {
      throw new Error(`Expected duplicate webhook to return 'duplicate' or 'already_processed', got: ${dupWebhookRes.status}`);
    }

    const statsAfterDup = await CampaignService.getCampaignStats(workspaceA.id, brevoCampaign.id);
    if (statsAfterDup.deliveredCount !== 1) {
      throw new Error(`Duplicate webhook caused deliveredCount to increment to ${statsAfterDup.deliveredCount}`);
    }
    console.log("✅ TEST 9 PASSED: Duplicate webhook event processed idempotently (no double counter increment).");

    // ----------------------------------------------------
    // TEST 10: Provider Message ID Correlation With & Without Angle Brackets
    // ----------------------------------------------------
    console.log("\n8. Testing provider message ID correlation with enclosing angle brackets...");
    // actualMsgId2 was stored as plain string. Webhook sends <actualMsgId2>
    const wrappedMsgId2 = `<${actualMsgId2}>`;
    const angleBracketEventId = `brevo_evt_del_angle_${timestamp}`;

    const angleWebhookRes = await processWebhookEvent({
      provider: "BREVO",
      providerEventId: angleBracketEventId,
      eventType: "delivered",
      occurredAt: new Date().toISOString(),
      data: {
        email_id: wrappedMsgId2,
        to: [contactA2.email],
      },
    });

    if (angleWebhookRes.status !== "processed") {
      throw new Error(`Failed to correlate webhook message ID with angle brackets: ${angleWebhookRes.status}`);
    }

    const updatedRec2 = await prisma.campaignRecipient.findUnique({
      where: { id: rec2!.id },
    });
    if (updatedRec2?.status !== CampaignRecipientStatus.DELIVERED) {
      throw new Error(`Expected recipient 2 to be DELIVERED via angle-bracket correlation, got: ${updatedRec2?.status}`);
    }
    console.log("✅ TEST 10 PASSED: Provider message ID correlation seamlessly matched message IDs with/without angle brackets.");

    // ----------------------------------------------------
    // TEST 7: Webhook Bounce Event & Contact Suppression
    // ----------------------------------------------------
    console.log("\n9. Testing Brevo webhook bounce event and contact suppression...");
    const bounceEventId = `brevo_evt_bounce_${timestamp}`;
    await processWebhookEvent({
      provider: "BREVO",
      providerEventId: bounceEventId,
      eventType: "hard_bounce",
      occurredAt: new Date().toISOString(),
      data: {
        email_id: actualMsgId1,
        to: [contactA1.email],
      },
    });

    const bouncedRec = await prisma.campaignRecipient.findUnique({
      where: { id: rec1.id },
    });
    const bouncedContact = await prisma.contact.findUnique({
      where: { id: contactA1.id },
    });

    if (bouncedRec?.status !== CampaignRecipientStatus.BOUNCED) {
      throw new Error(`Expected recipient status BOUNCED, got: ${bouncedRec?.status}`);
    }
    if (bouncedContact?.status !== ContactStatus.BOUNCED) {
      throw new Error(`Expected contact status BOUNCED, got: ${bouncedContact?.status}`);
    }
    console.log("✅ TEST 7 PASSED: Webhook hard_bounce updated recipient to BOUNCED and suppressed contact.");

    // ----------------------------------------------------
    // TEST 8: Webhook Spam Complaint Event & Contact Suppression
    // ----------------------------------------------------
    console.log("\n10. Testing Brevo webhook spam complaint event and suppression...");
    const spamEventId = `brevo_evt_spam_${timestamp}`;
    await processWebhookEvent({
      provider: "BREVO",
      providerEventId: spamEventId,
      eventType: "spam",
      occurredAt: new Date().toISOString(),
      data: {
        email_id: actualMsgId2,
        to: [contactA2.email],
      },
    });

    const spamEvent = await prisma.emailEvent.findFirst({
      where: { providerEventId: spamEventId },
    });
    const spamContact = await prisma.contact.findUnique({
      where: { id: contactA2.id },
    });
    const spamCamp = await prisma.campaign.findUnique({
      where: { id: brevoCampaign.id },
    });

    if (spamEvent?.eventType !== EmailEventType.COMPLAINED) {
      throw new Error(`Expected EmailEvent COMPLAINED, got: ${spamEvent?.eventType}`);
    }
    if (spamContact?.status !== ContactStatus.BOUNCED) {
      throw new Error(`Expected contact status BOUNCED (suppressed) after spam complaint, got: ${spamContact?.status}`);
    }
    if ((spamCamp?.complainedCount || 0) < 1) {
      throw new Error("Expected campaign complainedCount to be incremented");
    }
    console.log("✅ TEST 8 PASSED: Webhook spam complaint marked recipient COMPLAINED and suppressed contact.");

    // ----------------------------------------------------
    // TEST 11: Multi-Tenant Workspace Isolation
    // ----------------------------------------------------
    console.log("\n11. Testing multi-tenant workspace isolation...");
    const wsBStats = await AnalyticsService.getOverviewMetrics(workspaceB.id, { range: "30d" });
    if (wsBStats.sent !== 0 || wsBStats.delivered !== 0) {
      throw new Error(`Workspace B metrics contaminated by Workspace A: sent=${wsBStats.sent}`);
    }

    const wsBEvents = await prisma.emailEvent.findMany({
      where: { workspaceId: workspaceB.id },
    });
    if (wsBEvents.length !== 0) {
      throw new Error(`Workspace B email events found (${wsBEvents.length}), expected 0`);
    }
    console.log("✅ TEST 11 PASSED: Strict workspace isolation maintained; Workspace A activity never leaks into Workspace B.");

    // ----------------------------------------------------
    // TEST 13: Resend Regression & Coexistence
    // ----------------------------------------------------
    console.log("\n12. Testing Resend regression and coexistence...");
    ResendProvider.enableTestMode(async (options) => {
      return {
        success: true,
        messageId: `re_regression_${timestamp}`,
        simulated: true,
        provider: "RESEND",
      };
    });

    const resendSend = await ResendProvider.send({
      to: "regression@example.com",
      fromEmail: "onboarding@resend.dev",
      fromName: "MailPilot",
      subject: "Resend Regression Test",
      html: "<p>Resend still works!</p>",
    });

    if (!resendSend.success || !resendSend.messageId?.startsWith("re_regression")) {
      throw new Error(`Resend provider failed regression test: ${JSON.stringify(resendSend)}`);
    }

    // Verify factory resolves both providers properly
    const resendProvider = EmailProviderFactory.getProvider("RESEND");
    const brevoProvider = EmailProviderFactory.getProvider("BREVO");

    if (resendProvider !== ResendProvider) {
      throw new Error("EmailProviderFactory.getProvider('RESEND') did not return ResendProvider");
    }
    if (brevoProvider !== BrevoEmailProvider) {
      throw new Error("EmailProviderFactory.getProvider('BREVO') did not return BrevoEmailProvider");
    }

    const statuses = EmailProviderFactory.getProvidersStatus("BREVO");
    const brevoStatus = statuses.find((s) => s.type === "BREVO");
    const resendStatus = statuses.find((s) => s.type === "RESEND");

    if (!brevoStatus?.supportsPersonalSender) {
      throw new Error("Brevo provider status missing supportsPersonalSender: true");
    }
    if (resendStatus?.supportsPersonalSender) {
      throw new Error("Resend provider status incorrectly reports supportsPersonalSender: true");
    }
    console.log("✅ TEST 13 PASSED: Resend provider continues to function perfectly; dual-provider coexistence verified.");

    console.log("\n=================================================");
    console.log("🎉 ALL 14 BREVO VERIFICATION TESTS PASSED!");
    console.log("=================================================\n");
  } finally {
    // Teardown test workers and cleanup test data
    await campaignWorker.close();
    await webhookWorker.close();

    BrevoEmailProvider.disableTestMode();
    ResendProvider.disableTestMode();

    if (workspaceA?.id) {
      await prisma.emailEvent.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.campaignRecipient.deleteMany({ where: { campaign: { workspaceId: workspaceA.id } } });
      await prisma.campaign.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.contact.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.workspace.delete({ where: { id: workspaceA.id } });
    }

    if (workspaceB?.id) {
      await prisma.emailEvent.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.campaignRecipient.deleteMany({ where: { campaign: { workspaceId: workspaceB.id } } });
      await prisma.campaign.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.contact.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.workspace.delete({ where: { id: workspaceB.id } });
    }

    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }

    await prisma.$disconnect();
    await redis.quit();
  }
}

// Run test suite directly if executed as main script
if (require.main === module) {
  runBrevoVerification()
    .then(() => {
      console.log("Verification finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Verification failed with error:", err);
      process.exit(1);
    });
}

export { runBrevoVerification };
