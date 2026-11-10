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
import { GmailSmtpProvider } from "../providers";
import { CampaignService } from "../modules/campaigns/campaign.service";
import { GoogleCalendarService } from "../modules/schedules/google-calendar.service";
import { GmailQuotaService } from "../modules/providers/gmail-quota.service";
import { UnsubscribeService } from "../modules/webhooks/unsubscribe.service";
import { TrackingService } from "../modules/tracking/tracking.service";
import { env } from "../config/env";
import {
  CampaignStatus,
  CampaignRecipientStatus,
  ContactStatus,
} from "@prisma/client";

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

        // Fetch recipient with contact data
        const recipient = await prisma.campaignRecipient.findUnique({
          where: { id: recipientId },
          include: { contact: true },
        });

        if (!recipient || recipient.status !== CampaignRecipientStatus.PENDING) {
          // Already handled or missing
          skippedCount++;
          continue;
        }

        // Suppression List Guard: Never dispatch to unsubscribed or bounced contacts
        if (
          recipient.contact?.status === ContactStatus.UNSUBSCRIBED ||
          recipient.contact?.status === ContactStatus.BOUNCED
        ) {
          console.log(
            `[CampaignWorker] Suppressing dispatch to ${recipient.email} (Status: ${recipient.contact.status})`
          );
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: CampaignRecipientStatus.SKIPPED,
              errorMessage: `Suppressed: Contact is ${recipient.contact.status.toLowerCase()}`,
            },
          });
          skippedCount++;
          continue;
        }

        // Daily Gmail Quota Guard: Ensure sending does not exceed Google's 500 emails/day rolling limit
        const quotaCheck = await GmailQuotaService.canSendBatch(1, campaign.workspaceId);
        if (!quotaCheck.canSend) {
          console.warn(
            `[CampaignWorker] Daily Gmail quota reached during campaign ${campaignId}. Pausing dispatches.`
          );
          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              status: CampaignStatus.PAUSED,
              schedulingError: `Dispatch paused: Daily Gmail quota limit reached (${quotaCheck.remaining} remaining). Rolling quota resets at ${quotaCheck.resetAt}.`,
            },
          });

          // Keep remaining recipient as PENDING so it can be resumed later
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: CampaignRecipientStatus.PENDING },
          });
          break;
        }

        // Transition recipient to PROCESSING
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: CampaignRecipientStatus.PROCESSING,
            attempts: { increment: 1 },
          },
        });

        // Generate recipient-specific secure, signed unsubscribe URL
        const { url: unsubscribeUrl } = UnsubscribeService.generateUnsubscribeUrl({
          recipientId: recipient.id,
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId,
          email: recipient.email,
        });

        // Merge tags
        const personalizedSubject = GmailSmtpProvider.interpolateMergeTags(campaign.subject, {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          company: recipient.contact?.company || null,
          subject: campaign.subject,
          unsubscribe_url: unsubscribeUrl,
        });

        const personalizedHtml = GmailSmtpProvider.interpolateMergeTags(campaign.htmlContent, {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          company: recipient.contact?.company || null,
          subject: campaign.subject,
          unsubscribe_url: unsubscribeUrl,
        });

        // Inject 1x1 transparent tracking pixel and link redirect tracking
        const trackableHtml = TrackingService.injectTracking(personalizedHtml, recipient.id);

        // Gradual sending delay: Add a human-like delay between recipient dispatches
        // to avoid Google SMTP burst filters (skipped in automated tests)
        const isSimulation = GmailSmtpProvider.isTestModeEnabled() || (job.data as CampaignDispatchJobData).isTest;
        if (!isSimulation) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        // Dispatch email via Gmail SMTP
        const sendResult = await GmailSmtpProvider.send(
          {
            to: recipient.email,
            fromName: campaign.fromName,
            fromEmail: campaign.fromEmail,
            replyTo: campaign.replyTo,
            subject: personalizedSubject,
            html: trackableHtml,
            preheader: campaign.preheader,
            workspaceId: campaign.workspaceId,
            unsubscribeUrl,
          },
          { isTest: isSimulation }
        );

        if (sendResult.success) {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: CampaignRecipientStatus.SENT,
              sentAt: new Date(),
              providerMessageId: sendResult.messageId || null,
              errorMessage: null,
            },
          });

          await prisma.campaign.update({
            where: { id: campaignId },
            data: { sentCount: { increment: 1 } },
          });

          await GmailQuotaService.recordSentEmail(campaign.workspaceId);
          sentCount++;
        } else {
          const failureReason = sendResult.error || "Delivery rejected by email provider";
          console.error(
            `[CampaignWorker] Recipient dispatch failed for ${recipient.email}: ${failureReason}`
          );

          const isPermanent = Boolean(sendResult.isPermanentBounce);
          const finalRecipientStatus = isPermanent
            ? CampaignRecipientStatus.BOUNCED
            : CampaignRecipientStatus.FAILED;

          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: finalRecipientStatus,
              bouncedAt: isPermanent ? new Date() : null,
              errorMessage: failureReason,
            },
          });

          // Automatic Suppression: Permanently flag hard-bounced addresses in PostgreSQL
          if (isPermanent && recipient.contactId) {
            await prisma.contact.update({
              where: { id: recipient.contactId },
              data: { status: ContactStatus.BOUNCED },
            });
            console.log(
              `[CampaignWorker] Automatically marked contact ${recipient.email} as BOUNCED in database to protect sender reputation.`
            );
          }

          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              failedCount: { increment: 1 },
              ...(isPermanent ? { bouncedCount: { increment: 1 } } : {}),
            },
          });

          failedCount++;

          // Handle Gmail Quota Exceeded error dynamically from Google's response
          if (sendResult.isQuotaExceeded) {
            console.warn(
              `[CampaignWorker] Google SMTP returned Quota Exceeded (550 5.4.5). Pausing remaining dispatches.`
            );
            await prisma.campaign.update({
              where: { id: campaignId },
              data: {
                status: CampaignStatus.PAUSED,
                schedulingError:
                  "Google daily sending quota exceeded (500 emails/day). Dispatches paused until rolling window resets.",
              },
            });
            break;
          }
        }
      }

      // Check if any recipients for this campaign are still PENDING or PROCESSING
      // Also automatically mark any orphaned PROCESSING recipients older than 2 minutes as FAILED
      await prisma.campaignRecipient.updateMany({
        where: {
          campaignId,
          status: CampaignRecipientStatus.PROCESSING,
          updatedAt: {
            lt: new Date(Date.now() - 2 * 60 * 1000),
          },
        },
        data: {
          status: CampaignRecipientStatus.FAILED,
          errorMessage: "Dispatch timed out while attempting delivery.",
        },
      });

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
        const totalDispatched = await prisma.campaignRecipient.count({
          where: {
            campaignId,
            status: {
              in: [CampaignRecipientStatus.SENT, CampaignRecipientStatus.DELIVERED],
            },
          },
        });

        const finalStatus = totalDispatched > 0 ? CampaignStatus.SENT : CampaignStatus.FAILED;

        const completedCampaign = await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: finalStatus,
            completedAt: new Date(),
          },
        });

        // Update Google Calendar event description with completion summary
        await GoogleCalendarService.syncCampaignCompleted(workspaceId, completedCampaign);

        console.log(
          `[CampaignWorker] Campaign ${campaignId} completely dispatched! Status: ${finalStatus} (Dispatched: ${totalDispatched})`
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
      concurrency: 1, // Safe single concurrency for personal Gmail SMTP to prevent concurrent session locking
      limiter: {
        max: 1, // 1 batch job per 1.5 seconds max
        duration: 1500,
      },
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
