import { Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { prisma } from "../config/database";
import {
  CAMPAIGN_QUEUE_NAME,
  CampaignJobData,
  CampaignDispatchJobData,
  ScheduledCampaignJobData,
  CampaignDispatchJobResult,
} from "../queues/campaign.queue";
import { ResendProvider } from "../providers/resend.provider";
import { CampaignService } from "../modules/campaigns/campaign.service";
import { CampaignStatus, CampaignRecipientStatus } from "@prisma/client";

export function createCampaignWorker() {
  const worker = new Worker<CampaignJobData, CampaignDispatchJobResult>(
    CAMPAIGN_QUEUE_NAME,
    async (job: Job<CampaignJobData, CampaignDispatchJobResult>) => {
      // ==========================================
      // Handler 1: Scheduled Campaign Execution
      // ==========================================
      if (job.name === "execute-scheduled-campaign") {
        const { campaignId, workspaceId } = job.data as ScheduledCampaignJobData;
        console.log(
          `[CampaignWorker] Delayed scheduled job #${job.id} triggered for campaign ${campaignId}`
        );

        const campaign = await prisma.campaign.findFirst({
          where: { id: campaignId, workspaceId },
        });

        if (!campaign) {
          console.warn(`[CampaignWorker] Scheduled campaign ${campaignId} not found in workspace ${workspaceId}.`);
          return {
            campaignId,
            completedAt: new Date().toISOString(),
            scheduledExecution: true,
          };
        }

        // Only proceed if still in SCHEDULED status
        if (campaign.status !== CampaignStatus.SCHEDULED) {
          console.log(
            `[CampaignWorker] Campaign ${campaignId} status is ${campaign.status} (expected SCHEDULED). Aborting scheduled send.`
          );
          return {
            campaignId,
            completedAt: new Date().toISOString(),
            scheduledExecution: true,
          };
        }

        // Revalidate campaign readiness before firing
        const validation = await CampaignService.validateCampaign(workspaceId, campaignId);
        if (!validation.canSend) {
          const errorMsg = `Scheduled execution failed validation: ${validation.errors.join("; ")}`;
          console.error(`[CampaignWorker] ${errorMsg}`);

          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              status: CampaignStatus.FAILED,
              schedulingError: errorMsg,
              scheduledJobId: null,
            },
          });

          return {
            campaignId,
            failedCount: 1,
            completedAt: new Date().toISOString(),
            scheduledExecution: true,
          };
        }

        // Trigger existing campaign sending pipeline
        console.log(
          `[CampaignWorker] Campaign ${campaignId} validated successfully. Handing off to sendCampaign engine...`
        );
        await CampaignService.sendCampaign(workspaceId, campaignId);

        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            scheduledJobId: null,
            schedulingError: null,
          },
        });

        return {
          campaignId,
          completedAt: new Date().toISOString(),
          scheduledExecution: true,
        };
      }

      // ==========================================
      // Handler 2: Batch Recipient Dispatch
      // ==========================================
      const { campaignId, workspaceId, recipientIds, batchIndex, totalBatches } =
        job.data as CampaignDispatchJobData;

      console.log(
        `[CampaignWorker] Starting batch ${batchIndex + 1}/${totalBatches} for campaign ${campaignId} (${recipientIds.length} recipients)`
      );

      // Verify campaign exists and check current status
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, workspaceId },
        include: {
          workspace: true,
        },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found in workspace ${workspaceId}`);
      }

      // If campaign has been cancelled or paused, mark recipients as SKIPPED
      if (campaign.status === CampaignStatus.CANCELLED || campaign.status === CampaignStatus.PAUSED) {
        console.log(
          `[CampaignWorker] Campaign ${campaignId} is ${campaign.status}. Skipping batch ${batchIndex + 1}.`
        );
        await prisma.campaignRecipient.updateMany({
          where: {
            id: { in: recipientIds },
            status: CampaignRecipientStatus.PENDING,
          },
          data: {
            status: CampaignRecipientStatus.SKIPPED,
            errorMessage: `Campaign was ${campaign.status.toLowerCase()}`,
          },
        });

        return {
          campaignId,
          batchIndex,
          processedCount: recipientIds.length,
          sentCount: 0,
          failedCount: 0,
          skippedCount: recipientIds.length,
          completedAt: new Date().toISOString(),
        };
      }

      // Mark campaign as SENDING and record startedAt if not set yet
      if (campaign.status !== CampaignStatus.SENDING) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: CampaignStatus.SENDING,
            startedAt: campaign.startedAt || new Date(),
          },
        });
      }

      let sentCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      // Process recipients in batch
      for (const recipientId of recipientIds) {
        // Double-check if campaign was cancelled in-flight
        const currentCampaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });

        if (currentCampaign?.status === CampaignStatus.CANCELLED) {
          await prisma.campaignRecipient.updateMany({
            where: {
              id: recipientId,
              status: CampaignRecipientStatus.PENDING,
            },
            data: {
              status: CampaignRecipientStatus.SKIPPED,
              errorMessage: "Campaign cancelled in-flight",
            },
          });
          skippedCount++;
          continue;
        }

        // Fetch recipient
        const recipient = await prisma.campaignRecipient.findUnique({
          where: { id: recipientId },
          include: { contact: true },
        });

        if (!recipient || recipient.status !== CampaignRecipientStatus.PENDING) {
          // Already handled or missing
          skippedCount++;
          continue;
        }

        // Transition recipient to PROCESSING
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: CampaignRecipientStatus.PROCESSING,
            attempts: { increment: 1 },
          },
        });

        // Merge tags
        const personalizedSubject = ResendProvider.interpolateMergeTags(campaign.subject, {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          company: recipient.contact?.company || null,
          subject: campaign.subject,
        });

        const personalizedHtml = ResendProvider.interpolateMergeTags(campaign.htmlContent, {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          company: recipient.contact?.company || null,
          subject: campaign.subject,
        });

        // Dispatch email via Resend
        const sendResult = await ResendProvider.send({
          to: recipient.email,
          fromName: campaign.fromName,
          fromEmail: campaign.fromEmail,
          replyTo: campaign.replyTo,
          subject: personalizedSubject,
          html: personalizedHtml,
          preheader: campaign.preheader,
          tags: [
            { name: "campaign_id", value: campaign.id },
            { name: "workspace_id", value: campaign.workspaceId },
          ],
        });

        if (sendResult.success) {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: CampaignRecipientStatus.SENT,
              sentAt: new Date(),
              providerMessageId: sendResult.messageId || null,
            },
          });

          await prisma.campaign.update({
            where: { id: campaignId },
            data: { sentCount: { increment: 1 } },
          });

          sentCount++;
        } else {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: CampaignRecipientStatus.FAILED,
              errorMessage: sendResult.error || "Delivery failed",
            },
          });

          await prisma.campaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 } },
          });

          failedCount++;
        }
      }

      // Check if any recipients for this campaign are still PENDING or PROCESSING
      const remainingRecipients = await prisma.campaignRecipient.count({
        where: {
          campaignId,
          status: {
            in: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.PROCESSING],
          },
        },
      });

      if (remainingRecipients === 0) {
        // Check final stats to determine completed status
        const totalSent = await prisma.campaignRecipient.count({
          where: { campaignId, status: CampaignRecipientStatus.SENT },
        });

        const finalStatus = totalSent > 0 ? CampaignStatus.SENT : CampaignStatus.FAILED;

        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: finalStatus,
            completedAt: new Date(),
          },
        });

        console.log(
          `[CampaignWorker] Campaign ${campaignId} completely dispatched! Status: ${finalStatus} (Sent: ${totalSent})`
        );
      }

      return {
        campaignId,
        batchIndex,
        processedCount: recipientIds.length,
        sentCount,
        failedCount,
        skippedCount,
        completedAt: new Date().toISOString(),
      };
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[CampaignWorker] Job #${job.id} (${job.name}) completed.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[CampaignWorker] Job #${job?.id} (${job?.name}) failed:`, err.message);
  });

  return worker;
}
