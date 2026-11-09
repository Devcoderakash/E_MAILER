import { Queue, QueueEvents, Job } from "bullmq";
import { redis } from "../config/redis";

export const CAMPAIGN_QUEUE_NAME = "mailpilot-campaign-queue";

export interface CampaignDispatchJobData {
  campaignId: string;
  workspaceId: string;
  recipientIds: string[];
  batchIndex: number;
  totalBatches: number;
  isTest?: boolean;
}

export interface ScheduledCampaignJobData {
  campaignId: string;
  workspaceId: string;
  scheduledAt: string; // ISO string
}

export type CampaignJobData = CampaignDispatchJobData | ScheduledCampaignJobData;

export interface CampaignDispatchJobResult {
  campaignId: string;
  batchIndex?: number;
  processedCount?: number;
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
  completedAt: string;
  scheduledExecution?: boolean;
}

export const campaignQueue = new Queue<CampaignJobData, CampaignDispatchJobResult>(
  CAMPAIGN_QUEUE_NAME,
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  }
);

export const campaignQueueEvents = new QueueEvents(CAMPAIGN_QUEUE_NAME, {
  connection: redis,
});

export function getScheduledJobId(campaignId: string): string {
  return `scheduled_campaign_${campaignId}`;
}

export async function addCampaignDispatchJob(data: CampaignDispatchJobData) {
  // Use timestamp and random nonce so re-sends and retries are never silently deduplicated by BullMQ
  const jobId = `campaign_${data.campaignId}_batch_${data.batchIndex}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return await campaignQueue.add("dispatch-batch", data, {
    jobId,
  });
}

/**
 * Enqueue or replace a delayed execution job for a scheduled campaign.
 */
export async function addScheduledCampaignJob(
  campaignId: string,
  workspaceId: string,
  scheduledAt: string,
  delayMs: number
): Promise<Job<CampaignJobData, CampaignDispatchJobResult>> {
  const jobId = getScheduledJobId(campaignId);

  // Remove previous delayed job if it exists to prevent duplicate execution
  await removeScheduledCampaignJob(campaignId);

  const cleanDelay = Math.max(0, Math.floor(delayMs));

  return await campaignQueue.add(
    "execute-scheduled-campaign",
    {
      campaignId,
      workspaceId,
      scheduledAt,
    },
    {
      jobId,
      delay: cleanDelay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000,
      },
    }
  );
}

/**
 * Remove an existing delayed scheduled job from the queue.
 */
export async function removeScheduledCampaignJob(campaignId: string): Promise<boolean> {
  const jobId = getScheduledJobId(campaignId);
  try {
    const job = await campaignQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
  } catch (err: any) {
    console.warn(`[CampaignQueue] Warning removing job ${jobId}:`, err.message);
  }
  return false;
}
