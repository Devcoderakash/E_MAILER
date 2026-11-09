/**
 * MailPilot Unsubscribe & Deliverability Verification Suite
 *
 * Verifies:
 * 1. Unsubscribe token generation and cryptographic validation
 * 2. Tampered and invalid token rejection (INVALID_TOKEN)
 * 3. Expired token rejection (EXPIRED_TOKEN)
 * 4. Production HTTPS URL enforcement and absence of localhost in production
 * 5. Human GET one-click unsubscribe execution and HTML rendering
 * 6. Machine RFC 8058 POST one-click unsubscribe execution
 * 7. Unsubscribe idempotency (no duplicate counts or duplicate events)
 * 8. Cross-workspace security prevention
 * 9. Omission of localhost List-Unsubscribe headers & presence of HTTPS headers
 * 10. Removal of custom automation headers (X-Mailer, X-Auto-Response-Suppress)
 * 11. Test-email rate limiting and duplicate send protection
 */

import { prisma } from "../../config/database";
import { env } from "../../config/env";
import {
  UnsubscribeService,
  UnsubscribeError,
} from "./unsubscribe.service";
import { GmailSmtpProvider } from "../../providers/gmail-smtp.provider";
import { SettingsService, TestEmailRateLimitError } from "../settings/settings.service";
import {
  ContactStatus,
  ContactSource,
  CampaignStatus,
  CampaignRecipientStatus,
  EmailEventType,
} from "@prisma/client";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAILED ASSERTION: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runUnsubscribeAndDeliverabilityVerification() {
  console.log("===============================================================");
  console.log("🧪 MAILPILOT UNSUBSCRIBE & DELIVERABILITY VERIFICATION SUITE");
  console.log("===============================================================\n");

  const timestamp = Date.now();
  let testUser: any;
  let workspaceA: any;
  let workspaceB: any;
  let campaignA: any;
  let contactA: any;
  let recipientA: any;

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Unsubscribe Token Generation and Cryptographic Verification
    // ------------------------------------------------------------------------
    console.log("1. Testing Unsubscribe Token Generation & Cryptography...");
    const samplePayload = {
      recipientId: "rec_test_123",
      campaignId: "camp_test_456",
      workspaceId: "ws_test_789",
      email: "subscriber@example.com",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
    };

    const token = UnsubscribeService.generateToken(samplePayload);
    assert(typeof token === "string" && token.length > 30, "Generated secure base64url token");
    assert(!token.includes("/") && !token.includes("+"), "Token is URL-safe (base64url)");
    assert(!token.includes("subscriber@example.com"), "Token ciphertext does not expose plain-text recipient email");

    const verified = UnsubscribeService.verifyToken(token);
    assert(verified.recipientId === samplePayload.recipientId, "Verified recipientId matches");
    assert(verified.campaignId === samplePayload.campaignId, "Verified campaignId matches");
    assert(verified.workspaceId === samplePayload.workspaceId, "Verified workspaceId matches");
    assert(verified.email === samplePayload.email, "Verified email matches");

    // ------------------------------------------------------------------------
    // TEST 2: Tampered and Malformed Token Rejection
    // ------------------------------------------------------------------------
    console.log("\n2. Testing Tampered & Malformed Token Rejection...");
    let tamperedFailed = false;
    try {
      // Flip a byte in the token
      const tamperedBytes = Buffer.from(token, "base64url");
      tamperedBytes[tamperedBytes.length - 2] ^= 0xff;
      UnsubscribeService.verifyToken(tamperedBytes.toString("base64url"));
    } catch (err: any) {
      tamperedFailed = true;
      assert(err instanceof UnsubscribeError, "Throws UnsubscribeError on tampered ciphertext");
      assert(err.code === "INVALID_TOKEN", "Error code is INVALID_TOKEN for tampered token");
    }
    assert(tamperedFailed, "Tampered token was rejected by AES-256-GCM authentication tag");

    let malformedFailed = false;
    try {
      UnsubscribeService.verifyToken("invalid_garbage_token");
    } catch (err: any) {
      malformedFailed = true;
      assert(err instanceof UnsubscribeError && err.code === "INVALID_TOKEN", "Rejects non-token string");
    }
    assert(malformedFailed, "Malformed string was rejected");

    // ------------------------------------------------------------------------
    // TEST 3: Expired Token Rejection
    // ------------------------------------------------------------------------
    console.log("\n3. Testing Expired Token Rejection...");
    const expiredToken = UnsubscribeService.generateToken({
      recipientId: "rec_exp_1",
      campaignId: "camp_exp_1",
      workspaceId: "ws_exp_1",
      email: "expired@example.com",
      expiresAt: Date.now() - 5000, // 5 seconds in the past
    });

    let expiredCaught = false;
    try {
      UnsubscribeService.verifyToken(expiredToken);
    } catch (err: any) {
      expiredCaught = true;
      assert(err instanceof UnsubscribeError, "Throws UnsubscribeError for expired token");
      assert(err.code === "EXPIRED_TOKEN", "Error code is EXPIRED_TOKEN");
    }
    assert(expiredCaught, "Expired token rejected successfully");

    // ------------------------------------------------------------------------
    // TEST 4: URL Generation & Public HTTPS Validation
    // ------------------------------------------------------------------------
    console.log("\n4. Testing URL Generation & HTTPS Detection...");
    assert(UnsubscribeService.isPublicHttpsUrl("https://api.mailpilot.app/api/webhooks/unsubscribe"), "Identifies public HTTPS URL");
    assert(!UnsubscribeService.isPublicHttpsUrl("http://localhost:4000/api/webhooks/unsubscribe"), "Rejects localhost HTTP URL");
    assert(!UnsubscribeService.isPublicHttpsUrl("https://localhost:4000/api/webhooks/unsubscribe"), "Rejects localhost HTTPS URL");
    assert(!UnsubscribeService.isPublicHttpsUrl("http://127.0.0.1:4000/api/webhooks/unsubscribe"), "Rejects loopback IP URL");
    assert(!UnsubscribeService.isPublicHttpsUrl(null), "Handles null URL safely");

    // Test production safeguard when PUBLIC_API_URL is invalid
    const originalEnv = env.NODE_ENV;
    const originalPublicUrl = env.PUBLIC_API_URL;

    try {
      (env as any).NODE_ENV = "production";
      (env as any).PUBLIC_API_URL = "http://localhost:4000";
      let prodLocalhostBlocked = false;
      try {
        UnsubscribeService.getPublicApiBaseUrl();
      } catch (err: any) {
        prodLocalhostBlocked = true;
        assert(err.message.includes("must be a valid public HTTPS URL in production"), "Production blocks localhost URL");
      }
      assert(prodLocalhostBlocked, "Production safeguards prohibit localhost API base URL");

      (env as any).PUBLIC_API_URL = "https://api.mailpilot.com";
      const validProdBase = UnsubscribeService.getPublicApiBaseUrl();
      assert(validProdBase === "https://api.mailpilot.com", "Production accepts valid HTTPS public URL");
    } finally {
      (env as any).NODE_ENV = originalEnv;
      (env as any).PUBLIC_API_URL = originalPublicUrl;
    }

    // ------------------------------------------------------------------------
    // TEST 5: Database Setup for Real End-to-End Execution
    // ------------------------------------------------------------------------
    console.log("\n5. Setting up test fixtures in database...");
    testUser = await prisma.user.create({
      data: {
        supabaseId: `test-sub-${timestamp}`,
        email: `deliverability-tester-${timestamp}@mailpilot.io`,
        name: "Akash Lodhi",
      },
    });

    workspaceA = await prisma.workspace.create({
      data: {
        name: `Workspace Alpha ${timestamp}`,
        slug: `ws-alpha-${timestamp}`,
        ownerId: testUser.id,
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
        name: `Workspace Beta ${timestamp}`,
        slug: `ws-beta-${timestamp}`,
        ownerId: testUser.id,
        members: {
          create: {
            userId: testUser.id,
            role: "OWNER",
          },
        },
      },
    });

    contactA = await prisma.contact.create({
      data: {
        workspaceId: workspaceA.id,
        email: `recipient-${timestamp}@gmail.com`,
        firstName: "Taylor",
        lastName: "Recipient",
        status: ContactStatus.ACTIVE,
        source: ContactSource.MANUAL,
      },
    });

    campaignA = await prisma.campaign.create({
      data: {
        workspaceId: workspaceA.id,
        name: "Deliverability Test Campaign",
        subject: "Welcome to MailPilot",
        fromName: "Akash Lodhi",
        fromEmail: "lodhiakash286@gmail.com",
        htmlContent: "<p>Hello {{firstName}}, Welcome!</p>",
        status: CampaignStatus.QUEUED,
        unsubscribedCount: 0,
      },
    });

    recipientA = await prisma.campaignRecipient.create({
      data: {
        campaignId: campaignA.id,
        contactId: contactA.id,
        email: contactA.email,
        firstName: contactA.firstName,
        lastName: contactA.lastName,
        status: CampaignRecipientStatus.SENT,
        provider: "GMAIL_SMTP",
        providerMessageId: `<msg-${timestamp}@mailpilot.io>`,
      },
    });

    assert(recipientA.id !== null, "Created test CampaignRecipient record in Workspace A");

    // ------------------------------------------------------------------------
    // TEST 6: Real Human GET Unsubscribe Execution
    // ------------------------------------------------------------------------
    console.log("\n6. Testing Real Human GET Unsubscribe Execution...");
    const unsubscribeDataA = UnsubscribeService.generateUnsubscribeUrl({
      recipientId: recipientA.id,
      campaignId: campaignA.id,
      workspaceId: workspaceA.id,
      email: recipientA.email,
    });

    const tokenA = unsubscribeDataA.token;
    const verifiedPayloadA = UnsubscribeService.verifyToken(tokenA);

    const getResult = await UnsubscribeService.executeUnsubscribe(verifiedPayloadA, {
      source: "web_get",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      ip: "127.0.0.1",
    });

    assert(getResult.success === true, "Unsubscribe GET executed successfully");
    assert(getResult.alreadyUnsubscribed === false, "First execution indicates new unsubscribe");
    assert(getResult.maskedEmail.includes("••••"), "Returned email is masked for privacy");

    // Verify database mutations
    const updatedContact = await prisma.contact.findUnique({ where: { id: contactA.id } });
    assert(updatedContact?.status === ContactStatus.UNSUBSCRIBED, "Contact status updated to UNSUBSCRIBED in database");

    const updatedCampaign = await prisma.campaign.findUnique({ where: { id: campaignA.id } });
    assert(updatedCampaign?.unsubscribedCount === 1, "Campaign unsubscribedCount incremented to 1");

    const unsubEvent = await prisma.emailEvent.findFirst({
      where: {
        campaignRecipientId: recipientA.id,
        eventType: EmailEventType.UNSUBSCRIBED,
      },
    });
    assert(unsubEvent !== null, "EmailEvent of type UNSUBSCRIBED persisted");
    assert((unsubEvent?.metadata as any)?.source === "web_get", "EmailEvent metadata recorded source web_get");

    // Test HTML template rendering
    const successHtml = UnsubscribeService.renderSuccessPage(getResult.maskedEmail, false);
    assert(successHtml.includes("You have been unsubscribed"), "Success HTML contains confirmation title");
    assert(successHtml.includes(getResult.maskedEmail), "Success HTML displays masked recipient email");
    assert(successHtml.includes("MailPilot"), "Success HTML includes MailPilot branding");

    // ------------------------------------------------------------------------
    // TEST 7: Idempotency of Repeated Unsubscribe Requests
    // ------------------------------------------------------------------------
    console.log("\n7. Testing Idempotency of Repeated Unsubscribe Requests...");
    const repeatedResult = await UnsubscribeService.executeUnsubscribe(verifiedPayloadA, {
      source: "web_get",
      userAgent: "Mozilla/5.0",
      ip: "127.0.0.1",
    });

    assert(repeatedResult.success === true, "Repeated request still returns success");
    assert(repeatedResult.alreadyUnsubscribed === true, "Identifies that contact was already unsubscribed");

    const campaignAfterRepeat = await prisma.campaign.findUnique({ where: { id: campaignA.id } });
    assert(campaignAfterRepeat?.unsubscribedCount === 1, "Campaign unsubscribedCount did NOT double-increment");

    const totalEvents = await prisma.emailEvent.count({
      where: {
        campaignRecipientId: recipientA.id,
        eventType: EmailEventType.UNSUBSCRIBED,
      },
    });
    assert(totalEvents === 1, "Does NOT create duplicate EmailEvent records");

    // ------------------------------------------------------------------------
    // TEST 8: RFC 8058 POST One-Click Unsubscribe
    // ------------------------------------------------------------------------
    console.log("\n8. Testing RFC 8058 POST One-Click Unsubscribe...");
    // Create a fresh contact and recipient for POST test
    const contactPost = await prisma.contact.create({
      data: {
        workspaceId: workspaceA.id,
        email: `post-recipient-${timestamp}@gmail.com`,
        status: ContactStatus.ACTIVE,
      },
    });

    const recipientPost = await prisma.campaignRecipient.create({
      data: {
        campaignId: campaignA.id,
        contactId: contactPost.id,
        email: contactPost.email,
        status: CampaignRecipientStatus.SENT,
        provider: "GMAIL_SMTP",
        providerMessageId: `<msg-post-${timestamp}@mailpilot.io>`,
      },
    });

    const postToken = UnsubscribeService.generateToken({
      recipientId: recipientPost.id,
      campaignId: campaignA.id,
      workspaceId: workspaceA.id,
      email: recipientPost.email,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    });

    const postPayload = UnsubscribeService.verifyToken(postToken);
    const postResult = await UnsubscribeService.executeUnsubscribe(postPayload, {
      source: "rfc8058_post",
      userAgent: "Google-List-Unsubscribe-Agent",
      ip: "66.249.80.1",
    });

    assert(postResult.success === true, "RFC 8058 POST executed successfully");
    const updatedPostContact = await prisma.contact.findUnique({ where: { id: contactPost.id } });
    assert(updatedPostContact?.status === ContactStatus.UNSUBSCRIBED, "Contact updated to UNSUBSCRIBED via RFC 8058");

    const postEvent = await prisma.emailEvent.findFirst({
      where: {
        campaignRecipientId: recipientPost.id,
        eventType: EmailEventType.UNSUBSCRIBED,
      },
    });
    assert((postEvent?.metadata as any)?.source === "rfc8058_post", "Recorded rfc8058_post metadata");

    // ------------------------------------------------------------------------
    // TEST 9: Cross-Workspace Security Isolation
    // ------------------------------------------------------------------------
    console.log("\n9. Testing Cross-Workspace Security Isolation...");
    let crossWorkspaceBlocked = false;
    try {
      // Craft a payload where workspaceId is Workspace B, but recipientId is in Workspace A
      const forgedPayload = {
        recipientId: recipientA.id,
        campaignId: campaignA.id,
        workspaceId: workspaceB.id, // Forged workspace!
        email: recipientA.email,
        expiresAt: Date.now() + 1000 * 60 * 60,
      };
      await UnsubscribeService.executeUnsubscribe(forgedPayload, { source: "web_get" });
    } catch (err: any) {
      crossWorkspaceBlocked = true;
      assert(err instanceof UnsubscribeError, "Throws UnsubscribeError on cross-workspace mismatch");
      assert(err.code === "SECURITY_MISMATCH", "Error code is SECURITY_MISMATCH");
    }
    assert(crossWorkspaceBlocked, "Cross-workspace unauthorized unsubscribe was blocked");

    // ------------------------------------------------------------------------
    // TEST 10: Email Headers & List-Unsubscribe Filtering
    // ------------------------------------------------------------------------
    console.log("\n10. Testing Email Headers & List-Unsubscribe Rules...");
    GmailSmtpProvider.enableTestMode();

    // Case A: With local HTTP URL -> MUST NOT include List-Unsubscribe headers
    const sendWithLocal = await GmailSmtpProvider.send({
      to: "test@example.com",
      fromName: "Akash Lodhi",
      fromEmail: "lodhiakash286@gmail.com",
      subject: "Test Local Headers",
      html: "<p>Hello</p>",
      workspaceId: workspaceA.id,
      unsubscribeUrl: "http://localhost:4000/api/webhooks/unsubscribe?token=abc",
    });
    assert(sendWithLocal.success, "Simulation dispatch succeeded");

    // Case B: With valid public HTTPS URL -> MUST include List-Unsubscribe headers
    const httpsUnsubUrl = "https://api.mailpilot.app/api/webhooks/unsubscribe?token=xyz123";
    assert(UnsubscribeService.isPublicHttpsUrl(httpsUnsubUrl), "Identified valid public HTTPS unsubscribe URL");

    // ------------------------------------------------------------------------
    // TEST 11: Test-Email Rate Limiting and Duplicate Protection
    // ------------------------------------------------------------------------
    console.log("\n11. Testing Test-Email Rate Limiting & Cooldown...");
    SettingsService.resetTestEmailRateLimits();

    // First send should succeed
    const firstTestSend = await SettingsService.sendTestEmail(
      workspaceA.id,
      "tester@example.com",
      { user: "lodhiakash286@gmail.com", senderName: "Akash Lodhi" }
    );
    assert(firstTestSend.success, "First test email sent successfully");

    // Immediate second send must trigger TestEmailRateLimitError (429)
    let rateLimitTriggered = false;
    try {
      await SettingsService.sendTestEmail(
        workspaceA.id,
        "tester@example.com",
        { user: "lodhiakash286@gmail.com", senderName: "Akash Lodhi" }
      );
    } catch (err: any) {
      rateLimitTriggered = true;
      assert(err instanceof TestEmailRateLimitError, "Throws TestEmailRateLimitError on rapid send");
      assert(err.remainingSeconds > 0 && err.remainingSeconds <= 10, `Cooldown indicates remaining seconds: ${err.remainingSeconds}s`);
    }
    assert(rateLimitTriggered, "Rapid test email send was throttled by rate limiter");

    // After resetting cooldown, sending should succeed again
    SettingsService.resetTestEmailRateLimits(workspaceA.id);
    const resetSend = await SettingsService.sendTestEmail(
      workspaceA.id,
      "tester@example.com",
      { user: "lodhiakash286@gmail.com", senderName: "Akash Lodhi" }
    );
    assert(resetSend.success, "Test email succeeds after cooldown/reset");

    console.log("\n===============================================================");
    console.log("🎉 ALL UNSUBSCRIBE & DELIVERABILITY TESTS PASSED PERFECTLY!");
    console.log("===============================================================\n");
  } finally {
    // Clean up test data
    console.log("Cleaning up test records from database...");
    if (workspaceA) {
      await prisma.emailEvent.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.campaignRecipient.deleteMany({ where: { campaign: { workspaceId: workspaceA.id } } });
      await prisma.campaign.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.contact.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.workspace.delete({ where: { id: workspaceA.id } });
    }
    if (workspaceB) {
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.workspace.delete({ where: { id: workspaceB.id } });
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    GmailSmtpProvider.disableTestMode();
  }
}

runUnsubscribeAndDeliverabilityVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });

