import { env } from "../config/env";
import { ResendProvider } from "./resend.provider";
import { BrevoEmailProvider } from "./brevo.provider";
import {
  EmailProviderType,
  SendEmailOptions,
  SendEmailResult,
  ProviderConnectionTestResult,
  ProviderStatusInfo,
} from "./provider.types";

export interface IEmailDeliveryProvider {
  send(options: SendEmailOptions, sendConfig?: { isTest?: boolean }): Promise<SendEmailResult>;
  isConfigured(): boolean;
  testConnection(): Promise<ProviderConnectionTestResult>;
}

export class EmailProviderFactory {
  /**
   * Retrieves the delivery provider implementation for the given provider type.
   */
  public static getProvider(type: EmailProviderType = "RESEND"): IEmailDeliveryProvider {
    switch (type.toUpperCase()) {
      case "BREVO":
        return BrevoEmailProvider;
      case "RESEND":
      default:
        return ResendProvider;
    }
  }

  /**
   * Resolves the provider type for a given campaign and workspace context.
   * Priority:
   * 1. Explicit campaign-level provider ("BREVO" or "RESEND")
   * 2. Workspace-level default provider
   * 3. System environment DEFAULT_EMAIL_PROVIDER ("RESEND" by default)
   */
  public static resolveProvider(
    campaignProvider?: string | null,
    workspaceDefault?: string | null
  ): EmailProviderType {
    if (campaignProvider && (campaignProvider === "BREVO" || campaignProvider === "RESEND")) {
      return campaignProvider as EmailProviderType;
    }

    if (workspaceDefault && (workspaceDefault === "BREVO" || workspaceDefault === "RESEND")) {
      return workspaceDefault as EmailProviderType;
    }

    const defaultFromEnv = (env.DEFAULT_EMAIL_PROVIDER || "RESEND").toUpperCase();
    if (defaultFromEnv === "BREVO") return "BREVO";
    return "RESEND";
  }

  /**
   * Check whether the specified provider is configured.
   */
  public static isConfigured(type: EmailProviderType): boolean {
    return this.getProvider(type).isConfigured();
  }

  /**
   * Test the connection to the specified provider.
   */
  public static async testProvider(type: EmailProviderType): Promise<ProviderConnectionTestResult> {
    return this.getProvider(type).testConnection();
  }

  /**
   * Get metadata and configuration statuses for all supported delivery providers.
   * Does NOT leak any secrets or API keys.
   */
  public static getProvidersStatus(workspaceDefault?: string | null): ProviderStatusInfo[] {
    const currentDefault = this.resolveProvider(null, workspaceDefault);

    const resendConfigured = ResendProvider.isConfigured();
    const brevoConfigured = BrevoEmailProvider.isConfigured();

    return [
      {
        type: "RESEND",
        name: "Resend",
        isConfigured: resendConfigured,
        isDefault: currentDefault === "RESEND",
        supportsPersonalSender: false,
        requiresCustomDomain: true,
      },
      {
        type: "BREVO",
        name: "Brevo (formerly Sendinblue)",
        isConfigured: brevoConfigured,
        senderEmail: env.BREVO_SENDER_EMAIL || undefined,
        senderName: env.BREVO_SENDER_NAME || "MailPilot",
        isDefault: currentDefault === "BREVO",
        supportsPersonalSender: true,
        requiresCustomDomain: false,
      },
    ];
  }
}

