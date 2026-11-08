export type EmailProviderType = "RESEND" | "BREVO";

export interface SendEmailOptions {
  to: string;
  toName?: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  html: string;
  textContent?: string;
  replyTo?: string | null;
  preheader?: string | null;
  tags?: { name: string; value: string }[];
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  simulated: boolean;
  provider?: EmailProviderType;
}

export interface ProviderConnectionTestResult {
  success: boolean;
  provider: EmailProviderType;
  accountEmail?: string;
  planType?: string;
  credits?: number;
  message: string;
  testedAt: string;
}

export interface ProviderStatusInfo {
  type: EmailProviderType;
  name: string;
  isConfigured: boolean;
  senderEmail?: string;
  senderName?: string;
  isDefault: boolean;
  supportsPersonalSender: boolean;
  requiresCustomDomain: boolean;
}

