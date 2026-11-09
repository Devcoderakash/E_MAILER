import crypto from "crypto";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { ContactStatus, EmailEventType } from "@prisma/client";

export class UnsubscribeError extends Error {
  constructor(message: string, public code: "INVALID_TOKEN" | "EXPIRED_TOKEN" | "SECURITY_MISMATCH" | "NOT_FOUND") {
    super(message);
    this.name = "UnsubscribeError";
  }
}

export interface UnsubscribeTokenPayload {
  recipientId: string;
  campaignId: string;
  workspaceId: string;
  email: string;
  expiresAt: number;
}

interface CompactTokenPayload {
  r: string; // recipientId
  c: string; // campaignId
  w: string; // workspaceId
  e: string; // email
  exp: number; // expiresAt
  iat: number; // issuedAt
}

export class UnsubscribeService {
  /**
   * Derive a 32-byte Buffer key from configured encryption secrets
   */
  private static getKey(): Buffer {
    const secret =
      env.CREDENTIAL_ENCRYPTION_KEY ||
      env.TOKEN_ENCRYPTION_KEY ||
      env.ENCRYPTION_KEY ||
      "mailpilot-secure-encryption-key-32-bytes-minimum!";
    return crypto.createHash("sha256").update(secret).digest();
  }

  /**
   * Generates a tamper-resistant, AES-256-GCM encrypted unsubscribe token
   */
  public static generateToken(payload: UnsubscribeTokenPayload): string {
    const compact: CompactTokenPayload = {
      r: payload.recipientId,
      c: payload.campaignId,
      w: payload.workspaceId,
      e: payload.email,
      exp: payload.expiresAt,
      iat: Date.now(),
    };

    const plaintext = JSON.stringify(compact);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.getKey(), iv);

    let ciphertext = cipher.update(plaintext, "utf8");
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Package as iv(12) + authTag(16) + ciphertext
    const combined = Buffer.concat([iv, authTag, ciphertext]);
    return combined.toString("base64url");
  }

  /**
   * Verifies and decrypts an unsubscribe token.
   * Throws UnsubscribeError if token is tampered, invalid, or expired.
   */
  public static verifyToken(tokenStr: string): UnsubscribeTokenPayload {
    if (!tokenStr || typeof tokenStr !== "string") {
      throw new UnsubscribeError("Missing or malformed unsubscribe token.", "INVALID_TOKEN");
    }

    try {
      const buffer = Buffer.from(tokenStr, "base64url");
      if (buffer.length < 28) {
        // Must contain at least 12-byte IV + 16-byte AuthTag
        throw new UnsubscribeError("Invalid token length.", "INVALID_TOKEN");
      }

      const iv = buffer.subarray(0, 12);
      const authTag = buffer.subarray(12, 28);
      const ciphertext = buffer.subarray(28);

      const decipher = crypto.createDecipheriv("aes-256-gcm", this.getKey(), iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      const compact = JSON.parse(decrypted.toString("utf8")) as CompactTokenPayload;

      if (!compact.r || !compact.c || !compact.w || !compact.e || !compact.exp) {
        throw new UnsubscribeError("Incomplete unsubscribe token payload.", "INVALID_TOKEN");
      }

      // Check token expiration
      if (Date.now() > compact.exp) {
        throw new UnsubscribeError("This unsubscribe link has expired.", "EXPIRED_TOKEN");
      }

      return {
        recipientId: compact.r,
        campaignId: compact.c,
        workspaceId: compact.w,
        email: compact.e,
        expiresAt: compact.exp,
      };
    } catch (err: any) {
      if (err instanceof UnsubscribeError) {
        throw err;
      }
      throw new UnsubscribeError("Invalid or tampered unsubscribe token.", "INVALID_TOKEN");
    }
  }

  /**
   * Resolves the canonical public API base URL
   */
  public static getPublicApiBaseUrl(): string {
    const configured = (
      process.env.PUBLIC_BASE_URL ||
      env.PUBLIC_BASE_URL ||
      process.env.PUBLIC_API_URL ||
      env.PUBLIC_API_URL ||
      "https://e-mailer-00sp.onrender.com"
    ).trim();

    const clean = configured.replace(/\/+$/, "");

    // Guard: Public unsubscribe links sent in emails must never point to localhost
    if (
      clean.includes("localhost") ||
      clean.includes("127.0.0.1") ||
      clean.includes("::1")
    ) {
      return "https://e-mailer-00sp.onrender.com";
    }

    return clean;
  }

  /**
   * Validates whether a URL is a legitimate public HTTPS URL (not localhost or insecure HTTP)
   */
  public static isPublicHttpsUrl(urlStr?: string | null): boolean {
    if (!urlStr) return false;
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== "https:") return false;
      const host = parsed.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local") ||
        host.endsWith(".internal")
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generates a signed unsubscribe URL and validates HTTPS public availability
   */
  public static generateUnsubscribeUrl(params: {
    recipientId: string;
    campaignId: string;
    workspaceId: string;
    email: string;
    expiresInDays?: number;
  }): { url: string; token: string; isPublicHttps: boolean } {
    const expiresInDays = params.expiresInDays || 180;
    const token = this.generateToken({
      recipientId: params.recipientId,
      campaignId: params.campaignId,
      workspaceId: params.workspaceId,
      email: params.email,
      expiresAt: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    });

    const apiBase = this.getPublicApiBaseUrl();
    const url = `${apiBase}/api/webhooks/unsubscribe?token=${encodeURIComponent(token)}`;
    const isPublicHttps = this.isPublicHttpsUrl(apiBase);

    return { url, token, isPublicHttps };
  }

  /**
   * Executes the unsubscribe workflow with strict security and idempotency guarantees.
   */
  public static async executeUnsubscribe(
    payload: UnsubscribeTokenPayload,
    context: {
      source: "web_get" | "rfc8058_post";
      userAgent?: string;
      ip?: string;
    }
  ): Promise<{
    success: boolean;
    alreadyUnsubscribed: boolean;
    maskedEmail: string;
    campaignName: string;
  }> {
    // 1. Fetch recipient and campaign with security scopes
    const recipient = await prisma.campaignRecipient.findUnique({
      where: { id: payload.recipientId },
      include: {
        campaign: true,
        contact: true,
      },
    });

    if (!recipient) {
      throw new UnsubscribeError("Recipient record does not exist or has been removed.", "NOT_FOUND");
    }

    // Cross-workspace security check
    if (recipient.campaign.workspaceId !== payload.workspaceId) {
      throw new UnsubscribeError("Security violation: Cross-workspace access denied.", "SECURITY_MISMATCH");
    }

    // Campaign scope verification
    if (recipient.campaignId !== payload.campaignId) {
      throw new UnsubscribeError("Security violation: Campaign scope mismatch.", "SECURITY_MISMATCH");
    }

    // Recipient email integrity check
    if (recipient.email.toLowerCase() !== payload.email.toLowerCase()) {
      throw new UnsubscribeError("Security violation: Recipient email address mismatch.", "SECURITY_MISMATCH");
    }

    const maskedEmail = this.maskEmail(recipient.email);
    const campaignName = recipient.campaign.name;

    // 2. Check if already unsubscribed (Idempotency)
    const existingUnsubEvent = await prisma.emailEvent.findFirst({
      where: {
        campaignRecipientId: recipient.id,
        eventType: EmailEventType.UNSUBSCRIBED,
      },
    });

    const isContactAlreadyUnsub = recipient.contact?.status === ContactStatus.UNSUBSCRIBED;

    if (existingUnsubEvent || isContactAlreadyUnsub) {
      // Ensure contact status is synchronized if it was somehow not UNSUBSCRIBED
      if (recipient.contactId && !isContactAlreadyUnsub) {
        await prisma.contact.update({
          where: { id: recipient.contactId },
          data: { status: ContactStatus.UNSUBSCRIBED },
        });
      }
      return {
        success: true,
        alreadyUnsubscribed: true,
        maskedEmail,
        campaignName,
      };
    }

    // 3. Mark Contact as UNSUBSCRIBED in the workspace
    if (recipient.contactId) {
      await prisma.contact.update({
        where: { id: recipient.contactId },
        data: { status: ContactStatus.UNSUBSCRIBED },
      });
    }

    // Suppress any matching contact email within this workspace
    await prisma.contact.updateMany({
      where: {
        workspaceId: payload.workspaceId,
        email: recipient.email,
      },
      data: { status: ContactStatus.UNSUBSCRIBED },
    });

    // 4. Increment campaign unsubscribed count atomically
    await prisma.campaign.update({
      where: { id: recipient.campaignId },
      data: {
        unsubscribedCount: { increment: 1 },
      },
    });

    // 5. Record EmailEvent
    await prisma.emailEvent.create({
      data: {
        workspaceId: payload.workspaceId,
        campaignId: recipient.campaignId,
        campaignRecipientId: recipient.id,
        contactId: recipient.contactId,
        provider: recipient.provider || "GMAIL_SMTP",
        providerEventId: `unsub-${recipient.id}-${Date.now()}`,
        eventType: EmailEventType.UNSUBSCRIBED,
        occurredAt: new Date(),
        metadata: {
          source: context.source,
          userAgent: context.userAgent || null,
          ip: context.ip || null,
        },
      },
    });

    return {
      success: true,
      alreadyUnsubscribed: false,
      maskedEmail,
      campaignName,
    };
  }

  /**
   * Helper to mask email address for privacy (e.g. a***i@domain.com)
   */
  public static maskEmail(email: string): string {
    const parts = email.split("@");
    if (parts.length !== 2) return "••••@••••";
    const [name, domain] = parts;
    if (name.length <= 2) {
      return `${name.charAt(0)}*@${domain}`;
    }
    const first = name.charAt(0);
    const last = name.charAt(name.length - 1);
    return `${first}••••${last}@${domain}`;
  }

  /**
   * Render HTML for GET unsubscribe confirmation page
   */
  public static renderSuccessPage(maskedEmail: string, alreadyUnsubscribed: boolean): string {
    const title = alreadyUnsubscribed ? "Already Unsubscribed" : "You have been unsubscribed";
    const message = alreadyUnsubscribed
      ? "You were already unsubscribed from broadcast emails from this sender."
      : "You have been successfully unsubscribed and will no longer receive broadcast emails from this sender.";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — MailPilot</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 40px 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      max-width: 480px;
      width: 100%;
      padding: 36px 32px;
      text-align: center;
      box-sizing: border-box;
    }
    .icon-container {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background-color: #f0fdf4;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .icon-container svg {
      width: 28px;
      height: 28px;
      color: #16a34a;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 10px;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #64748b;
      margin: 0 0 20px;
    }
    .badge {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 6px;
      margin-bottom: 24px;
      font-weight: 500;
      font-family: monospace;
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-container">
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="badge">${maskedEmail}</div>
    <div class="footer">
      MailPilot • Secure Unsubscribe Management
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Render HTML for GET unsubscribe error page
   */
  public static renderErrorPage(errorMessage: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid Unsubscribe Request — MailPilot</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 40px 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      max-width: 480px;
      width: 100%;
      padding: 36px 32px;
      text-align: center;
      box-sizing: border-box;
    }
    .icon-container {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background-color: #fef2f2;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .icon-container svg {
      width: 28px;
      height: 28px;
      color: #dc2626;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 10px;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #64748b;
      margin: 0 0 20px;
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-container">
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
    </div>
    <h1>Unable to Process Unsubscribe</h1>
    <p>${errorMessage}</p>
    <div class="footer">
      MailPilot • Secure Unsubscribe Management
    </div>
  </div>
</body>
</html>`;
  }
}
