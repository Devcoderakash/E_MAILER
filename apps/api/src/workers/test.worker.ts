import { Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { TEST_QUEUE_NAME, TestJobData, TestJobResult } from "../queues/test.queue";

export function createTestWorker() {
  const worker = new Worker<TestJobData, TestJobResult>(
    TEST_QUEUE_NAME,
    async (job: Job<TestJobData, TestJobResult>) => {
      console.log(`[TestWorker] Processing job #${job.id} - testId: ${job.data.testId}`);
      
      // Simulate light async work
      await new Promise((resolve) => setTimeout(resolve, 100));

      return {
        processed: true,
        testId: job.data.testId,
        processedAt: new Date().toISOString(),
      };
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[TestWorker] Job #${job.id} completed successfully.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[TestWorker] Job #${job?.id} failed with error:`, err.message);
  });

  return worker;
}
