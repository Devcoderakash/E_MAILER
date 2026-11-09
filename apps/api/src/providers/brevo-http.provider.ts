import { env } from "../config/env";
import { UnsubscribeService } from "../modules/webhooks/unsubscribe.service";
import { SendEmailOptions, SendEmailResult } from "./gmail-smtp.provider";

export class BrevoHttpProvider {
  /**
   * Check if Brevo HTTP API credentials are configured
   */
  public static isConfigured(): boolean {
    const key = env.BREVO_API_KEY;
    if (!key || key.trim() === "" || key.includes("placeholder")) {
      return false;
    }
    return true;
  }

  /**
   * Verify Brevo API connection and account status over HTTPS port 443
   */
  public static async verifyConnection(): Promise<{ healthy: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { healthy: false, error: "BREVO_API_KEY is not configured in environment." };
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/account", {
        method: "GET",
        headers: {
          "api-key": env.BREVO_API_KEY!.trim(),
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        return {
          healthy: false,
          error: errorData?.message || `Brevo API returned status ${response.status}`,
        };
      }

      return { healthy: true };
    } catch (err: any) {
      return {
        healthy: false,
        error: `Failed to connect to Brevo HTTPS API: ${err.message}`,
      };
    }
  }

  /**
   * Dispatches email via Brevo REST API over HTTPS (Port 443).
   * Never blocked by cloud providers (Render, AWS, GCP, DigitalOcean).
   */
  public static async send(
    options: SendEmailOptions,
    meta?: { isTest?: boolean }
  ): Promise<SendEmailResult> {
    if (meta?.isTest) {
      return {
        success: true,
        messageId: `<brevo_test_${Date.now()}@mailpilot.io>`,
        simulated: true,
        accepted: true,
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Brevo HTTP provider is unconfigured. Set BREVO_API_KEY in environment variables.",
        errorCode: "PROVIDER_UNCONFIGURED",
        simulated: false,
      };
    }

    const senderEmail = env.BREVO_SENDER_EMAIL || options.fromEmail || "newsletter@mailpilot.io";
    const senderName = options.fromName || env.BREVO_SENDER_NAME || "MailPilot";

    let finalHtml = options.html;

    // Auto-append compliant unsubscribe footer if URL provided and not present
    if (
      options.unsubscribeUrl &&
      !finalHtml.toLowerCase().includes("unsubscribe") &&
      !finalHtml.toLowerCase().includes("{{unsubscribe_url}}")
    ) {
      finalHtml += `
<div style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  You are receiving this communication from ${senderName}.<br />
  <a href="${options.unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a> from future broadcast emails.
</div>`;
    }

    // Add hidden inbox preheader snippet if provided
    if (options.preheader && options.preheader.trim()) {
      const preheaderHtml = `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${options.preheader}</div>`;
      finalHtml = preheaderHtml + finalHtml;
    }

    // RFC 8058 List-Unsubscribe headers
    const headers: Record<string, string> = {};
    if (UnsubscribeService.isPublicHttpsUrl(options.unsubscribeUrl)) {
      headers["List-Unsubscribe"] = `<${options.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const payload: Record<string, any> = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: options.to,
        },
      ],
      subject: options.subject,
      htmlContent: finalHtml,
    };

    if (options.text) {
      payload.textContent = options.text;
    }

    if (options.replyTo && options.replyTo.includes("@")) {
      payload.replyTo = {
        email: options.replyTo.trim(),
      };
    }

    if (Object.keys(headers).length > 0) {
      payload.headers = headers;
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY!.trim(),
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseBody: any = await response.json().catch(() => ({}));

      if (response.ok || response.status === 201) {
        const messageId = responseBody?.messageId || `<brevo_${Date.now()}@brevo.com>`;
        return {
          success: true,
          messageId,
          simulated: false,
          accepted: true,
        };
      }

      const errorMessage =
        responseBody?.message || `Brevo API HTTP ${response.status} error`;
      const isQuota =
        response.status === 402 ||
        responseBody?.code === "reseller_permission_denied" ||
        errorMessage.toLowerCase().includes("credit") ||
        errorMessage.toLowerCase().includes("quota");

      return {
        success: false,
        error: errorMessage,
        errorCode: responseBody?.code || `HTTP_${response.status}`,
        isQuotaExceeded: isQuota,
        simulated: false,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Brevo HTTPS request failed: ${err.message}`,
        errorCode: "NETWORK_ERROR",
        simulated: false,
      };
    }
  }
}
