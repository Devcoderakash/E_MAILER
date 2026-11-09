import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { env } from "../../config/env";
import { CampaignRecipientStatus } from "@prisma/client";

export interface GmailQuotaStatus {
  dailyLimit: number;
  sentLast24h: number;
  remaining: number;
  percentageUsed: number;
  status: "HEALTHY" | "WARNING" | "EXCEEDED";
  isWithinQuota: boolean;
  rollingWindowHours: number;
  nextResetAt: string;
  notes: string;
}

export class GmailQuotaService {
  // Default personal Gmail limit is 500 recipients / 24h rolling window.
  // We use 450 as default to retain a 50-email safety buffer for ad-hoc transactional and test emails.
  public static readonly DEFAULT_DAILY_LIMIT = 500;
  public static readonly SAFE_SENDING_CEILING = 450;
  private static readonly REDIS_KEY_PREFIX = "mailpilot:gmail_quota:";

  /**
   * Get quota status for a workspace or system default Gmail account.
   */
  public static async getQuotaStatus(workspaceId?: string): Promise<GmailQuotaStatus> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const limit = GmailQuotaService.SAFE_SENDING_CEILING;

    // 1. Query actual database count of sent recipients in rolling 24 hours
    const dbCount = await prisma.campaignRecipient.count({
      where: {
        status: {
          in: [CampaignRecipientStatus.SENT, CampaignRecipientStatus.DELIVERED],
        },
        sentAt: {
          gte: twentyFourHoursAgo,
        },
        ...(workspaceId ? { campaign: { workspaceId } } : {}),
      },
    });

    // 2. Query Redis cache for any transient test emails or real-time increments
    const redisKey = this.getRedisKey(workspaceId);
    let redisCounter = 0;
    try {
      const val = await redis.get(redisKey);
      if (val) {
        redisCounter = parseInt(val, 10) || 0;
      }
    } catch {
      // Redis fallback to DB count
    }

    const effectiveSent = Math.max(dbCount, redisCounter);
    const remaining = Math.max(0, limit - effectiveSent);
    const percentageUsed = Math.min(100, Math.round((effectiveSent / limit) * 100));

    let status: GmailQuotaStatus["status"] = "HEALTHY";
    if (remaining <= 0) {
      status = "EXCEEDED";
    } else if (remaining < 100) {
      status = "WARNING";
    }

    // Next reset estimate: 24h from now or oldest sent email in window
    const oldestInWindow = await prisma.campaignRecipient.findFirst({
      where: {
        status: {
          in: [CampaignRecipientStatus.SENT, CampaignRecipientStatus.DELIVERED],
        },
        sentAt: {
          gte: twentyFourHoursAgo,
        },
        ...(workspaceId ? { campaign: { workspaceId } } : {}),
      },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    });

    const nextResetAt = oldestInWindow?.sentAt
      ? new Date(oldestInWindow.sentAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const notes =
      status === "EXCEEDED"
        ? `Daily Gmail sending quota reached (${effectiveSent}/${limit}). To prevent Google account suspension, sending is paused until rolling window resets.`
        : status === "WARNING"
        ? `Approaching Gmail 24-hour quota limit (${effectiveSent}/${limit}). Only ${remaining} sends remaining in current 24-hour window.`
        : `Gmail quota is healthy (${effectiveSent}/${limit} used, ${remaining} available in rolling 24h window).`;

    return {
      dailyLimit: limit,
      sentLast24h: effectiveSent,
      remaining,
      percentageUsed,
      status,
      isWithinQuota: remaining > 0,
      rollingWindowHours: 24,
      nextResetAt,
      notes,
    };
  }

  /**
   * Check if a proposed send count can fit within remaining Gmail quota.
   */
  public static async canSendBatch(
    count: number,
    workspaceId?: string
  ): Promise<{ canSend: boolean; remaining: number; resetAt: string; message?: string }> {
    const quota = await this.getQuotaStatus(workspaceId);

    if (quota.remaining < count) {
      return {
        canSend: false,
        remaining: quota.remaining,
        resetAt: quota.nextResetAt,
        message: `Recipient batch of ${count} exceeds available Gmail quota (${quota.remaining} remaining today). Google enforces a 500 emails/day rolling limit for standard Gmail accounts.`,
      };
    }

    return {
      canSend: true,
      remaining: quota.remaining,
      resetAt: quota.nextResetAt,
    };
  }

  /**
   * Record a dispatched email in real-time Redis quota window.
   */
  public static async recordSentEmail(workspaceId?: string): Promise<void> {
    const redisKey = this.getRedisKey(workspaceId);
    try {
      const exists = await redis.exists(redisKey);
      if (!exists) {
        // Initialize with 24-hour expiration
        await redis.set(redisKey, "1", "EX", 24 * 60 * 60);
      } else {
        await redis.incr(redisKey);
      }
    } catch (err) {
      console.warn("[GmailQuotaService] Redis quota increment error:", err);
    }
  }

  private static getRedisKey(workspaceId?: string): string {
    const today = new Date().toISOString().split("T")[0];
    return `${this.REDIS_KEY_PREFIX}${workspaceId || "global"}:${today}`;
  }
}

