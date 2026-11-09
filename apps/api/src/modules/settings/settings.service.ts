import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { GmailSmtpProvider, CustomSmtpCredentials } from "../../providers/gmail-smtp.provider";
import { encryptCredential, decryptCredential, maskSecret } from "../../utils/crypto.util";

export interface SmtpConfigInput {
  user: string;
  appPassword?: string;
  senderName?: string;
  replyTo?: string | null;
  host?: string;
  port?: number;
  secure?: boolean;
}

export class TestEmailRateLimitError extends Error {
  public remainingSeconds: number;
  constructor(remainingSeconds: number) {
    super(`Please wait ${remainingSeconds} seconds before sending another test email to protect your sender reputation.`);
    this.name = "TestEmailRateLimitError";
    this.remainingSeconds = remainingSeconds;
  }
}

// Memory rate limit and in-flight tracking for test emails
const testEmailCooldowns = new Map<string, number>();
const testEmailInFlight = new Set<string>();
const TEST_EMAIL_COOLDOWN_MS = 10000; // 10 seconds between test sends per workspace

export class SettingsService {
  /**
   * Get SMTP configuration status for workspace
   */
  public static async getSmtpConfig(workspaceId: string) {
    const config = await prisma.workspaceSmtpConfig.findUnique({
      where: { workspaceId },
    });

    if (config) {
      return {
        configured: true,
        source: "workspace" as const,
        user: config.user,
        senderName: config.senderName,
        replyTo: config.replyTo,
        host: config.host,
        port: config.port,
        secure: config.secure,
        isVerified: config.isVerified,
        lastVerifiedAt: config.lastVerifiedAt,
        maskedPassword: maskSecret("1234567890123456"),
      };
    }

    // Check environment fallback
    if (GmailSmtpProvider.isConfigured()) {
      return {
        configured: true,
        source: "environment" as const,
        user: env.GMAIL_SMTP_USER,
        senderName: env.GMAIL_SENDER_NAME,
        replyTo: null,
        host: env.GMAIL_SMTP_HOST,
        port: env.GMAIL_SMTP_PORT,
        secure: env.GMAIL_SMTP_SECURE,
        isVerified: true,
        lastVerifiedAt: null,
        maskedPassword: "•••• •••• •••• ••••",
      };
    }

    return {
      configured: false,
      source: "none" as const,
      user: null,
      senderName: "MailPilot",
      replyTo: null,
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      isVerified: false,
      lastVerifiedAt: null,
      maskedPassword: null,
    };
  }

  /**
   * Save or update workspace Gmail SMTP credentials
   */
  public static async saveSmtpConfig(workspaceId: string, input: SmtpConfigInput) {
    const cleanUser = input.user?.trim();
    if (!cleanUser || !cleanUser.includes("@")) {
      throw new Error("A valid Gmail or Google Workspace email address is required.");
    }

    const cleanPass = input.appPassword ? GmailSmtpProvider.normalizeAppPassword(input.appPassword) : null;
    
    // Check if updating without providing new password
    const existing = await prisma.workspaceSmtpConfig.findUnique({
      where: { workspaceId },
    });

    if (!cleanPass && !existing) {
      throw new Error("A 16-character Google App Password is required.");
    }

    const encryptedPassword = cleanPass
      ? encryptCredential(cleanPass)
      : existing!.encryptedPassword;

    // Verify password before saving if a new one is provided
    if (cleanPass) {
      if (cleanPass.length < 16) {
        throw new Error("Google App Passwords are 16 characters long. Please check your password.");
      }
    }

    const config = await prisma.workspaceSmtpConfig.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        user: cleanUser,
        encryptedPassword,
        senderName: input.senderName?.trim() || "MailPilot",
        replyTo: input.replyTo?.trim() || null,
        host: input.host || "smtp.gmail.com",
        port: input.port || 587,
        secure: input.secure ?? false,
        isVerified: false,
      },
      update: {
        user: cleanUser,
        encryptedPassword,
        senderName: input.senderName?.trim() || "MailPilot",
        replyTo: input.replyTo?.trim() || null,
        host: input.host || "smtp.gmail.com",
        port: input.port || 587,
        secure: input.secure ?? false,
      },
    });

    return {
      success: true,
      user: config.user,
      senderName: config.senderName,
      isVerified: config.isVerified,
    };
  }

  /**
   * Test SMTP Connection (Nodemailer verify)
   */
  public static async testSmtpConnection(workspaceId: string, credentials?: SmtpConfigInput) {
    let credsToTest: CustomSmtpCredentials | undefined;

    if (credentials?.user && credentials?.appPassword) {
      credsToTest = {
        user: credentials.user.trim(),
        pass: credentials.appPassword.trim(),
        host: credentials.host || "smtp.gmail.com",
        port: credentials.port || 587,
        secure: credentials.secure ?? false,
        senderName: credentials.senderName,
      };
    }

    const result = await GmailSmtpProvider.verifyConnection(credsToTest, workspaceId);

    if (result.healthy) {
      // Mark as verified in database if workspace config exists
      await prisma.workspaceSmtpConfig.updateMany({
        where: { workspaceId },
        data: {
          isVerified: true,
          lastVerifiedAt: new Date(),
        },
      });
    }

    return result;
  }

  /**
   * Reset rate limit state (primarily for automated test environments)
   */
  public static resetTestEmailRateLimits(workspaceId?: string) {
    if (workspaceId) {
      testEmailCooldowns.delete(workspaceId);
      testEmailInFlight.delete(workspaceId);
    } else {
      testEmailCooldowns.clear();
      testEmailInFlight.clear();
    }
  }

  /**
   * Send a real test email via Gmail SMTP with rate limiting and duplicate send protection
   */
  public static async sendTestEmail(workspaceId: string, toEmail: string, customCreds?: SmtpConfigInput) {
    const cleanTo = toEmail?.trim();
    if (!cleanTo || !cleanTo.includes("@")) {
      throw new Error("A valid recipient email address is required.");
    }

    // 1. In-flight Lock: Prevent concurrent duplicate test sends
    if (testEmailInFlight.has(workspaceId)) {
      throw new Error("A test email is already being sent for this workspace. Please wait a moment.");
    }

    // 2. Rate Limiting: Prevent rapid-fire test sends that trigger Google SMTP burst flags
    const now = Date.now();
    const lastSent = testEmailCooldowns.get(workspaceId);
    if (lastSent && now - lastSent < TEST_EMAIL_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((TEST_EMAIL_COOLDOWN_MS - (now - lastSent)) / 1000);
      throw new TestEmailRateLimitError(remainingSeconds);
    }

    testEmailInFlight.add(workspaceId);

    try {
      // Resolve sender credentials
      let senderEmail = env.GMAIL_SMTP_USER || "noreply@mailpilot.io";
      let senderName = env.GMAIL_SENDER_NAME || "MailPilot";

      if (customCreds?.user) {
        senderEmail = customCreds.user;
        senderName = customCreds.senderName || senderName;
      } else {
        const existing = await prisma.workspaceSmtpConfig.findUnique({
          where: { workspaceId },
        });
        if (existing) {
          senderEmail = existing.user;
          senderName = existing.senderName;
        }
      }

      // Natural, concise test email content without spam trigger words (no "Congratulations!", no "Google Engine")
      const testSubject = `MailPilot test message`;
      const testHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <p style="margin-top: 0; font-size: 16px; font-weight: 600; color: #0f172a;">MailPilot Delivery Test</p>
  <p>Hello,</p>
  <p>This is a quick test email to verify that your email delivery configuration is working properly.</p>
  <div style="background-color: #f8fafc; border-radius: 6px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #475569; border-left: 3px solid #6366f1;">
    <div style="margin-bottom: 4px;"><strong>Sender:</strong> ${senderEmail}</div>
    <div><strong>Recipient:</strong> ${cleanTo}</div>
  </div>
  <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
    If you received this message, your SMTP settings are configured correctly.
  </p>
</div>`;

      const testText = `MailPilot Delivery Test

Hello,

This is a quick test email to verify that your email delivery configuration is working properly.

Sender: ${senderEmail}
Recipient: ${cleanTo}

If you received this message, your SMTP settings are configured correctly.`;

      const sendResult = await GmailSmtpProvider.send({
        to: cleanTo,
        fromName: senderName,
        fromEmail: senderEmail,
        subject: testSubject,
        html: testHtml,
        text: testText,
        workspaceId,
        preheader: "Delivery test from your MailPilot account.",
      });

      // Update cooldown timestamp upon send attempt
      testEmailCooldowns.set(workspaceId, Date.now());

      return sendResult;
    } finally {
      testEmailInFlight.delete(workspaceId);
    }
  }

  /**
   * Reset / delete workspace SMTP settings
   */
  public static async deleteSmtpConfig(workspaceId: string) {
    await prisma.workspaceSmtpConfig.deleteMany({
      where: { workspaceId },
    });
    return { success: true, message: "Workspace SMTP configuration reset to system default." };
  }
}

