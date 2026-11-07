import { Queue } from "bullmq";
import { redis } from "../config/redis";

export interface ResendWebhookJobData {
  provider: "RESEND";
  providerEventId: string;
  eventType: string; // e.g. "email.sent", "email.delivered", "email.opened", "email.clicked", "email.bounced", "email.complained", "email.delivery_delayed"
  occurredAt: string;
  data: {
    email_id: string; // Resend message ID
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

export const WEBHOOK_QUEUE_NAME = "webhook-processing-queue";

export const webhookQueue = new Queue<ResendWebhookJobData>(WEBHOOK_QUEUE_NAME, {
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
