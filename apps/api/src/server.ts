import { createApp } from "./app";
import { env } from "./config/env";
import { redis } from "./config/redis";
import { prisma } from "./config/database";
import { createCampaignWorker } from "./workers/campaign.worker";
import { createWebhookWorker } from "./workers/webhook.worker";
import { createAutomationWorker } from "./workers/automation.worker";
import { ScheduleService } from "./modules/schedules/schedule.service";

const app = createApp();

const campaignWorker = createCampaignWorker();
const webhookWorker = createWebhookWorker();
const automationWorker = createAutomationWorker();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 [MailPilot API] Server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`📡 Health endpoint available at http://localhost:${env.PORT}/health`);

  // Reconcile scheduled campaigns in PostgreSQL with delayed jobs in BullMQ on startup
  ScheduleService.reconcileScheduledJobs().catch((err: any) => {
    console.error("❌ [ScheduleService] Startup reconciliation error:", err.message);
  });
});

let isShuttingDown = false;

// Graceful Shutdown
async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log(" HTTP server closed.");

    try {
      if (campaignWorker) {
        await campaignWorker.close();
        console.log(" Campaign worker closed.");
      }
      if (webhookWorker) {
        await webhookWorker.close();
        console.log(" Webhook worker closed.");
      }
      if (automationWorker) {
        await automationWorker.close();
        console.log(" Automation worker closed.");
      }
    } catch (err: any) {
      console.error("❌ Error closing campaign worker:", err.message);
    }

    try {
      await redis.quit();
      console.log(" Redis connection closed.");
    } catch (err: any) {
      console.error("❌ Error closing Redis:", err.message);
    }

    try {
      await prisma.$disconnect();
      console.log(" Prisma database connection closed.");
    } catch (err: any) {
      console.error("❌ Error disconnecting Prisma:", err.message);
    }

    console.log("✨ Graceful shutdown complete. Exiting process.");
    process.exit(0);
  });

  // Force shutdown after 10s if dangling connections persist
  setTimeout(() => {
    console.error("⚠️ Forcefully terminating process due to shutdown timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

