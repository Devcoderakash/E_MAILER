import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { prisma } from "../config/database";
import { decryptCredential } from "../utils/crypto.util";
import { UnsubscribeService } from "../modules/webhooks/unsubscribe.service";

export interface SendEmailOptions {
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | null;
  preheader?: string | null;
  tags?: { name: string; value: string }[];
  workspaceId?: string;
  unsubscribeUrl?: string;
  isDeliverabilityTest?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  simulated: boolean;
  accepted?: boolean;
  isPermanentBounce?: boolean;
  isQuotaExceeded?: boolean;
  isAuthFailure?: boolean;
}

export interface ClassifiedSmtpError {
  code: string;
  message: string;
  isPermanentBounce: boolean;
  isQuotaExceeded: boolean;
  isAuthFailure: boolean;
}

export interface CustomSmtpCredentials {
  user: string;
  pass: string;
  host?: string;
  port?: number;
  secure?: boolean;
  senderName?: string;
}

export class GmailSmtpProvider {
  private static defaultTransporter: Transporter | null = null;
  private static testMode = false;
  private static testMockHandler?: (options: SendEmailOptions) => Promise<SendEmailResult>;

  /**
   * Enable test mode for automated test suites.
   */
  public static enableTestMode(handler?: (options: SendEmailOptions) => Promise<SendEmailResult>): void {
    this.testMode = true;
    this.testMockHandler = handler;
  }

  /**
   * Disable test mode and return to live SMTP behavior.
   */
  public static disableTestMode(): void {
    this.testMode = false;
    this.testMockHandler = undefined;
  }

  /**
   * Check if test mode is active.
   */
  public static isTestModeEnabled(): boolean {
    return this.testMode || process.env.GMAIL_SMTP_SIMULATION_MODE === "true";
  }

  /**
   * Check if system default Gmail SMTP credentials are configured and valid.
   */
  public static isConfigured(): boolean {
    const user = env.GMAIL_SMTP_USER;
    const pass = env.GMAIL_SMTP_APP_PASSWORD;

    if (!user || user.trim() === "") return false;
    if (!pass || pass.trim() === "") return false;

    const trimmedPass = pass.trim();
    if (
      trimmedPass.includes("placeholder") ||
      trimmedPass.includes("your_16_char") ||
      trimmedPass === "your_app_password"
    ) {
      return false;
    }

    return true;
  }

  /**
   * Clean 16-character App Password (remove spaces if user copied "abcd efgh ijkl mnop")
   */
  public static normalizeAppPassword(raw: string): string {
    return raw.replace(/\s+/g, "");
  }

  /**
   * Create an ad-hoc Nodemailer transporter for custom credentials
   */
  public static createTransporter(credentials: CustomSmtpCredentials): Transporter {
    const cleanPass = this.normalizeAppPassword(credentials.pass);
    const host = credentials.host || env.GMAIL_SMTP_HOST;
    const port = credentials.port || env.GMAIL_SMTP_PORT;
    // Auto-align secure flag: 465 requires SSL/TLS (secure: true); 587 requires STARTTLS (secure: false)
    const secure = port === 465 ? true : port === 587 ? false : (credentials.secure ?? env.GMAIL_SMTP_SECURE);

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: credentials.user,
        pass: cleanPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: true,
      },
    });
  }

  /**
   * Get transporter for a specific workspace or fallback to default
   */
  public static async getTransporterForWorkspace(workspaceId?: string): Promise<{
    transporter: Transporter;
    user: string;
    senderName: string;
    replyTo?: string | null;
    credentials: CustomSmtpCredentials;
  } | null> {
    if (workspaceId) {
      try {
        const workspaceConfig = await prisma.workspaceSmtpConfig.findUnique({
          where: { workspaceId },
        });

        if (workspaceConfig && workspaceConfig.user && workspaceConfig.encryptedPassword) {
          const decryptedPass = decryptCredential(workspaceConfig.encryptedPassword);
          const creds: CustomSmtpCredentials = {
            user: workspaceConfig.user,
            pass: decryptedPass,
            host: workspaceConfig.host,
            port: workspaceConfig.port,
            secure: workspaceConfig.secure,
            senderName: workspaceConfig.senderName,
          };
          const customTransporter = this.createTransporter(creds);

          return {
            transporter: customTransporter,
            user: workspaceConfig.user,
            senderName: workspaceConfig.senderName || env.GMAIL_SENDER_NAME || "MailPilot",
            replyTo: workspaceConfig.replyTo,
            credentials: creds,
          };
        }
      } catch (err) {
        console.warn(`[GmailSmtpProvider] Could not load workspace SMTP config for ${workspaceId}, falling back to env.`);
      }
    }

    // Fallback to environment credentials
    if (!this.isConfigured()) return null;

    const envCreds: CustomSmtpCredentials = {
      user: env.GMAIL_SMTP_USER!,
      pass: env.GMAIL_SMTP_APP_PASSWORD!,
      host: env.GMAIL_SMTP_HOST,
      port: env.GMAIL_SMTP_PORT,
      secure: env.GMAIL_SMTP_SECURE,
      senderName: env.GMAIL_SENDER_NAME,
    };

    if (!this.defaultTransporter) {
      this.defaultTransporter = this.createTransporter(envCreds);
    }

    return {
      transporter: this.defaultTransporter,
      user: env.GMAIL_SMTP_USER!,
      senderName: env.GMAIL_SENDER_NAME || "MailPilot",
      credentials: envCreds,
    };
  }

  /**
   * Verify an SMTP connection using either specific credentials, workspace config, or env fallback.
   */
  public static async verifyConnection(
    credentials?: CustomSmtpCredentials,
    workspaceId?: string
  ): Promise<{ healthy: boolean; error?: string }> {
    try {
      let transporter: Transporter;
      let creds: CustomSmtpCredentials;

      if (credentials) {
        if (!credentials.user || !credentials.pass) {
          return { healthy: false, error: "Gmail address and App Password are required." };
        }
        creds = credentials;
        transporter = this.createTransporter(credentials);
      } else {
        const resolved = await this.getTransporterForWorkspace(workspaceId);
        if (!resolved) {
          return {
            healthy: false,
            error: "Gmail SMTP is unconfigured. Set credentials in Settings or configure GMAIL_SMTP_* in .env.",
          };
        }
        creds = resolved.credentials;
        transporter = resolved.transporter;
      }

      try {
        await transporter.verify();
        return { healthy: true };
      } catch (err: any) {
        const currentPort = creds.port || env.GMAIL_SMTP_PORT;
        const fallbackPort = currentPort === 465 ? 587 : 465;
        console.warn(
          `[GmailSmtpProvider] verifyConnection on port ${currentPort} failed (${err.message}). Testing failover port ${fallbackPort}...`
        );

        try {
          const fallbackTransporter = this.createTransporter({
            ...creds,
            port: fallbackPort,
            secure: fallbackPort === 465,
          });
          await fallbackTransporter.verify();
          this.defaultTransporter = fallbackTransporter;
          return { healthy: true };
        } catch (_fallbackErr) {
          const sanitized = this.classifySmtpError(err);
          return { healthy: false, error: sanitized.message };
        }
      }
    } catch (err: any) {
      const sanitized = this.classifySmtpError(err);
      return { healthy: false, error: sanitized.message };
    }
  }

  /**
   * Produce a clean, structured plain-text fallback for multipart/alternative MIME.
   * Multipart messages containing both text/plain and text/html are strongly favored by Gmail spam filters.
   */
  public static generatePlainText(
    html: string,
    options?: { preheader?: string | null; unsubscribeUrl?: string }
  ): string {
    if (!html) return "";

    let text = html;

    // Remove head, style, script blocks
    text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

    // Convert link anchors to readable text + URL
    text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, url, linkContent) => {
      const cleanLabel = linkContent.replace(/<[^>]+>/g, "").trim();
      if (!cleanLabel || cleanLabel === url) return url;
      return `${cleanLabel} (${url})`;
    });

    // Convert headings
    text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n\n$1\n");

    // Convert list items
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n• $1");

    // Convert breaks and block elements
    text = text.replace(/<br\s*[\/]?>/gi, "\n");
    text = text.replace(/<\/(p|div|tr|table|blockquote)>/gi, "\n\n");

    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&copy;/g, "©");

    // Normalize spacing
    text = text
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Include preheader snippet at the beginning if provided
    if (options?.preheader && options.preheader.trim()) {
      text = `${options.preheader.trim()}\n\n${text}`;
    }

    // Include plain-text unsubscribe notice if URL provided
    if (options?.unsubscribeUrl) {
      text += `\n\n---\nTo unsubscribe from these emails, visit:\n${options.unsubscribeUrl}`;
    }

    return text;
  }

  /**
   * Backwards-compatible alias for stripHtml
   */
  public static stripHtml(html: string): string {
    return this.generatePlainText(html);
  }

  /**
   * Dispatches email via Gmail SMTP (Nodemailer)
   */
  public static async send(
    options: SendEmailOptions,
    meta?: { isTest?: boolean }
  ): Promise<SendEmailResult> {
    // 1. Check for test mode simulation
    if (this.isTestModeEnabled() || meta?.isTest) {
      if (this.testMockHandler) {
        return await this.testMockHandler(options);
      }
      return {
        success: true,
        messageId: `gmail_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        simulated: true,
        accepted: true,
      };
    }

    // 2. Resolve transporter (workspace config or environment fallback)
    const resolved = await this.getTransporterForWorkspace(options.workspaceId);
    if (!resolved) {
      return {
        success: false,
        error:
          "Gmail SMTP delivery provider is unconfigured. Set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD in .env or configure in Settings.",
        errorCode: "PROVIDER_UNCONFIGURED",
        simulated: false,
      };
    }

    const { transporter, user: authenticatedUser, senderName: defaultSenderName } = resolved;

    // Sender Identity: Authenticated address ensures SPF/DKIM alignment with Google SMTP.
    // Display name is sanitized to prevent RFC 5322 header injection and avoid misleading impersonation.
    const fromAddress = authenticatedUser;
    const rawDisplayName = options.fromName || defaultSenderName || "MailPilot";
    const sanitizedDisplayName = rawDisplayName.replace(/[\r\n"]/g, "").trim() || "MailPilot";
    const formattedFrom = `"${sanitizedDisplayName}" <${fromAddress}>`;

    // Process HTML & Unsubscribe Link
    let finalHtml = options.html;

    // Auto-append compliant unsubscribe footer if URL provided and not already linked
    if (options.unsubscribeUrl && !finalHtml.includes(options.unsubscribeUrl)) {
      finalHtml += `
<div style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  You are receiving this communication from ${sanitizedDisplayName}.<br />
  <a href="${options.unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a> from future broadcast emails.
</div>`;
    }

    // Add hidden inbox preheader snippet if provided
    if (options.preheader && options.preheader.trim()) {
      const preheaderHtml = `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${options.preheader}</div>`;
      finalHtml = preheaderHtml + finalHtml;
    }

    // Generate rich multipart plain-text alternative
    const plainText =
      options.text ||
      this.generatePlainText(finalHtml, {
        preheader: options.preheader,
        unsubscribeUrl: options.unsubscribeUrl,
      });

    // Email Headers:
    // Strip unnecessary automation headers (X-Mailer, X-Auto-Response-Suppress, X-campaign_id, X-workspace_id)
    // to keep personal Gmail SMTP messages clean. Tracking is preserved in PostgreSQL logs.
    const headers: Record<string, string> = {};

    // Only inject List-Unsubscribe and List-Unsubscribe-Post headers when the unsubscribe URL
    // is a valid, publicly reachable HTTPS URL (RFC 8058 requirement). Localhost/HTTP URLs are omitted from headers.
    if (UnsubscribeService.isPublicHttpsUrl(options.unsubscribeUrl)) {
      headers["List-Unsubscribe"] = `<${options.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    // Valid Reply-To handling
    let replyToAddress: string | undefined = undefined;
    if (options.replyTo && options.replyTo.includes("@")) {
      replyToAddress = options.replyTo.trim();
    }

    try {
      let info: any;
      try {
        info = await transporter.sendMail({
          from: formattedFrom,
          to: options.to,
          subject: options.subject,
          html: finalHtml,
          text: plainText,
          replyTo: replyToAddress,
          headers,
        });
      } catch (sendErr: any) {
        const isConnectionIssue =
          sendErr?.code === "ECONNREFUSED" ||
          sendErr?.code === "ETIMEDOUT" ||
          sendErr?.code === "ESOCKET" ||
          sendErr?.code === "ECONNRESET" ||
          sendErr?.code === "ENOTFOUND" ||
          String(sendErr?.message || "").toLowerCase().includes("timeout") ||
          String(sendErr?.message || "").toLowerCase().includes("connect");

        const currentPort = resolved.credentials.port || env.GMAIL_SMTP_PORT;

        if (isConnectionIssue) {
          const fallbackPort = currentPort === 465 ? 587 : 465;
          console.warn(
            `[GmailSmtpProvider] Outbound connection on port ${currentPort} failed (${sendErr.message}). Auto-failing over to Port ${fallbackPort} (${fallbackPort === 465 ? "SSL/TLS" : "STARTTLS"})...`
          );

          const fallbackTransporter = this.createTransporter({
            ...resolved.credentials,
            port: fallbackPort,
            secure: fallbackPort === 465,
          });

          info = await fallbackTransporter.sendMail({
            from: formattedFrom,
            to: options.to,
            subject: options.subject,
            html: finalHtml,
            text: plainText,
            replyTo: replyToAddress,
            headers,
          });

          // Cache working fallback transporter so subsequent sends don't hit the failed port
          this.defaultTransporter = fallbackTransporter;
        } else {
          throw sendErr;
        }
      }

      // Nodemailer returns messageId upon SMTP server acceptance
      const messageId = info?.messageId || `<${Date.now()}@gmail.com>`;

      return {
        success: true,
        messageId,
        simulated: false,
        accepted: true,
      };
    } catch (err: any) {
      const sanitized = this.classifySmtpError(err);
      return {
        success: false,
        error: sanitized.message,
        errorCode: sanitized.code,
        isPermanentBounce: sanitized.isPermanentBounce,
        isQuotaExceeded: sanitized.isQuotaExceeded,
        isAuthFailure: sanitized.isAuthFailure,
        simulated: false,
      };
    }
  }

  /**
   * Classify Nodemailer / Google SMTP error response codes safely without leaking credentials.
   * Identifies permanent hard bounces for automatic contact suppression.
   */
  public static classifySmtpError(err: any): ClassifiedSmtpError {
    const rawMessage = String(err?.message || "");
    const responseCode = err?.responseCode || err?.code;
    const lowerMessage = rawMessage.toLowerCase();

    // 535: Authentication Failed (Invalid Google App Password or 2FA required)
    if (
      responseCode === 535 ||
      rawMessage.includes("535") ||
      rawMessage.includes("BadCredentials") ||
      rawMessage.includes("Username and Password not accepted")
    ) {
      return {
        code: "AUTH_FAILED",
        message:
          "Gmail SMTP authentication failed. Please verify your 16-character Google App Password (2-Step Verification must be enabled on your Google Account).",
        isPermanentBounce: false,
        isQuotaExceeded: false,
        isAuthFailure: true,
      };
    }

    // 550 5.4.5 / 452: Daily sending quota exceeded
    if (
      responseCode === 550 &&
      (rawMessage.includes("5.4.5") ||
        lowerMessage.includes("daily sending quota exceeded") ||
        lowerMessage.includes("user-sending quota"))
    ) {
      return {
        code: "QUOTA_EXCEEDED",
        message:
          "Google daily sending quota exceeded (500 emails/day for personal Gmail, 2,000/day for Google Workspace).",
        isPermanentBounce: false,
        isQuotaExceeded: true,
        isAuthFailure: false,
      };
    }

    // Permanent Hard Bounces (550 5.1.1, User Unknown, Mailbox not found, 553, 501)
    if (
      responseCode === 550 ||
      responseCode === 551 ||
      responseCode === 553 ||
      responseCode === 554 ||
      responseCode === 501 ||
      lowerMessage.includes("5.1.1") ||
      lowerMessage.includes("5.1.2") ||
      lowerMessage.includes("user unknown") ||
      lowerMessage.includes("mailbox unavailable") ||
      lowerMessage.includes("recipient rejected") ||
      lowerMessage.includes("does not exist") ||
      lowerMessage.includes("no such user")
    ) {
      return {
        code: "PERMANENT_BOUNCE",
        message: `Recipient address was permanently rejected by destination server: ${rawMessage.substring(0, 120)}`,
        isPermanentBounce: true,
        isQuotaExceeded: false,
        isAuthFailure: false,
      };
    }

    // Connection errors
    if (
      err?.code === "ECONNREFUSED" ||
      err?.code === "ETIMEDOUT" ||
      err?.code === "ESOCKET" ||
      err?.code === "ECONNRESET" ||
      err?.code === "ENOTFOUND" ||
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("connect econnrefused") ||
      lowerMessage.includes("connect etimedout") ||
      lowerMessage.includes("failed to connect")
    ) {
      return {
        code: "CONNECTION_FAILED",
        message: `Failed to connect to Google SMTP host (${env.GMAIL_SMTP_HOST}:${env.GMAIL_SMTP_PORT}). Check network connectivity.`,
        isPermanentBounce: false,
        isQuotaExceeded: false,
        isAuthFailure: false,
      };
    }

    return {
      code: "SMTP_ERROR",
      message: this.sanitizeErrorMessage(err),
      isPermanentBounce: false,
      isQuotaExceeded: false,
      isAuthFailure: false,
    };
  }

  /**
   * Sanitize error message to ensure no passwords or sensitive tokens are logged
   */
  public static sanitizeErrorMessage(err: any): string {
    let msg = String(err?.message || "Unknown SMTP error occurred");
    if (env.GMAIL_SMTP_APP_PASSWORD) {
      msg = msg.replace(new RegExp(env.GMAIL_SMTP_APP_PASSWORD, "g"), "[REDACTED]");
    }
    return msg.substring(0, 250);
  }

  /**
   * Interpolate merge tags (e.g. {{first_name}}, {{company|there}}) in email subjects or HTML bodies
   * Supports camelCase, snake_case, and fallback values like {{first_name|there}}.
   */
  public static interpolateMergeTags(
    template: string,
    tags: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      company?: string | null;
      subject?: string | null;
      unsubscribe_url?: string | null;
      unsubscribeUrl?: string | null;
      [key: string]: string | null | undefined;
    }
  ): string {
    if (!template) return "";

    // Normalize incoming tags into lookup map supporting camelCase and snake_case
    const lookup: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (value !== undefined && value !== null) {
        const strVal = String(value);
        lookup[key.toLowerCase()] = strVal;
        lookup[key.toLowerCase().replace(/[-_]/g, "")] = strVal;
      }
    }

    // Common aliases
    if (tags.firstName) {
      lookup["first_name"] = tags.firstName;
      lookup["firstname"] = tags.firstName;
    }
    if (tags.lastName) {
      lookup["last_name"] = tags.lastName;
      lookup["lastname"] = tags.lastName;
    }
    if (tags.unsubscribe_url || tags.unsubscribeUrl) {
      const u = tags.unsubscribe_url || tags.unsubscribeUrl || "";
      lookup["unsubscribe_url"] = u;
      lookup["unsubscribeurl"] = u;
    }

    // Match {{tag}} or {{tag | fallback}}
    return template.replace(
      /\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g,
      (_match, rawKey, fallback) => {
        const normalizedKey = rawKey.toLowerCase();
        const strippedKey = normalizedKey.replace(/[-_]/g, "");

        const value = lookup[normalizedKey] ?? lookup[strippedKey];
        if (value !== undefined && value.trim() !== "") {
          return value;
        }

        // Fallback provided? e.g. {{first_name|there}}
        if (fallback !== undefined) {
          return fallback.trim();
        }

        // Missing and no fallback: return empty string instead of raw {{...}}
        return "";
      }
    );
  }
}
