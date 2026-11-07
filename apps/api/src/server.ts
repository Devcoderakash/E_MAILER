import { createApp } from "./app";
import { env } from "./config/env";
import { redis } from "./config/redis";
import { prisma } from "./config/database";
import { createCampaignWorker } from "./workers/campaign.worker";

const app = createApp();

const campaignWorker = createCampaignWorker();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 [MailPilot API] Server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`📡 Health endpoint available at http://localhost:${env.PORT}/health`);
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

