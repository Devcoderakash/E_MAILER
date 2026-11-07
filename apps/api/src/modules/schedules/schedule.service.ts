import { prisma } from "../../config/database";
import { CampaignStatus, Prisma } from "@prisma/client";
import {
  campaignQueue,
  addScheduledCampaignJob,
  removeScheduledCampaignJob,
  getScheduledJobId,
} from "../../queues/campaign.queue";
import { CampaignService } from "../campaigns/campaign.service";
import {
  isValidTimezone,
  parseLocalToUtcDate,
  formatInTimezone,
} from "../../utils/timezone";

export interface ScheduleCampaignParams {
  scheduledAt: string;
  timezone?: string;
}

export interface ListSchedulesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CampaignStatus;
  from?: string;
  to?: string;
  timezone?: string;
}

export class ScheduleService {
  /**
   * Schedule a campaign for future delivery
   */
  static async scheduleCampaign(
    workspaceId: string,
    campaignId: string,
    params: ScheduleCampaignParams
  ) {
    // 1. Validate timezone (default to UTC if omitted)
    const timezone = params.timezone?.trim() || "UTC";
    if (!isValidTimezone(timezone)) {
      const err: any = new Error(`Invalid IANA timezone: "${params.timezone}"`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Convert input date/time to UTC
    let scheduledUtc: Date;
    try {
      scheduledUtc = parseLocalToUtcDate(params.scheduledAt, timezone);
    } catch (e: any) {
      const err: any = new Error(`Invalid schedule date/time: ${e.message}`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Validate scheduled time is in the future
    const now = Date.now();
    const delayMs = scheduledUtc.getTime() - now;
    if (delayMs <= 0) {
      const err: any = new Error(
        `Scheduled time must be in the future. Selected: ${scheduledUtc.toISOString()} (UTC), Current: ${new Date(now).toISOString()} (UTC)`
      );
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate campaign exists
    const campaign = await CampaignService.getCampaignById(workspaceId, campaignId);

    // Only DRAFT or SCHEDULED campaigns can be scheduled
    if (
      campaign.status !== CampaignStatus.DRAFT &&
      campaign.status !== CampaignStatus.SCHEDULED
    ) {
      const err: any = new Error(
        `Cannot schedule campaign in "${campaign.status}" status. Only DRAFT campaigns can be scheduled.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Validate campaign readiness (subject, sender, HTML, active audience > 0)
    const validation = await CampaignService.validateCampaign(workspaceId, campaignId);
    if (!validation.canSend) {
      const err: any = new Error(
        `Campaign cannot be scheduled because pre-flight validation failed: ${validation.errors.join("; ")}`
      );
      err.statusCode = 400;
      throw err;
    }

    // Add or replace delayed job in BullMQ
    const job = await addScheduledCampaignJob(
      campaignId,
      workspaceId,
      scheduledUtc.toISOString(),
      delayMs
    );

    // Update campaign in PostgreSQL (Source of Truth)
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: scheduledUtc,
        scheduledTimezone: timezone,
        scheduledJobId: job.id,
        lastScheduledAt: new Date(),
        schedulingError: null,
      },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    console.log(
      `[ScheduleService] Scheduled campaign ${campaignId} for ${scheduledUtc.toISOString()} UTC (${timezone}) with job #${job.id} (Delay: ${Math.round(delayMs / 1000)}s)`
    );

    return {
      ...updated,
      delaySeconds: Math.round(delayMs / 1000),
      formattedScheduledTime: formatInTimezone(scheduledUtc, timezone),
    };
  }

  /**
   * Reschedule an existing scheduled campaign
   */
  static async rescheduleCampaign(
    workspaceId: string,
    campaignId: string,
    params: ScheduleCampaignParams
  ) {
    // 1. Validate timezone
    const timezone = params.timezone?.trim() || "UTC";
    if (!isValidTimezone(timezone)) {
      const err: any = new Error(`Invalid IANA timezone: "${params.timezone}"`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Parse and convert to UTC
    let scheduledUtc: Date;
    try {
      scheduledUtc = parseLocalToUtcDate(params.scheduledAt, timezone);
    } catch (e: any) {
      const err: any = new Error(`Invalid reschedule date/time: ${e.message}`);
      err.statusCode = 400;
      throw err;
    }

    const now = Date.now();
    const delayMs = scheduledUtc.getTime() - now;
    if (delayMs <= 0) {
      const err: any = new Error(`Rescheduled time must be in the future.`);
      err.statusCode = 400;
      throw err;
    }

    const campaign = await CampaignService.getCampaignById(workspaceId, campaignId);

    // Can only reschedule a campaign that is currently SCHEDULED
    if (campaign.status !== CampaignStatus.SCHEDULED) {
      const err: any = new Error(
        `Cannot reschedule campaign in "${campaign.status}" status. Only SCHEDULED campaigns can be rescheduled.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Replace delayed job in BullMQ
    const job = await addScheduledCampaignJob(
      campaignId,
      workspaceId,
      scheduledUtc.toISOString(),
      delayMs
    );

    // Update in DB
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        scheduledAt: scheduledUtc,
        scheduledTimezone: timezone,
        scheduledJobId: job.id,
        lastScheduledAt: new Date(),
        schedulingError: null,
      },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    console.log(
      `[ScheduleService] Rescheduled campaign ${campaignId} to ${scheduledUtc.toISOString()} UTC (${timezone}) with job #${job.id}`
    );

    return {
      ...updated,
      delaySeconds: Math.round(delayMs / 1000),
      formattedScheduledTime: formatInTimezone(scheduledUtc, timezone),
    };
  }

  /**
   * Unschedule a campaign (cancels delayed job and returns campaign to DRAFT)
   */
  static async unscheduleCampaign(workspaceId: string, campaignId: string) {
    const campaign = await CampaignService.getCampaignById(workspaceId, campaignId);

    if (campaign.status !== CampaignStatus.SCHEDULED) {
      const err: any = new Error(
        `Cannot unschedule campaign in "${campaign.status}" status. Only SCHEDULED campaigns can be unscheduled.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Remove delayed job from Redis
    await removeScheduledCampaignJob(campaignId);

    // Return status to DRAFT and clear scheduledJobId
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.DRAFT,
        scheduledJobId: null,
        schedulingError: null,
      },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    console.log(`[ScheduleService] Unscheduled campaign ${campaignId}. Reverted to DRAFT.`);

    return updated;
  }

  /**
   * List scheduled campaigns for workspace
   */
  static async getSchedules(workspaceId: string, params: ListSchedulesParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = {
      workspaceId,
      ...(params.status
        ? { status: params.status }
        : {
            OR: [
              { status: CampaignStatus.SCHEDULED },
              { scheduledAt: { not: null } },
            ],
          }),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { subject: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(params.from || params.to
        ? {
            scheduledAt: {
              ...(params.from ? { gte: new Date(params.from) } : {}),
              ...(params.to ? { lte: new Date(params.to) } : {}),
            },
          }
        : {}),
    };

    const targetTz = params.timezone || "UTC";

    const total = await prisma.campaign.count({ where });
    const items = await prisma.campaign.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    const formattedItems = items.map((item) => {
      const delaySeconds =
        item.scheduledAt && item.status === CampaignStatus.SCHEDULED
          ? Math.max(0, Math.round((item.scheduledAt.getTime() - Date.now()) / 1000))
          : null;

      return {
        ...item,
        delaySeconds,
        formattedScheduledTime: item.scheduledAt
          ? formatInTimezone(item.scheduledAt, targetTz)
          : null,
      };
    });

    return {
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calendar schedule entries within a date range
   */
  static async getCalendarSchedules(
    workspaceId: string,
    startIso: string,
    endIso: string,
    timezone?: string
  ) {
    const start = new Date(startIso);
    const end = new Date(endIso);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err: any = new Error("Invalid start or end date range for calendar.");
      err.statusCode = 400;
      throw err;
    }

    const targetTz = timezone || "UTC";

    const campaigns = await prisma.campaign.findMany({
      where: {
        workspaceId,
        OR: [
          {
            scheduledAt: {
              gte: start,
              lte: end,
            },
          },
          {
            status: CampaignStatus.SCHEDULED,
          },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    return campaigns.map((c) => ({
      ...c,
      formattedScheduledTime: c.scheduledAt
        ? formatInTimezone(c.scheduledAt, targetTz)
        : null,
      isOverdue:
        c.status === CampaignStatus.SCHEDULED &&
        c.scheduledAt &&
        c.scheduledAt.getTime() < Date.now(),
    }));
  }

  /**
   * Get single schedule with delayed job status in Redis
   */
  static async getScheduleById(
    workspaceId: string,
    campaignId: string,
    timezone?: string
  ) {
    const campaign = await CampaignService.getCampaignById(workspaceId, campaignId);

    const targetTz = timezone || campaign.scheduledTimezone || "UTC";

    let jobStatus: string | null = null;
    let jobDelayRemainingMs: number | null = null;

    if (campaign.scheduledJobId) {
      try {
        const job = await campaignQueue.getJob(campaign.scheduledJobId);
        if (job) {
          const state = await job.getState();
          jobStatus = state;
          const delay = job.opts.delay || 0;
          const jobTimestamp = job.timestamp;
          const elapsed = Date.now() - jobTimestamp;
          jobDelayRemainingMs = Math.max(0, delay - elapsed);
        } else {
          jobStatus = "not_found";
        }
      } catch {
        jobStatus = "redis_unavailable";
      }
    }

    return {
      campaign,
      schedule: {
        scheduledAtUtc: campaign.scheduledAt,
        scheduledTimezone: campaign.scheduledTimezone,
        formattedScheduledTime: campaign.scheduledAt
          ? formatInTimezone(campaign.scheduledAt, targetTz)
          : null,
        scheduledJobId: campaign.scheduledJobId,
        jobStatus,
        jobDelayRemainingMs,
        schedulingError: campaign.schedulingError,
      },
    };
  }

  /**
   * Reconcile scheduled campaigns in PostgreSQL with delayed jobs in BullMQ / Redis on startup
   */
  static async reconcileScheduledJobs(): Promise<{
    totalScheduled: number;
    recovered: number;
    executedDue: number;
    removedStale: number;
  }> {
    console.log("🔄 [ScheduleService] Starting PostgreSQL <-> Redis schedule reconciliation...");

    // 1. Fetch all SCHEDULED campaigns from PostgreSQL
    const scheduledCampaigns = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: { not: null },
      },
    });

    let recovered = 0;
    let executedDue = 0;
    const now = Date.now();
    const scheduledIdsSet = new Set(scheduledCampaigns.map((c) => c.id));

    for (const campaign of scheduledCampaigns) {
      const scheduledTime = campaign.scheduledAt!.getTime();
      const delayMs = scheduledTime - now;

      // Overdue: Scheduled time has already passed while server/Redis was down
      if (delayMs <= 0) {
        console.log(
          `[ScheduleService] Campaign ${campaign.id} is due/overdue (scheduled for ${campaign.scheduledAt!.toISOString()}). Executing immediately...`
        );
        try {
          // Revalidate before firing
          const validation = await CampaignService.validateCampaign(
            campaign.workspaceId,
            campaign.id
          );
          if (validation.canSend) {
            await CampaignService.sendCampaign(campaign.workspaceId, campaign.id);
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { scheduledJobId: null, schedulingError: null },
            });
            executedDue++;
          } else {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: {
                status: CampaignStatus.FAILED,
                schedulingError: `Overdue execution failed validation: ${validation.errors.join("; ")}`,
                scheduledJobId: null,
              },
            });
          }
        } catch (err: any) {
          console.error(
            `[ScheduleService] Failed to execute overdue campaign ${campaign.id}:`,
            err.message
          );
        }
        continue;
      }

      // Future: Verify job exists in BullMQ delayed set
      const expectedJobId = getScheduledJobId(campaign.id);
      let jobExists = false;
      try {
        const job = await campaignQueue.getJob(expectedJobId);
        if (job) {
          const state = await job.getState();
          if (state === "delayed" || state === "waiting") {
            jobExists = true;
          }
        }
      } catch (err: any) {
        console.warn(`[ScheduleService] Could not check job status for ${expectedJobId}:`, err.message);
      }

      // If missing in BullMQ, recover it!
      if (!jobExists) {
        console.log(
          `[ScheduleService] Recovering missing BullMQ delayed job for campaign ${campaign.id} (Due in ${Math.round(delayMs / 1000)}s)...`
        );
        try {
          const job = await addScheduledCampaignJob(
            campaign.id,
            campaign.workspaceId,
            campaign.scheduledAt!.toISOString(),
            delayMs
          );
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { scheduledJobId: job.id },
          });
          recovered++;
        } catch (err: any) {
          console.error(`[ScheduleService] Failed to recover job for ${campaign.id}:`, err.message);
        }
      }
    }

    // 2. Remove stale delayed jobs from Redis for campaigns that are no longer SCHEDULED
    let removedStale = 0;
    try {
      const delayedJobs = await campaignQueue.getDelayed();
      for (const job of delayedJobs) {
        if (job.name === "execute-scheduled-campaign") {
          const campId = job.data?.campaignId;
          if (campId && !scheduledIdsSet.has(campId)) {
            console.log(
              `[ScheduleService] Removing stale delayed job #${job.id} for non-scheduled campaign ${campId}`
            );
            await job.remove();
            removedStale++;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[ScheduleService] Could not inspect delayed jobs in Redis:`, err.message);
    }

    console.log(
      `✅ [ScheduleService] Reconciliation finished. Total scheduled: ${scheduledCampaigns.length}, Recovered: ${recovered}, Executed Due: ${executedDue}, Stale Removed: ${removedStale}.`
    );

    return {
      totalScheduled: scheduledCampaigns.length,
      recovered,
      executedDue,
      removedStale,
    };
  }
}
