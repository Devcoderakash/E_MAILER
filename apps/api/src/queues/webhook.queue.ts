import { Queue } from "bullmq";
import { redis } from "../config/redis";

export interface EmailEventJobData {
  provider: string;
  providerEventId: string;
  eventType: string;
  occurredAt: string;
  data: {
    email_id: string;
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

export const webhookQueue = new Queue<EmailEventJobData>(WEBHOOK_QUEUE_NAME, {
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
 * Enqueue email event with deterministic deduplication job ID
 */
export async function addWebhookJob(jobData: EmailEventJobData) {
  const jobId = `event_${jobData.provider}_${jobData.providerEventId}`;
  return webhookQueue.add("process-webhook-event", jobData, {
    jobId,
  });
}
