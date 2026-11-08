import { BrevoClient, BrevoError, BrevoTimeoutError } from "@getbrevo/brevo";
import { env } from "../config/env";
import crypto from "crypto";
import {
  SendEmailOptions,
  SendEmailResult,
  ProviderConnectionTestResult,
} from "./provider.types";

export class BrevoEmailProvider {
  private static brevoClient: BrevoClient | null = null;
  private static testMode = false;
  private static testMockHandler?: (options: SendEmailOptions) => Promise<SendEmailResult>;

  /**
   * Enable explicit mock test mode for automated test suites.
   */
  public static enableTestMode(
    handler?: (options: SendEmailOptions) => Promise<SendEmailResult>
  ): void {
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
    return this.testMode || process.env.BREVO_SIMULATION_MODE === "true";
  }

  /**
   * Determine whether a functional, non-placeholder Brevo API key is present.
   */
  public static isConfigured(): boolean {
    const key = env.BREVO_API_KEY;
    if (!key || key.trim() === "") return false;
    const trimmed = key.trim();
    if (
      trimmed === "placeholder" ||
      trimmed.includes("placeholder") ||
      trimmed.length < 10
    ) {
      return false;
    }
    return true;
  }

  /**
   * Resolves the configured sender email for Brevo.
   */
  public static getSenderEmail(overrideEmail?: string | null): string {
    if (overrideEmail && overrideEmail.trim()) {
      return overrideEmail.trim();
    }
    return env.BREVO_SENDER_EMAIL?.trim() || "";
  }

  /**
   * Resolves the configured sender display name for Brevo.
   */
  public static getSenderName(overrideName?: string | null): string {
    if (overrideName && overrideName.trim()) {
      return overrideName.trim();
    }
    return env.BREVO_SENDER_NAME?.trim() || "MailPilot";
  }

  /**
   * Lazily initialize the official Brevo client if configured.
   */
  private static getClient(): BrevoClient | null {
    if (!this.isConfigured()) {
      return null;
    }
    if (!this.brevoClient) {
      this.brevoClient = new BrevoClient({
        apiKey: env.BREVO_API_KEY!.trim(),
      });
    }
    return this.brevoClient;
  }

  /**
   * Cleanly normalize Brevo Message-ID strings.
   * Brevo often returns IDs enclosed in angle brackets: `<202611081000.123@smtp-relay.brevo.com>`.
   */
  public static normalizeMessageId(rawId?: string | null): string | undefined {
    if (!rawId) return undefined;
    return rawId.trim().replace(/^<|>$/g, "").trim();
  }

  /**
   * Injects invisible preheader span into HTML.
   */
  public static injectPreheader(html: string, preheader?: string | null): string {
    if (!preheader || !preheader.trim()) {
      return html;
    }

    const preheaderSpan = `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader.trim()}</span>\n`;

    if (/<body[^>]*>/i.test(html)) {
      return html.replace(/<body[^>]*>/i, (match) => `${match}\n${preheaderSpan}`);
    }

    return `${preheaderSpan}${html}`;
  }

  /**
   * Simple HTML-to-plain-text stripper for textContent fallback.
   */
  public static stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
   * Test connection to Brevo API by requesting account details.
   */
  public static async testConnection(): Promise<ProviderConnectionTestResult> {
    const testedAt = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        success: false,
        provider: "BREVO",
        message: "Brevo API key is not configured in .env (BREVO_API_KEY).",
        testedAt,
      };
    }

    try {
      const client = this.getClient()!;
      const account = await client.account.getAccount();

      const planType = account.plan?.[0]?.type || "free";
      const credits = account.plan?.[0]?.credits;

      return {
        success: true,
        provider: "BREVO",
        accountEmail: account.email,
        planType,
        credits: typeof credits === "number" ? credits : undefined,
        message: `Successfully connected to Brevo account (${account.email}).`,
        testedAt,
      };
    } catch (err: any) {
      let errorMessage = "Failed to connect to Brevo API";
      if (err instanceof BrevoTimeoutError) {
        errorMessage = "Brevo API connection timed out.";
      } else if (err instanceof BrevoError) {
        const bodyMsg = (err.body as any)?.message;
        errorMessage = bodyMsg || `Brevo API error (HTTP ${err.statusCode || 500}).`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      return {
        success: false,
        provider: "BREVO",
        message: errorMessage,
        testedAt,
      };
    }
  }

  /**
   * Constructs the transactional email request payload for Brevo API.
   */
  public static buildSendRequest(options: SendEmailOptions): Record<string, any> {
    const senderEmail = this.getSenderEmail(options.fromEmail);
    const senderName = this.getSenderName(options.fromName);

    const finalHtml = this.injectPreheader(options.html, options.preheader);
    const textContent = options.textContent || this.stripHtml(finalHtml);

    // Format tags: Brevo tags must be strings (alphanumeric, underscores, hyphens)
    const tags: string[] = [];
    if (options.tags && options.tags.length > 0) {
      for (const t of options.tags) {
        const cleanTag = `${t.name}_${t.value}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
        tags.push(cleanTag);
      }
    }

    // Build custom headers for tracking
    const headers: Record<string, string> = {
      "X-MailPilot-Delivery-Engine": "MailPilot-Brevo-v1",
      ...(options.headers || {}),
    };

    const payload: any = {
      sender: {
        email: senderEmail,
        name: senderName,
      },
      to: [
        {
          email: options.to.trim(),
          name: options.toName?.trim() || undefined,
        },
      ],
      subject: options.subject,
      htmlContent: finalHtml,
      textContent,
    };

    if (options.replyTo && options.replyTo.trim()) {
      payload.replyTo = { email: options.replyTo.trim() };
    }

    if (tags.length > 0) {
      payload.tags = tags;
    }

    if (options.params && Object.keys(options.params).length > 0) {
      payload.params = options.params;
    }

    if (Object.keys(headers).length > 0) {
      payload.headers = headers;
    }

    return payload;
  }

  /**
   * Send a single email through Brevo transactional email API (POST /v3/smtp/email).
   */
  public static async send(
    options: SendEmailOptions,
    sendConfig?: { isTest?: boolean }
  ): Promise<SendEmailResult> {
    // 1. If explicit test handler registered (for unit testing in-memory)
    if (this.testMockHandler) {
      return this.testMockHandler(options);
    }

    // 2. Validate provider configuration
    if (!this.isConfigured()) {
      // Simulation mode explicitly requested by test suite or job flag
      if (this.isTestModeEnabled() || sendConfig?.isTest) {
        if (
          options.to.includes("reject") ||
          options.to.includes("fail") ||
          options.to.includes("invalid")
        ) {
          return {
            success: false,
            error: "Simulated Brevo API error: Recipient address rejected or invalid",
            errorCode: "invalid_parameter",
            simulated: true,
            provider: "BREVO",
          };
        }

        const mockId = `mock_brevo_${crypto.randomUUID()}`;
        console.log(
          `[BrevoEmailProvider][SIMULATED] Sent to "${options.to}" with subject "${options.subject}" (Mock ID: ${mockId})`
        );
        return {
          success: true,
          messageId: mockId,
          simulated: true,
          provider: "BREVO",
        };
      }

      // Live mode fast-fail: Never silently simulate success
      return {
        success: false,
        error:
          "Brevo API key is unconfigured or a placeholder in .env (BREVO_API_KEY). Real email delivery cannot be performed.",
        errorCode: "PROVIDER_UNCONFIGURED",
        simulated: false,
        provider: "BREVO",
      };
    }

    // 3. Resolve Sender (Prefer option if provided, fall back to verified env sender)
    const senderEmail = this.getSenderEmail(options.fromEmail);

    if (!senderEmail || !senderEmail.includes("@")) {
      return {
        success: false,
        error:
          "Brevo requires a valid verified sender email. Configure BREVO_SENDER_EMAIL in .env or provide a valid From Email.",
        errorCode: "MISSING_SENDER_EMAIL",
        simulated: false,
        provider: "BREVO",
      };
    }

    // 4. Construct payload for Brevo Transactional Email API (POST /v3/smtp/email)
    const payload = this.buildSendRequest(options);

    try {
      const client = this.getClient()!;
      const response = await client.transactionalEmails.sendTransacEmail(payload);

      // Extract raw messageId from Brevo response
      const rawMessageId = response.messageId || response.messageIds?.[0];

      if (!rawMessageId) {
        return {
          success: false,
          error: "Brevo accepted request but did not return a message ID.",
          errorCode: "EMPTY_RESPONSE",
          simulated: false,
          provider: "BREVO",
        };
      }

      const cleanMessageId = this.normalizeMessageId(rawMessageId)!;

      return {
        success: true,
        messageId: cleanMessageId,
        simulated: false,
        provider: "BREVO",
      };
    } catch (err: any) {
      let errorCode = "BREVO_ERROR";
      let errorMsg = "Failed to dispatch email via Brevo API.";

      if (err instanceof BrevoTimeoutError) {
        errorCode = "TIMEOUT";
        errorMsg = "Request to Brevo API timed out.";
      } else if (err instanceof BrevoError) {
        errorCode = (err.body as any)?.code || `HTTP_${err.statusCode || 500}`;
        errorMsg = (err.body as any)?.message || err.message || errorMsg;
      } else if (err.message) {
        errorMsg = err.message;
      }

      console.error(`[BrevoEmailProvider] Dispatch failed for ${options.to}:`, {
        code: errorCode,
        message: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
        errorCode,
        simulated: false,
        provider: "BREVO",
      };
    }
  }
}
