import { addTestJob, testQueue, testQueueEvents } from "./test.queue";
import { createTestWorker } from "../workers/test.worker";
import { redis } from "../config/redis";

async function runQueueVerification() {
  console.log("🚀 Starting BullMQ queue & worker verification test...");

  // Start test worker
  const worker = createTestWorker();
  await worker.waitUntilReady();
  await testQueueEvents.waitUntilReady();
  console.log(" Worker and QueueEvents are ready and listening on queue.");

  const testId = `test-${Date.now()}`;
  console.log(`📤 Dispatching test job with testId: ${testId}...`);

  const job = await addTestJob({
    testId,
    message: "MailPilot Phase 1 Queue Verification Job",
    timestamp: new Date().toISOString(),
  });

  console.log(` Job #${job.id} enqueued.`);

  // Wait for job completion
  const result = await job.waitUntilFinished(testQueueEvents);
  console.log(" Job completed successfully! Output:", JSON.stringify(result, null, 2));

  // Teardown connections cleanly
  await worker.close();
  await testQueueEvents.close();
  await testQueue.close();
  await redis.quit();

  console.log("🎉 BullMQ verification passed successfully!");
  process.exit(0);
}

runQueueVerification().catch(async (err) => {
  console.error("❌ BullMQ verification failed:", err);
  try {
    await testQueueEvents.close();
    await testQueue.close();
    await redis.quit();
  } catch {}
  process.exit(1);
});

