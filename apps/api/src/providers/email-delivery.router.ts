import { GmailSmtpProvider, SendEmailOptions, SendEmailResult } from "./gmail-smtp.provider";
import { BrevoHttpProvider } from "./brevo-http.provider";

export class EmailDeliveryRouter {
  /**
   * Check if any valid email delivery provider is configured
   */
  public static isConfigured(): boolean {
    return BrevoHttpProvider.isConfigured() || GmailSmtpProvider.isConfigured();
  }

  /**
   * Identifies the current active delivery provider name
   */
  public static getActiveProviderName(): "BREVO_HTTP" | "GMAIL_SMTP" | "NONE" {
    if (BrevoHttpProvider.isConfigured()) return "BREVO_HTTP";
    if (GmailSmtpProvider.isConfigured()) return "GMAIL_SMTP";
    return "NONE";
  }

  /**
   * Verify health of the active provider
   */
  public static async verifyConnection(workspaceId?: string): Promise<{ healthy: boolean; error?: string }> {
    if (BrevoHttpProvider.isConfigured()) {
      return await BrevoHttpProvider.verifyConnection();
    }
    return await GmailSmtpProvider.verifyConnection(undefined, workspaceId);
  }

  /**
   * Dispatch email through the best available provider.
   * Brevo HTTP (Port 443) is prioritized when configured to bypass cloud SMTP port blocking.
   */
  public static async send(
    options: SendEmailOptions,
    meta?: { isTest?: boolean }
  ): Promise<SendEmailResult> {
    if (BrevoHttpProvider.isConfigured()) {
      return await BrevoHttpProvider.send(options, meta);
    }
    return await GmailSmtpProvider.send(options, meta);
  }
}
