import { Resend } from "resend";
import { env } from "../config/env";
import crypto from "crypto";

export interface SendEmailOptions {
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  html: string;
  replyTo?: string | null;
  preheader?: string | null;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated: boolean;
}

export class ResendProvider {
  private static resendClient: Resend | null = null;

  /**
   * Determine whether a functional, non-placeholder Resend API key is present.
   */
  public static isConfigured(): boolean {
    const key = env.RESEND_API_KEY;
    return !!key && key.trim() !== "" && key !== "re_placeholder" && !key.startsWith("re_placeholder");
  }

  /**
   * Lazily initialize the Resend client if configured.
   */
  private static getClient(): Resend | null {
    if (!this.isConfigured()) {
      return null;
    }
    if (!this.resendClient) {
      this.resendClient = new Resend(env.RESEND_API_KEY);
    }
    return this.resendClient;
  }

  /**
   * Injects invisible preheader span into HTML if preheader is provided.
   */
  public static injectPreheader(html: string, preheader?: string | null): string {
    if (!preheader || !preheader.trim()) {
      return html;
    }

    const preheaderSpan = `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader.trim()}</span>\n`;

    // Attempt to inject right after <body> tag
    if (/<body[^>]*>/i.test(html)) {
      return html.replace(/<body[^>]*>/i, (match) => `${match}\n${preheaderSpan}`);
    }

    // Otherwise prepend to html
    return `${preheaderSpan}${html}`;
  }

  /**
   * Replace merge variables: {{first_name}}, {{last_name}}, {{email}}, {{company}}, {{subject}}
   */
  public static interpolateMergeTags(
    template: string,
    variables: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      company?: string | null;
      subject?: string | null;
      [key: string]: string | null | undefined;
    }
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "first_name" || lowerKey === "firstname") {
        return variables.firstName || "";
      }
      if (lowerKey === "last_name" || lowerKey === "lastname") {
        return variables.lastName || "";
      }
      if (lowerKey === "email") {
        return variables.email || "";
      }
      if (lowerKey === "company") {
        return variables.company || "";
      }
      if (lowerKey === "subject") {
        return variables.subject || "";
      }
      return variables[key] ?? "";
    });
  }

  /**
   * Send a single email through Resend or fallback mock simulation.
   */
  public static async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const formattedFrom = `${options.fromName.trim()} <${options.fromEmail.trim()}>`;
    const finalHtml = this.injectPreheader(options.html, options.preheader);

    // If API key is not configured or is placeholder, run in safe simulation mode
    if (!this.isConfigured()) {
      const mockId = `mock_resend_${crypto.randomUUID()}`;
      console.log(
        `[ResendProvider][SIMULATED] Sent to "${options.to}" with subject "${options.subject}" (Mock ID: ${mockId})`
      );
      return {
        success: true,
        messageId: mockId,
        simulated: true,
      };
    }

    try {
      const client = this.getClient()!;
      const payload: any = {
        from: formattedFrom,
        to: [options.to],
        subject: options.subject,
        html: finalHtml,
      };

      if (options.replyTo && options.replyTo.trim()) {
        payload.reply_to = options.replyTo.trim();
      }

      if (options.tags && options.tags.length > 0) {
        payload.tags = options.tags;
      }

      const response = await client.emails.send(payload);

      if (response.error) {
        console.error(`[ResendProvider] Resend API error for ${options.to}:`, response.error);
        return {
          success: false,
          error: response.error.message || "Failed to deliver email through Resend",
          simulated: false,
        };
      }

      return {
        success: true,
        messageId: response.data?.id,
        simulated: false,
      };
    } catch (err: any) {
      console.error(`[ResendProvider] Exception delivering email to ${options.to}:`, err.message);
      return {
        success: false,
        error: err.message || "Unexpected email delivery exception",
        simulated: false,
      };
    }
  }
}
