import { Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { prisma } from "../config/database";
import {
  WEBHOOK_QUEUE_NAME,
  EmailWebhookJobData,
} from "../queues/webhook.queue";
import {
  EmailEventType,
  CampaignRecipientStatus,
  ContactStatus,
} from "@prisma/client";

/**
 * Maps webhook event type strings to Prisma EmailEventType enum for all supported providers
 */
export function mapWebhookEventType(
  provider: string,
  eventTypeStr: string
): EmailEventType | null {
  const normalized = eventTypeStr.toLowerCase().trim();

  // Brevo specific event types
  if (provider === "BREVO") {
    switch (normalized) {
      case "sent":
      case "request":
        return EmailEventType.SENT;

      case "delivered":
        return EmailEventType.DELIVERED;

      case "opened":
      case "unique_opened":
        return EmailEventType.OPENED;

      case "click":
      case "clicked":
        return EmailEventType.CLICKED;

      case "soft_bounce":
      case "hard_bounce":
      case "invalid_email":
      case "blocked":
      case "error":
        return EmailEventType.BOUNCED;

      case "spam":
        return EmailEventType.COMPLAINED;

      case "unsubscribed":
        return EmailEventType.UNSUBSCRIBED;

      case "deferred":
        return EmailEventType.DELIVERY_DELAYED;

      default:
        break;
    }
  }

  // Resend or generic mapping
  switch (normalized) {
    case "email.sent":
    case "sent":
    case "request":
      return EmailEventType.SENT;

    case "email.delivered":
    case "delivered":
      return EmailEventType.DELIVERED;

    case "email.opened":
    case "opened":
      return EmailEventType.OPENED;

    case "email.clicked":
    case "clicked":
      return EmailEventType.CLICKED;

    case "email.bounced":
    case "bounced":
    case "soft_bounce":
    case "hard_bounce":
    case "invalid_email":
    case "blocked":
    case "error":
      return EmailEventType.BOUNCED;

    case "email.complained":
    case "complained":
    case "spam":
      return EmailEventType.COMPLAINED;

    case "email.unsubscribed":
    case "unsubscribed":
      return EmailEventType.UNSUBSCRIBED;

    case "email.delivery_delayed":
    case "delivery_delayed":
    case "deferred":
      return EmailEventType.DELIVERY_DELAYED;

    default:
      return null;
  }
}

// Retain for backwards compatibility
export const mapResendEventType = (typeStr: string) => mapWebhookEventType("RESEND", typeStr);

/**
 * Core event processing logic
 */
export async function processWebhookEvent(jobData: EmailWebhookJobData) {
  const { provider, providerEventId, eventType, occurredAt, data } = jobData;

  const rawEmailId = data?.email_id || data?.raw_message_id;
  if (!rawEmailId) {
    console.warn(
      `[WebhookWorker] Missing data.email_id in webhook job ${providerEventId}. Acknowledging.`
    );
    return { status: "skipped", reason: "missing_email_id" };
  }

  const cleanEmailId = String(rawEmailId).replace(/^<|>$/g, "").trim();

  // 1. Idempotency Check: Reject duplicate event
  const existingEvent = await prisma.emailEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider,
        providerEventId,
      },
    },
  });

  if (existingEvent) {
    console.log(
      `[WebhookWorker] Event ${provider}:${providerEventId} already processed. Skipping.`
    );
    return { status: "duplicate", id: existingEvent.id };
  }

  // 2. Match CampaignRecipient by providerMessageId (supporting clean ID, with angle brackets, or raw)
  const recipient = await prisma.campaignRecipient.findFirst({
    where: {
      OR: [
        { providerMessageId: cleanEmailId },
        { providerMessageId: `<${cleanEmailId}>` },
        { providerMessageId: rawEmailId },
      ],
    },
    include: {
      campaign: true,
      contact: true,
    },
  });

  if (!recipient) {
    console.warn(
      `[WebhookWorker] No CampaignRecipient found for providerMessageId: ${cleanEmailId} (${provider}). Acknowledging.`
    );
    return { status: "unmatched", emailId: cleanEmailId };
  }

  // 3. Map event type
  const mappedType = mapWebhookEventType(provider, eventType);
  if (!mappedType) {
    console.warn(
      `[WebhookWorker] Unsupported event type: ${eventType} for provider ${provider}. Acknowledging.`
    );
    return { status: "unsupported_event", eventType };
  }

  const eventTimestamp = occurredAt ? new Date(occurredAt) : new Date();

  // 4. Persist EmailEvent (workspace verified from matched campaign)
  const emailEvent = await prisma.emailEvent.create({
    data: {
      workspaceId: recipient.campaign.workspaceId,
      campaignId: recipient.campaignId,
      campaignRecipientId: recipient.id,
      contactId: recipient.contactId,
      provider,
      providerEventId,
      eventType: mappedType,
      occurredAt: eventTimestamp,
      metadata: data as any,
    },
  });

  console.log(
    `[WebhookWorker] Recorded ${mappedType} event for recipient ${recipient.email} (Campaign: ${recipient.campaign.name})`
  );

  // 5. Update Recipient & Campaign stats and Contact suppression
  switch (mappedType) {
    case EmailEventType.DELIVERED: {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: CampaignRecipientStatus.DELIVERED,
          deliveredAt: eventTimestamp,
        },
      });

      await prisma.campaign.update({
        where: { id: recipient.campaignId },
        data: {
          deliveredCount: { increment: 1 },
        },
      });
      break;
    }

    case EmailEventType.OPENED: {
      // If this is the recipient's first open, record openedAt and increment unique openedCount
      if (!recipient.openedAt) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            openedAt: eventTimestamp,
          },
        });

        await prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: {
            openedCount: { increment: 1 },
          },
        });
      }
      break;
    }

    case EmailEventType.CLICKED: {
      // Check if click was an unsubscribe link
      const clickedUrl = data.click?.link?.toLowerCase() || "";
      const isUnsubscribeClick =
        clickedUrl.includes("unsubscribe") || clickedUrl.includes("optout");

      if (!recipient.clickedAt) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            clickedAt: eventTimestamp,
          },
        });

        await prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: {
            clickedCount: { increment: 1 },
          },
        });
      }

      if (isUnsubscribeClick && recipient.contactId) {
        console.log(
          `[WebhookWorker] Contact ${recipient.email} clicked unsubscribe link. Updating status to UNSUBSCRIBED.`
        );
        await prisma.contact.update({
          where: { id: recipient.contactId },
          data: { status: ContactStatus.UNSUBSCRIBED },
        });

        await prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: {
            unsubscribedCount: { increment: 1 },
          },
        });
      }
      break;
    }

    case EmailEventType.BOUNCED: {
      const bounceReason =
        data.bounce?.message || data.bounce?.type || "Bounced by recipient mail server";

      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: CampaignRecipientStatus.BOUNCED,
          bouncedAt: eventTimestamp,
          errorMessage: bounceReason,
        },
      });

      await prisma.campaign.update({
        where: { id: recipient.campaignId },
        data: {
          bouncedCount: { increment: 1 },
        },
      });

      // Strict Suppression: Mark contact as BOUNCED so future campaigns automatically exclude them
      if (recipient.contactId) {
        console.log(
          `[WebhookWorker] Suppressing contact ${recipient.email} due to bounce.`
        );
        await prisma.contact.update({
          where: { id: recipient.contactId },
          data: { status: ContactStatus.BOUNCED },
        });
      }
      break;
    }

    case EmailEventType.COMPLAINED: {
      await prisma.campaign.update({
        where: { id: recipient.campaignId },
        data: {
          complainedCount: { increment: 1 },
        },
      });

      // Strict Suppression: Mark contact as BOUNCED (suppressed) due to spam complaint
      if (recipient.contactId) {
        console.log(
          `[WebhookWorker] Suppressing contact ${recipient.email} due to spam complaint.`
        );
        await prisma.contact.update({
          where: { id: recipient.contactId },
          data: { status: ContactStatus.BOUNCED },
        });
      }
      break;
    }

    case EmailEventType.UNSUBSCRIBED: {
      await prisma.campaign.update({
        where: { id: recipient.campaignId },
        data: {
          unsubscribedCount: { increment: 1 },
        },
      });

      // Strict Suppression: Mark contact as UNSUBSCRIBED
      if (recipient.contactId) {
        console.log(
          `[WebhookWorker] Updating contact ${recipient.email} to UNSUBSCRIBED.`
        );
        await prisma.contact.update({
          where: { id: recipient.contactId },
          data: { status: ContactStatus.UNSUBSCRIBED },
        });
      }
      break;
    }

    default:
      break;
  }

  return { status: "processed", eventId: emailEvent.id, eventType: mappedType };
}

/**
 * Creates and initializes the BullMQ Webhook Worker
 */
export function createWebhookWorker(): Worker<EmailWebhookJobData> {
  const worker = new Worker<EmailWebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    async (job: Job<EmailWebhookJobData>) => {
      console.log(`[WebhookWorker] Processing webhook job #${job.id} (${job.data.eventType})`);
      return processWebhookEvent(job.data);
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[WebhookWorker] Webhook job #${job.id} completed.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[WebhookWorker] Webhook job #${job?.id} failed:`, err.message);
  });

  return worker;
}
