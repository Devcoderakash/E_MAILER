import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { EmailProviderFactory } from "../../providers/email.factory";
import { EmailProviderType } from "../../providers/provider.types";
import { CampaignService } from "../campaigns/campaign.service";

const sendTestEmailSchema = z.object({
  to: z.string().trim().email("A valid recipient email address is required"),
});

const setDefaultProviderSchema = z.object({
  provider: z.enum(["RESEND", "BREVO"], {
    errorMap: () => ({ message: "Provider must be either 'RESEND' or 'BREVO'" }),
  }),
});

export class SettingsController {
  private static async getWorkspace(req: Request) {
    if (!req.user) {
      const err: any = new Error("Unauthorized");
      err.statusCode = 401;
      throw err;
    }
    const requestedWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
    return await CampaignService.resolveActiveWorkspace(req.user.id, requestedWorkspaceId);
  }

  /**
   * GET /api/settings/providers
   * Returns list and status of email delivery providers without exposing secrets.
   */
  static async getProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await SettingsController.getWorkspace(req);
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { defaultEmailProvider: true },
      });

      const defaultProvider = (workspace?.defaultEmailProvider || "RESEND") as EmailProviderType;
      const providersStatus = EmailProviderFactory.getProvidersStatus(defaultProvider);

      const providers = providersStatus.map((p) => ({
        type: p.type,
        name: p.name,
        configured: p.isConfigured,
        isConfigured: p.isConfigured,
        default: p.type === defaultProvider,
        isDefault: p.type === defaultProvider,
        senderEmail: p.senderEmail || (p.type === "RESEND" ? "onboarding@resend.dev" : undefined),
        senderName: p.senderName || "MailPilot",
        supportsPersonalEmail: p.supportsPersonalSender,
        supportsPersonalSender: p.supportsPersonalSender,
        requiresCustomDomain: p.requiresCustomDomain,
      }));

      res.status(200).json({
        success: true,
        data: {
          defaultProvider,
          providers,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/settings/providers/:provider/test-connection
   * Tests API credentials against provider API.
   */
  static async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const providerParam = (req.params.provider || "").toUpperCase();
      if (providerParam !== "RESEND" && providerParam !== "BREVO") {
        res.status(400).json({
          success: false,
          ok: false,
          message: `Unsupported provider '${req.params.provider}'. Must be 'resend' or 'brevo'.`,
        });
        return;
      }

      const result = await EmailProviderFactory.testProvider(providerParam as EmailProviderType);

      res.status(200).json({
        success: result.success,
        ok: result.success,
        message: result.message,
        details: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/settings/providers/:provider/send-test-email
   * Sends exactly one test email without invoking campaign dispatch pipelines.
   */
  static async sendTestEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const providerParam = (req.params.provider || "").toUpperCase();
      if (providerParam !== "RESEND" && providerParam !== "BREVO") {
        res.status(400).json({
          success: false,
          error: `Unsupported provider '${req.params.provider}'. Must be 'resend' or 'brevo'.`,
        });
        return;
      }

      const parsed = sendTestEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.errors[0]?.message || "Invalid recipient email address",
        });
        return;
      }

      const providerType = providerParam as EmailProviderType;
      const providerInstance = EmailProviderFactory.getProvider(providerType);

      if (!providerInstance.isConfigured()) {
        res.status(400).json({
          success: false,
          error: `${providerType} is not configured in environment variables. Check API key.`,
        });
        return;
      }

      const fromEmail =
        providerType === "BREVO"
          ? (env.BREVO_SENDER_EMAIL || "lodhiakash286@gmail.com")
          : "onboarding@resend.dev";

      const fromName =
        providerType === "BREVO"
          ? (env.BREVO_SENDER_NAME || "MailPilot")
          : "MailPilot";

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">MailPilot Connection Test</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">
            This is a controlled test email sent through <strong>${providerType}</strong> to verify your email delivery configuration.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;"><strong>Provider:</strong> ${providerType}</p>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;"><strong>Sender:</strong> ${fromName} &lt;${fromEmail}&gt;</p>
            <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
            If you received this email, your provider credentials and delivery settings are configured correctly in MailPilot.
          </p>
        </div>
      `;

      const result = await providerInstance.send(
        {
          to: parsed.data.to,
          fromName,
          fromEmail,
          subject: `[MailPilot Test] Delivery verification via ${providerType}`,
          html,
          textContent: `This is a test email sent from MailPilot via ${providerType} to verify email delivery.`,
          tags: [
            { name: "category", value: "test-email" },
            { name: "provider", value: providerType },
          ],
        },
        { isTest: true }
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || "Failed to deliver test email",
          errorCode: result.errorCode,
          status: "FAILED",
        });
        return;
      }

      res.status(200).json({
        success: true,
        ok: true,
        status: "SENT",
        providerMessageId: result.messageId,
        message: `Test email sent successfully via ${providerType}.`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/settings/providers/default
   * Updates workspace default delivery provider.
   */
  static async setDefaultProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await SettingsController.getWorkspace(req);
      const parsed = setDefaultProviderSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.errors[0]?.message || "Invalid provider",
        });
        return;
      }

      const updated = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { defaultEmailProvider: parsed.data.provider },
        select: { id: true, name: true, defaultEmailProvider: true },
      });

      res.status(200).json({
        success: true,
        message: `Default email delivery provider set to ${parsed.data.provider}.`,
        data: {
          defaultEmailProvider: updated.defaultEmailProvider,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

