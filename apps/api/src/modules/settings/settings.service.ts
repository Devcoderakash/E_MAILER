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
   * Send a real test email via Gmail SMTP
   */
  public static async sendTestEmail(workspaceId: string, toEmail: string, customCreds?: SmtpConfigInput) {
    const cleanTo = toEmail?.trim();
    if (!cleanTo || !cleanTo.includes("@")) {
      throw new Error("A valid recipient email address is required.");
    }

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

    const testSubject = `[MailPilot] Live Gmail SMTP Delivery Test — ${new Date().toLocaleTimeString()}`;
    const testHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">MailPilot SMTP Verification Successful</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Congratulations! Your Google SMTP delivery connection is configured correctly and operational.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #0f172a;"><strong>Authenticated Sender:</strong> ${senderEmail}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #0f172a;"><strong>Recipient:</strong> ${cleanTo}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #0f172a;"><strong>Dispatched At:</strong> ${new Date().toISOString()}</p>
        </div>
        <p style="color: #64748b; font-size: 13px;">
          This email was sent via Gmail SMTP through MailPilot's Google Engine.
        </p>
      </div>
    `;

    const sendResult = await GmailSmtpProvider.send({
      to: cleanTo,
      fromName: senderName,
      fromEmail: senderEmail,
      subject: testSubject,
      html: testHtml,
      workspaceId,
      preheader: "Your Google SMTP delivery connection is working perfectly.",
    });

    return sendResult;
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

