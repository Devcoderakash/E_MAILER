import { Queue } from "bullmq";
import { redis } from "../config/redis";

export interface EmailWebhookJobData {
  provider: "RESEND" | "BREVO";
  providerEventId: string;
  eventType: string; // e.g. "email.delivered", "delivered", "opened", "click", "hard_bounce", etc.
  occurredAt: string;
  data: {
    email_id: string; // Provider message ID
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    click?: {
      link?: string;
      ipAddress?: string;
      userAgent?: string;
    };
    bounce?: {
      type?: string;
      message?: string;
    };
    [key: string]: any;
  };
  headers?: Record<string, string>;
}

export type ResendWebhookJobData = EmailWebhookJobData;

export const WEBHOOK_QUEUE_NAME = "webhook-processing-queue";

export const webhookQueue = new Queue<EmailWebhookJobData>(WEBHOOK_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/**
 * Enqueue webhook event with deterministic deduplication job ID
 */
export async function addWebhookJob(jobData: ResendWebhookJobData) {
  const jobId = `webhook_${jobData.provider}_${jobData.providerEventId}`;
  return webhookQueue.add("process-webhook-event", jobData, {
    jobId,
  });
}
