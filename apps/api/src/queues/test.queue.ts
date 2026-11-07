import { Queue, QueueEvents } from "bullmq";
import { redis } from "../config/redis";

export const TEST_QUEUE_NAME = "mailpilot-test-queue";

export interface TestJobData {
  testId: string;
  message: string;
  timestamp: string;
}

export interface TestJobResult {
  processed: boolean;
  testId: string;
  processedAt: string;
}

export const testQueue = new Queue<TestJobData, TestJobResult>(TEST_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const testQueueEvents = new QueueEvents(TEST_QUEUE_NAME, {
  connection: redis,
});

export async function addTestJob(data: TestJobData) {
  return await testQueue.add("test-job", data);
}

