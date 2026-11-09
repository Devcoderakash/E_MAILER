import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { EmailEventType } from "@prisma/client";

// Standard 1x1 transparent GIF buffer
const TRANSPARENT_GIF_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export class TrackingService {
  /**
   * Resolve public base URL for links and pixels sent in emails.
   * Priority: PUBLIC_BASE_URL -> PUBLIC_API_URL -> Render domain fallback.
   * Never localhost.
   */
  public static getPublicBaseUrl(): string {
    const raw =
      process.env.PUBLIC_BASE_URL ||
      env.PUBLIC_BASE_URL ||
      process.env.PUBLIC_API_URL ||
      env.PUBLIC_API_URL ||
      "https://e-mailer-00sp.onrender.com";

    const clean = raw.trim().replace(/\/+$/, "");

    // Guard: In public emails, never use localhost because recipients cannot resolve it
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
   * Transparent 1x1 GIF buffer for open pixel
   */
  public static getPixelBuffer(): Buffer {
    return TRANSPARENT_GIF_BUFFER;
  }

  /**
   * Record email open event idempotently.
   * Updates CampaignRecipient.openedAt and increments Campaign.openedCount on first open.
   * Records an EmailEvent (OPENED) audit row.
   */
  public static async recordOpen(
    recipientId: string,
    meta?: { userAgent?: string; ip?: string }
  ): Promise<void> {
    if (!recipientId) return;

    try {
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
        include: {
          campaign: true,
        },
      });

      if (!recipient) {
        console.warn(`[TrackingService] Open pixel received for unknown recipient: ${recipientId}`);
        return;
      }

      const now = new Date();

      // If this is the first open, record openedAt on recipient and increment Campaign.openedCount
      if (!recipient.openedAt) {
        await prisma.$transaction([
          prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { openedAt: now },
          }),
          prisma.campaign.update({
            where: { id: recipient.campaignId },
            data: { openedCount: { increment: 1 } },
          }),
        ]);
        console.log(
          `[TrackingService] Recorded first open for recipient ${recipient.email} (Campaign: ${recipient.campaign.name})`
        );
      }

      // Record EmailEvent row for analytics timeline
      await prisma.emailEvent.create({
        data: {
          workspaceId: recipient.campaign.workspaceId,
          campaignId: recipient.campaignId,
          campaignRecipientId: recipient.id,
          contactId: recipient.contactId,
          provider: recipient.provider || "GMAIL_SMTP",
          providerEventId: `open_${recipient.id}_${Date.now()}`,
          eventType: EmailEventType.OPENED,
          occurredAt: now,
          metadata: {
            userAgent: meta?.userAgent || null,
            ip: meta?.ip || null,
          },
        },
      });
    } catch (err: any) {
      console.error(`[TrackingService] Error recording open for recipient ${recipientId}:`, err.message);
    }
  }

  /**
   * Record link click event.
   * Updates CampaignRecipient.clickedAt and increments Campaign.clickedCount on first click.
   * Also ensures openedAt is recorded if not already set.
   * Records an EmailEvent (CLICKED) audit row.
   */
  public static async recordClick(
    recipientId: string,
    targetUrl: string,
    meta?: { userAgent?: string; ip?: string }
  ): Promise<string> {
    const defaultUrl = this.getPublicBaseUrl();
    let validatedUrl = defaultUrl;

    if (targetUrl) {
      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          validatedUrl = targetUrl;
        }
      } catch {
        validatedUrl = defaultUrl;
      }
    }

    if (!recipientId) return validatedUrl;

    try {
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
        include: {
          campaign: true,
        },
      });

      if (!recipient) {
        console.warn(`[TrackingService] Click received for unknown recipient: ${recipientId}`);
        return validatedUrl;
      }

      const now = new Date();

      // If clicked, it implies the email was opened. Update opened and clicked stats atomically.
      if (!recipient.openedAt || !recipient.clickedAt) {
        await prisma.$transaction(async (tx) => {
          if (!recipient.openedAt) {
            await tx.campaignRecipient.update({
              where: { id: recipient.id },
              data: { openedAt: now },
            });
            await tx.campaign.update({
              where: { id: recipient.campaignId },
              data: { openedCount: { increment: 1 } },
            });
          }

          if (!recipient.clickedAt) {
            await tx.campaignRecipient.update({
              where: { id: recipient.id },
              data: { clickedAt: now },
            });
            await tx.campaign.update({
              where: { id: recipient.campaignId },
              data: { clickedCount: { increment: 1 } },
            });
          }
        });

        console.log(
          `[TrackingService] Recorded click for recipient ${recipient.email} -> ${validatedUrl}`
        );
      }

      // Record EmailEvent row for analytics timeline
      await prisma.emailEvent.create({
        data: {
          workspaceId: recipient.campaign.workspaceId,
          campaignId: recipient.campaignId,
          campaignRecipientId: recipient.id,
          contactId: recipient.contactId,
          provider: recipient.provider || "GMAIL_SMTP",
          providerEventId: `click_${recipient.id}_${Date.now()}`,
          eventType: EmailEventType.CLICKED,
          occurredAt: now,
          metadata: {
            targetUrl: validatedUrl,
            userAgent: meta?.userAgent || null,
            ip: meta?.ip || null,
          },
        },
      });
    } catch (err: any) {
      console.error(`[TrackingService] Error recording click for recipient ${recipientId}:`, err.message);
    }

    return validatedUrl;
  }

  /**
   * Injects tracking pixel and wraps all external hyperlinks with redirect tracking.
   */
  public static injectTracking(html: string, recipientId: string): string {
    if (!html || !recipientId) return html || "";

    const baseUrl = this.getPublicBaseUrl();

    // 1. Wrap clickable hyperlinks: <a ... href="http..." ...>
    // Exclude unsubscribe URLs, mailto, tel, anchors (#), and existing track links
    let modifiedHtml = html.replace(
      /(<a\b[^>]*?\bhref=["'])(https?:\/\/[^"'>]+)(["'][^>]*>)/gi,
      (fullMatch, prefix, rawUrl, suffix) => {
        const lowerUrl = rawUrl.toLowerCase();
        if (
          lowerUrl.includes("/track/") ||
          lowerUrl.includes("/api/track/") ||
          lowerUrl.includes("unsubscribe") ||
          lowerUrl.includes("/webhooks/unsubscribe")
        ) {
          return fullMatch;
        }

        const trackedUrl = `${baseUrl}/api/track/click/${recipientId}?url=${encodeURIComponent(rawUrl)}`;
        return `${prefix}${trackedUrl}${suffix}`;
      }
    );

    // 2. Inject 1x1 transparent tracking pixel
    const trackingPixel = `<img src="${baseUrl}/api/track/open/${recipientId}" width="1" height="1" alt="" style="display:none!important;width:1px!important;height:1px!important;max-height:0!important;max-width:0!important;opacity:0!important;overflow:hidden!important;mso-hide:all;" />`;

    if (modifiedHtml.includes("</body>")) {
      modifiedHtml = modifiedHtml.replace("</body>", `${trackingPixel}</body>`);
    } else {
      modifiedHtml += trackingPixel;
    }

    return modifiedHtml;
  }
}
