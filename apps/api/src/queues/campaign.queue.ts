import { Queue, QueueEvents } from "bullmq";
import { redis } from "../config/redis";

export const CAMPAIGN_QUEUE_NAME = "mailpilot-campaign-queue";

export interface CampaignDispatchJobData {
  campaignId: string;
  workspaceId: string;
  recipientIds: string[];
  batchIndex: number;
  totalBatches: number;
}

export interface CampaignDispatchJobResult {
  campaignId: string;
  batchIndex: number;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  completedAt: string;
}

export const campaignQueue = new Queue<CampaignDispatchJobData, CampaignDispatchJobResult>(
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

export async function addCampaignDispatchJob(data: CampaignDispatchJobData) {
  const jobId = `campaign_${data.campaignId}_batch_${data.batchIndex}`;
  return await campaignQueue.add("dispatch-batch", data, {
    jobId,
  });
}
