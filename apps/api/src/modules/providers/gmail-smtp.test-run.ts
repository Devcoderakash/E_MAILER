import { GmailSmtpProvider } from "../../providers/gmail-smtp.provider";
import { encryptCredential, decryptCredential, maskSecret } from "../../utils/crypto.util";
import { SettingsService } from "../settings/settings.service";
import { prisma } from "../../config/database";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` - ${details}` : ""}`);
    testsFailed++;
  }
}

async function run() {
  console.log("\n🧪 STARTING GMAIL SMTP & SECURITY COMPREHENSIVE TEST SUITE\n");

  const testWorkspaceId = `test_ws_smtp_${Date.now()}`;
  const testUserId = `test_user_smtp_${Date.now()}`;

  try {
    // 1. Password Normalization
    console.log("--- 1. Password Normalization & Formatting ---");
    const formattedPass = "abcd efgh ijkl mnop";
    const normalized = GmailSmtpProvider.normalizeAppPassword(formattedPass);
    assert(normalized === "abcdefghijklmnop", "Normalizes 16-char App Password by stripping whitespace");

    // 2. AES-256-GCM Encryption / Decryption Roundtrip
    console.log("--- 2. AES-256-GCM Cryptographic Security ---");
    const secret = "google-app-password-16-chars";
    const encrypted = encryptCredential(secret);
    assert(encrypted !== secret, "App Password is encrypted (not stored plaintext)");
    assert(encrypted.split(":").length === 3, "Encrypted payload contains IV, AuthTag, and Ciphertext");

    const decrypted = decryptCredential(encrypted);
    assert(decrypted === secret, "Decryption reproduces original secret exactly");

    const masked = maskSecret("abcdefghijklmnop");
    assert(masked === "abcd •••• •••• mnop", "App password masking displays only safe head and tail characters");

    // 3. Error Classification
    console.log("--- 3. Google SMTP Error Classification ---");
    const authErr = GmailSmtpProvider.classifySmtpError({ responseCode: 535, message: "535 5.7.8 Username and Password not accepted" });
    assert(authErr.code === "AUTH_FAILED", "Classifies 535 response as AUTH_FAILED");

    const quotaErr = GmailSmtpProvider.classifySmtpError({ responseCode: 550, message: "550 5.4.5 Daily sending quota exceeded" });
    assert(quotaErr.code === "QUOTA_EXCEEDED", "Classifies 550 5.4.5 response as QUOTA_EXCEEDED");

    const connErr = GmailSmtpProvider.classifySmtpError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" });
    assert(connErr.code === "CONNECTION_FAILED", "Classifies ECONNREFUSED as CONNECTION_FAILED");

    const rcptErr = GmailSmtpProvider.classifySmtpError({ responseCode: 553, message: "553 Relaying disallowed" });
    assert(rcptErr.code === "RECIPIENT_REJECTED", "Classifies 553 as RECIPIENT_REJECTED");

    // 4. Merge Tag Interpolation & Plaintext Generation
    console.log("--- 4. Merge Tags & HTML Stripping ---");
    const template = "Hello {{firstName}} {{lastName}}, welcome to {{company}}!";
    const interpolated = GmailSmtpProvider.interpolateMergeTags(template, {
      firstName: "Jane",
      lastName: "Doe",
      company: "Acme Corp",
    });
    assert(interpolated === "Hello Jane Doe, welcome to Acme Corp!", "Interpolates firstName, lastName, and company tags");

    const html = "<p>Welcome to <strong>MailPilot</strong>!<br />Click <a href='#'>here</a>.</p>";
    const textFallback = GmailSmtpProvider.stripHtml(html);
    assert(!textFallback.includes("<") && textFallback.includes("Welcome to MailPilot!"), "Produces clean plain-text fallback without HTML tags");

    // 5. Test Mode Send
    console.log("--- 5. Gmail SMTP Test Mode Dispatch ---");
    GmailSmtpProvider.enableTestMode();
    const sendRes = await GmailSmtpProvider.send({
      to: "recipient@example.com",
      fromName: "MailPilot Team",
      fromEmail: "sender@gmail.com",
      subject: "Test Email",
      html: "<p>Hello</p>",
    });

    assert(sendRes.success === true, "Test mode send succeeds");
    assert(sendRes.simulated === true, "Marks test mode email as simulated");
    assert(sendRes.accepted === true, "Marks email as accepted by SMTP");
    assert(typeof sendRes.messageId === "string" && sendRes.messageId.startsWith("gmail_test_"), "Generates valid provider message ID");
    GmailSmtpProvider.disableTestMode();

    // 6. Settings Service Workspace Integration
    console.log("--- 6. Workspace SMTP Settings Lifecycle ---");
    // Setup test user & workspace in DB
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        supabaseId: `sb_${Date.now()}`,
        email: `test_smtp_${Date.now()}@example.com`,
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        id: testWorkspaceId,
        name: "SMTP Test Workspace",
        slug: `smtp-ws-${Date.now()}`,
        ownerId: user.id,
      },
    });

    // Save workspace SMTP credentials
    const saveRes = await SettingsService.saveSmtpConfig(workspace.id, {
      user: "workspace-sender@gmail.com",
      appPassword: "abcd efgh ijkl mnop",
      senderName: "Custom Workspace Sender",
    });

    assert(saveRes.success === true, "Saves workspace SMTP configuration");
    assert(saveRes.user === "workspace-sender@gmail.com", "Preserves configured user email");

    // Retrieve workspace SMTP config
    const configRes = await SettingsService.getSmtpConfig(workspace.id);
    assert(configRes.configured === true, "Reports workspace SMTP as configured");
    assert(configRes.source === "workspace", "Identifies config source as workspace");
    assert(configRes.user === "workspace-sender@gmail.com", "Returns saved sender user");
    assert(configRes.maskedPassword !== null, "Returns masked password representation");

    // Delete workspace SMTP config
    const delRes = await SettingsService.deleteSmtpConfig(workspace.id);
    assert(delRes.success === true, "Deletes workspace SMTP config cleanly");

    const afterDelConfig = await SettingsService.getSmtpConfig(workspace.id);
    assert(afterDelConfig.source !== "workspace", "Reverts from workspace config after deletion");

  } catch (err: any) {
    console.error("❌ Exception during test suite:", err);
    testsFailed++;
  } finally {
    // Cleanup
    try {
      await prisma.workspaceSmtpConfig.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch (_) {}

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log(`========================================\n`);

    if (testsFailed > 0) {
      process.exit(1);
    }
  }
}

run();

