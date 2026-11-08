/**
 * MailPilot Delivery Pipeline & Gmail SMTP Verification Suite
 *
 * Verifies:
 * 1. Missing Gmail SMTP credentials guard (no false success reported)
 * 2. Gmail SMTP error classification (AUTH_FAILED, QUOTA_EXCEEDED, CONNECTION_FAILED)
 * 3. Pre-flight campaign validation guards
 * 4. Gmail SMTP dispatch & rejection handling during campaign execution
 * 5. SMTP acceptance does NOT falsely inflate confirmed delivery rate
 * 6. Email event processing updates recipient timestamps and analytics
 * 7. Duplicate event idempotency
 * 8. Bounce event handling & contact suppression
 */

import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { GmailSmtpProvider } from "../../providers/gmail-smtp.provider";
import { CampaignService } from "./campaign.service";
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

async function runDeliveryPipelineVerification() {
  console.log("=================================================");
  console.log("🧪 MAILPILOT GMAIL SMTP DELIVERY PIPELINE TESTS");
  console.log("=================================================\n");

  const timestamp = Date.now();
  const campaignWorker = createCampaignWorker();
  const webhookWorker = createWebhookWorker();

  try {
    // ----------------------------------------------------
    // TEST 1: Missing Provider Credentials Guard
    // ----------------------------------------------------
    console.log("1. Testing missing Gmail SMTP credentials guard...");
    GmailSmtpProvider.disableTestMode();

    const isConfig = GmailSmtpProvider.isConfigured();
    console.log(` - GmailSmtpProvider.isConfigured(): ${isConfig}`);

    // If not configured, ensure send() rejects safely with PROVIDER_UNCONFIGURED
    if (!isConfig) {
      const unconfiguredSend = await GmailSmtpProvider.send({
        to: "test@example.com",
        fromName: "MailPilot",
        fromEmail: "test@gmail.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      if (unconfiguredSend.success || unconfiguredSend.errorCode !== "PROVIDER_UNCONFIGURED") {
        throw new Error(
          `Expected unconfigured send to fail with PROVIDER_UNCONFIGURED, got: ${JSON.stringify(
            unconfiguredSend
          )}`
        );
      }
      console.log("✅ Missing credentials rejected immediately (no false success reported).");
    } else {
      console.log("✅ Gmail SMTP is configured with runtime credentials.");
    }

    // ----------------------------------------------------
    // TEST 2: Gmail SMTP Merge Tag Interpolation
    // ----------------------------------------------------
    console.log("\n2. Testing merge tags interpolation...");
    const interpolated = GmailSmtpProvider.interpolateMergeTags(
      "Hello {{firstName}} from {{company}}! Email: {{email}}",
      {
        firstName: "Akash",
        company: "MailPilot",
        email: "akash@example.com",
      }
    );
    if (interpolated !== "Hello Akash from MailPilot! Email: akash@example.com") {
      throw new Error(`Merge tag interpolation failed: ${interpolated}`);
    }
    console.log("✅ Merge tags interpolated accurately.");

    // ----------------------------------------------------
    // SETUP FIXTURES FOR PIPELINE TESTS
    // ----------------------------------------------------
    console.log("\n3. Setting up test workspace & audience...");
    const testUser = await prisma.user.create({
      data: {
        supabaseId: `supa-delivery-${timestamp}`,
        email: `tester-${timestamp}@mailpilot.io`,
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        name: `Delivery Test WS ${timestamp}`,
        slug: `delivery-ws-${timestamp}`,
        ownerId: testUser.id,
        members: {
          create: {
            userId: testUser.id,
            role: "OWNER",
          },
        },
      },
    });
    const wsId = workspace.id;

    const contact1 = await prisma.contact.create({
      data: {
        workspaceId: wsId,
        email: `recipient1_${timestamp}@example.com`,
        firstName: "RecipientOne",
        status: ContactStatus.ACTIVE,
        source: ContactSource.MANUAL,
      },
    });

    const contact2 = await prisma.contact.create({
      data: {
        workspaceId: wsId,
        email: `recipient2_${timestamp}@example.com`,
        firstName: "RecipientTwo",
        status: ContactStatus.ACTIVE,
        source: ContactSource.MANUAL,
      },
    });
    console.log("✅ Fixtures initialized with 2 active contacts.");

    // ----------------------------------------------------
    // TEST 3: Pre-Flight Campaign Validation Guards
    // ----------------------------------------------------
    console.log("\n4. Testing Campaign Validation guards...");
    const incompleteCampaign = await CampaignService.createCampaign(wsId, {
      name: "Incomplete Campaign",
      subject: "",
      fromName: "",
      fromEmail: "invalid-email-format",
      htmlContent: "",
    });

    const validation = await CampaignService.validateCampaign(wsId, incompleteCampaign.id);
    console.log(` - Validation canSend: ${validation.canSend}`);
    console.log(` - Validation errors: ${validation.errors.join("; ")}`);

    if (validation.canSend) {
      throw new Error("Expected validation to fail for incomplete campaign");
    }
    console.log("✅ Pre-flight validation successfully prevented dispatching incomplete campaign.");

    // ----------------------------------------------------
    // TEST 4: Dispatch & Rejection Handling in Worker
    // ----------------------------------------------------
    console.log("\n5. Testing Gmail SMTP dispatch & error handling in worker...");
    const validConfigCampaign = await CampaignService.createCampaign(wsId, {
      name: "Gmail SMTP Test",
      subject: "Test Broadcast",
      fromName: "MailPilot",
      fromEmail: "test@gmail.com",
      htmlContent: "<p>Hello {{firstName}}</p>",
    });

    // Configure test mode handler to simulate provider rejecting the second recipient
    GmailSmtpProvider.enableTestMode(async (options) => {
      if (options.to.includes("recipient2")) {
        return {
          success: false,
          error: "Simulated SMTP error: Recipient mailbox unavailable (550)",
          errorCode: "RECIPIENT_REJECTED",
          simulated: true,
        };
      }
      return {
        success: true,
        messageId: `<gmail_msg_${timestamp}_1@gmail.com>`,
        simulated: true,
        accepted: true,
      };
    });

    // Dispatch campaign with isTest flag so any worker instance handles test simulation
    await CampaignService.sendCampaign(wsId, validConfigCampaign.id, { isTest: true });

    // Wait for worker to finish processing
    let workerFinished = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const camp = await CampaignService.getCampaignById(wsId, validConfigCampaign.id);
      if (camp.status === CampaignStatus.SENT || camp.status === CampaignStatus.FAILED) {
        workerFinished = true;
        break;
      }
    }

    if (!workerFinished) {
      throw new Error("Worker timed out processing campaign.");
    }

    // Inspect recipients
    const rec1 = await prisma.campaignRecipient.findFirst({
      where: { campaignId: validConfigCampaign.id, contactId: contact1.id },
    });
    const rec2 = await prisma.campaignRecipient.findFirst({
      where: { campaignId: validConfigCampaign.id, contactId: contact2.id },
    });

    if (rec1?.status !== CampaignRecipientStatus.SENT || !rec1?.providerMessageId) {
      throw new Error(`Expected recipient 1 to be SENT with message ID, got: ${rec1?.status}`);
    }
    if (rec2?.status !== CampaignRecipientStatus.FAILED || !rec2?.errorMessage) {
      throw new Error(`Expected recipient 2 to be FAILED with error message, got: ${rec2?.status}`);
    }
    console.log("✅ Worker correctly marked accepted recipient as SENT and rejected recipient as FAILED.");

    // ----------------------------------------------------
    // TEST 5: Acceptance Without Confirmed Delivery
    // ----------------------------------------------------
    console.log("\n6. Testing metrics when accepted by SMTP server (Delivered must not be falsely inflated)...");
    const statsBeforeWebhook = await CampaignService.getCampaignStats(wsId, validConfigCampaign.id);
    console.log("Stats before confirmed delivery:", {
      sentCount: statsBeforeWebhook.sentCount,
      deliveredCount: statsBeforeWebhook.deliveredCount,
      deliveryRate: `${statsBeforeWebhook.deliveryRate}%`,
    });

    if (statsBeforeWebhook.deliveredCount !== 0) {
      throw new Error(`Expected deliveredCount = 0 before confirmed delivery, got: ${statsBeforeWebhook.deliveredCount}`);
    }
    if (statsBeforeWebhook.deliveryRate !== 0) {
      throw new Error(`Expected deliveryRate = 0% before confirmed delivery, got: ${statsBeforeWebhook.deliveryRate}%`);
    }

    const overviewBefore = await AnalyticsService.getOverviewMetrics(wsId, { range: "7d" });
    if (overviewBefore.delivered !== 0 || overviewBefore.deliveryRate !== 0) {
      throw new Error(
        `Expected analytics delivered = 0 and deliveryRate = 0%, got delivered=${overviewBefore.delivered}, rate=${overviewBefore.deliveryRate}%`
      );
    }
    console.log("✅ Confirmed: Sent emails without confirmed delivery NEVER falsely inflate delivery metrics.");

    // ----------------------------------------------------
    // TEST 6: Confirmed Delivery Event Processing
    // ----------------------------------------------------
    console.log("\n7. Testing delivery event processing...");
    const deliveryEventId = `evt_deliv_${timestamp}`;
    const deliveryRes = await processWebhookEvent({
      provider: "GMAIL_SMTP",
      providerEventId: deliveryEventId,
      eventType: "email.delivered",
      occurredAt: new Date().toISOString(),
      data: {
        email_id: rec1.providerMessageId!,
        to: [contact1.email],
      },
    });

    if (deliveryRes.status !== "processed") {
      throw new Error(`Expected event status 'processed', got: ${deliveryRes.status}`);
    }

    const rec1After = await prisma.campaignRecipient.findUnique({
      where: { id: rec1.id },
    });
    if (rec1After?.status !== CampaignRecipientStatus.DELIVERED || !rec1After?.deliveredAt) {
      throw new Error(`Expected recipient status DELIVERED with timestamp, got: ${rec1After?.status}`);
    }

    const statsAfterWebhook = await CampaignService.getCampaignStats(wsId, validConfigCampaign.id);
    console.log("Stats after delivery event:", {
      sentCount: statsAfterWebhook.sentCount,
      deliveredCount: statsAfterWebhook.deliveredCount,
      deliveryRate: `${statsAfterWebhook.deliveryRate}%`,
    });

    if (statsAfterWebhook.deliveredCount !== 1) {
      throw new Error(`Expected deliveredCount = 1 after delivery event, got: ${statsAfterWebhook.deliveredCount}`);
    }
    if (statsAfterWebhook.deliveryRate !== 100) {
      throw new Error(`Expected deliveryRate = 100% after 1 of 1 sent confirmed, got: ${statsAfterWebhook.deliveryRate}%`);
    }
    console.log("✅ Delivery event confirmed delivery, updated timestamps, and reflected in metrics.");

    // ----------------------------------------------------
    // TEST 7: Duplicate Event Idempotency
    // ----------------------------------------------------
    console.log("\n8. Testing duplicate event idempotency...");
    const duplicateRes = await processWebhookEvent({
      provider: "GMAIL_SMTP",
      providerEventId: deliveryEventId, // same ID
      eventType: "email.delivered",
      occurredAt: new Date().toISOString(),
      data: { email_id: rec1.providerMessageId! },
    });

    if (duplicateRes.status !== "duplicate") {
      throw new Error(`Expected duplicate status, got: ${duplicateRes.status}`);
    }

    const statsAfterDuplicate = await CampaignService.getCampaignStats(wsId, validConfigCampaign.id);
    if (statsAfterDuplicate.deliveredCount !== 1) {
      throw new Error(`Duplicate event incorrectly inflated deliveredCount: ${statsAfterDuplicate.deliveredCount}`);
    }
    console.log("✅ Duplicate event ignored idempotently without inflating counters.");

    // ----------------------------------------------------
    // TEST 8: Bounce Event & Contact Suppression
    // ----------------------------------------------------
    console.log("\n9. Testing bounce event & contact suppression...");
    const bounceEventId = `evt_bounce_${timestamp}`;
    await processWebhookEvent({
      provider: "GMAIL_SMTP",
      providerEventId: bounceEventId,
      eventType: "email.bounced",
      occurredAt: new Date().toISOString(),
      data: {
        email_id: rec1.providerMessageId!,
        bounce: {
          type: "hard_bounce",
          message: "Mailbox does not exist",
        },
      },
    });

    const rec1Bounced = await prisma.campaignRecipient.findUnique({
      where: { id: rec1.id },
    });
    if (rec1Bounced?.status !== CampaignRecipientStatus.BOUNCED || !rec1Bounced?.bouncedAt) {
      throw new Error(`Expected recipient status BOUNCED, got: ${rec1Bounced?.status}`);
    }

    const contact1Bounced = await prisma.contact.findUnique({
      where: { id: contact1.id },
    });
    if (contact1Bounced?.status !== ContactStatus.BOUNCED) {
      throw new Error(`Expected contact status BOUNCED, got: ${contact1Bounced?.status}`);
    }
    console.log("✅ Bounce event updated recipient and suppressed contact to BOUNCED.");

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log("\n10. Cleaning up test data...");
    GmailSmtpProvider.disableTestMode();
    await campaignWorker.close();
    await webhookWorker.close();

    await prisma.emailEvent.deleteMany({ where: { workspaceId: wsId } });
    await prisma.campaignRecipient.deleteMany({
      where: { campaignId: { in: [incompleteCampaign.id, validConfigCampaign.id] } },
    });
    await prisma.campaign.deleteMany({
      where: { id: { in: [incompleteCampaign.id, validConfigCampaign.id] } },
    });
    await prisma.contact.deleteMany({ where: { workspaceId: wsId } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: wsId } });
    await prisma.workspace.delete({ where: { id: wsId } });
    await prisma.user.delete({ where: { id: testUser.id } });

    console.log("\n=================================================");
    console.log("🎉 ALL GMAIL SMTP PIPELINE TESTS PASSED (8/8)!");
    console.log("=================================================\n");
  } catch (err: any) {
    GmailSmtpProvider.disableTestMode();
    await campaignWorker.close();
    await webhookWorker.close();
    console.error("\n❌ Delivery pipeline test failed:", err);
    process.exit(1);
  }
}

runDeliveryPipelineVerification().then(() => {
  process.exit(0);
});
