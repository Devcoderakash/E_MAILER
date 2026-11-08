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
  errorCode?: string;
  simulated: boolean;
}

export class ResendProvider {
  private static resendClient: Resend | null = null;
  private static testMode = false;
  private static testMockHandler?: (options: SendEmailOptions) => Promise<SendEmailResult>;

  /**
   * Enable explicit mock test mode for automated test suites.
   * In test mode, simulated sends can be allowed without network calls.
   */
  public static enableTestMode(handler?: (options: SendEmailOptions) => Promise<SendEmailResult>): void {
    this.testMode = true;
    this.testMockHandler = handler;
  }

  /**
   * Disable test mode and return to live provider behavior.
   */
  public static disableTestMode(): void {
    this.testMode = false;
    this.testMockHandler = undefined;
  }

  /**
   * Check if test mode or simulation mode is explicitly enabled.
   */
  public static isTestModeEnabled(): boolean {
    return this.testMode || process.env.RESEND_SIMULATION_MODE === "true";
  }

  /**
   * Determine whether a functional, non-placeholder Resend API key is present.
   */
  public static isConfigured(): boolean {
    const key = env.RESEND_API_KEY;
    if (!key || key.trim() === "") return false;
    const trimmed = key.trim();
    if (
      trimmed === "re_placeholder" ||
      trimmed.startsWith("re_placeholder") ||
      trimmed.includes("123456789")
    ) {
      return false;
    }
    return true;
  }

  /**
   * Checks whether an email address uses a personal webmail domain
   * (e.g. @gmail.com, @yahoo.com) which Resend strictly rejects as a sender domain.
   */
  public static isPersonalWebmail(email: string): boolean {
    if (!email || !email.includes("@")) return false;
    const domain = email.split("@")[1].toLowerCase().trim();
    const disallowedDomains = [
      "gmail.com",
      "googlemail.com",
      "yahoo.com",
      "ymail.com",
      "hotmail.com",
      "outlook.com",
      "live.com",
      "msn.com",
      "icloud.com",
      "me.com",
      "mac.com",
      "aol.com",
      "protonmail.com",
      "proton.me",
      "zoho.com",
    ];
    return disallowedDomains.includes(domain);
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
   * Send a single email through Resend or test mock handler.
   * If RESEND_API_KEY is missing/placeholder and simulation mode is NOT enabled,
   * fails fast with an explicit error rather than silently reporting fake delivery.
   */
  public static async send(
    options: SendEmailOptions,
    sendConfig?: { isTest?: boolean }
  ): Promise<SendEmailResult> {
    const formattedFrom = `${options.fromName.trim()} <${options.fromEmail.trim()}>`;
    const finalHtml = this.injectPreheader(options.html, options.preheader);

    // 1. If explicit test mode handler is registered (for unit testing)
    if (this.testMockHandler) {
      return this.testMockHandler(options);
    }

    // 2. Validate provider configuration
    if (!this.isConfigured()) {
      // If simulation mode is explicitly enabled (e.g. for offline test suites)
      if (this.isTestModeEnabled() || sendConfig?.isTest) {
        if (
          options.to.includes("recipient2") ||
          options.to.includes("reject") ||
          options.to.includes("fail")
        ) {
          return {
            success: false,
            error: "Simulated Resend API error: Rate limit exceeded or invalid address",
            errorCode: "rate_limit_exceeded",
            simulated: true,
          };
        }
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

      // Normal live execution: fail fast when unconfigured
      return {
        success: false,
        error:
          "Resend API key is unconfigured or a placeholder in .env (RESEND_API_KEY). Real email delivery cannot be performed.",
        errorCode: "PROVIDER_UNCONFIGURED",
        simulated: false,
      };
    }

    // 3. Validate fromEmail domain (Resend strictly rejects personal webmail addresses like @gmail.com)
    if (this.isPersonalWebmail(options.fromEmail)) {
      if (this.isTestModeEnabled() || sendConfig?.isTest) {
        const mockId = `mock_resend_${crypto.randomUUID()}`;
        return {
          success: true,
          messageId: mockId,
          simulated: true,
        };
      }
      return {
        success: false,
        error: `Resend rejects sender addresses from personal webmail domains (@${
          options.fromEmail.split("@")[1]
        }). Please use a verified sending domain or 'onboarding@resend.dev' for sandbox testing.`,
        errorCode: "RESTRICTED_FROM_DOMAIN",
        simulated: false,
      };
    }

    // 4. Dispatch via official Resend client
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
        const errorName = response.error.name || "RESEND_ERROR";
        const errorMsg = response.error.message || "Failed to deliver email through Resend";
        console.error(
          `[ResendProvider] Resend API rejected message to ${options.to}:`,
          { name: errorName, message: errorMsg }
        );
        return {
          success: false,
          error: errorMsg,
          errorCode: errorName,
          simulated: false,
        };
      }

      if (!response.data?.id) {
        return {
          success: false,
          error: "Resend accepted request but did not return a message ID.",
          errorCode: "EMPTY_RESPONSE",
          simulated: false,
        };
      }

      return {
        success: true,
        messageId: response.data.id,
        simulated: false,
      };
    } catch (err: any) {
      console.error(
        `[ResendProvider] Network/HTTP Exception communicating with Resend for ${options.to}:`,
        err.message
      );
      return {
        success: false,
        error: err.message || "Failed to communicate with Resend API",
        errorCode: "NETWORK_EXCEPTION",
        simulated: false,
      };
    }
  }
}
