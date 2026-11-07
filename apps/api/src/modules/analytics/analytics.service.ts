import { prisma } from "../../config/database";
import { EmailEventType, CampaignRecipientStatus } from "@prisma/client";

export interface AnalyticsDateFilter {
  range?: "7d" | "30d" | "90d" | "custom";
  startDate?: string;
  endDate?: string;
}

export interface OverviewMetrics {
  sent: number;
  delivered: number;
  deliveryRate: number; // percentage (0 - 100)
  totalOpens: number;
  uniqueOpens: number;
  openRate: number; // percentage (0 - 100)
  totalClicks: number;
  uniqueClicks: number;
  clickRate: number; // percentage (0 - 100)
  bounces: number;
  bounceRate: number; // percentage (0 - 100)
  complaints: number;
  complaintRate: number;
  unsubscribes: number;
  unsubscribeRate: number;
  totalCampaigns: number;
  activeContacts: number;
  hasProviderEvents: boolean;
}

export interface TimelineBucket {
  date: string; // YYYY-MM-DD
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
}

export interface DomainDeliverabilityItem {
  domain: string;
  sent: number;
  delivered: number;
  deliveryRate: number;
  bounces: number;
  bounceRate: number;
  status: "Optimal" | "Good" | "Needs Attention";
}

export class AnalyticsService {
  /**
   * Resolves startDate and endDate from query parameters
   */
  static resolveDateRange(filter: AnalyticsDateFilter): { start: Date; end: Date } {
    const end = filter.endDate ? new Date(filter.endDate) : new Date();
    let start: Date;

    if (filter.startDate) {
      start = new Date(filter.startDate);
    } else {
      const days = filter.range === "7d" ? 7 : filter.range === "90d" ? 90 : 30;
      start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  /**
   * Helper to safely calculate percentage rate
   */
  static calculateRate(numerator: number, denominator: number): number {
    if (!denominator || denominator <= 0) return 0;
    const rate = (numerator / denominator) * 100;
    return Math.round(rate * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Get workspace-scoped overview KPI metrics
   */
  static async getOverviewMetrics(
    workspaceId: string,
    filter: AnalyticsDateFilter
  ): Promise<OverviewMetrics> {
    const { start, end } = this.resolveDateRange(filter);

    // 1. Sent count from campaign recipients in this workspace within the window
    const sentRecipientsCount = await prisma.campaignRecipient.count({
      where: {
        campaign: { workspaceId },
        sentAt: { gte: start, lte: end },
        status: { notIn: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.SKIPPED] },
      },
    });

    // 2. Fetch aggregated event counts from EmailEvent table for precision
    const events = await prisma.emailEvent.findMany({
      where: {
        workspaceId,
        occurredAt: { gte: start, lte: end },
      },
      select: {
        eventType: true,
        campaignRecipientId: true,
      },
    });

    const hasProviderEvents = events.length > 0;

    let deliveredEventsCount = 0;
    let totalOpens = 0;
    let totalClicks = 0;
    let bounces = 0;
    let complaints = 0;
    let unsubscribes = 0;

    const uniqueOpenedRecipients = new Set<string>();
    const uniqueClickedRecipients = new Set<string>();

    for (const evt of events) {
      switch (evt.eventType) {
        case EmailEventType.DELIVERED:
          deliveredEventsCount++;
          break;
        case EmailEventType.OPENED:
          totalOpens++;
          if (evt.campaignRecipientId) uniqueOpenedRecipients.add(evt.campaignRecipientId);
          break;
        case EmailEventType.CLICKED:
          totalClicks++;
          if (evt.campaignRecipientId) uniqueClickedRecipients.add(evt.campaignRecipientId);
          break;
        case EmailEventType.BOUNCED:
          bounces++;
          break;
        case EmailEventType.COMPLAINED:
          complaints++;
          break;
        case EmailEventType.UNSUBSCRIBED:
          unsubscribes++;
          break;
        default:
          break;
      }
    }

    // If delivered events exist, use them; if not yet received from webhooks, fall back to sentRecipients - bounces
    const delivered = hasProviderEvents
      ? deliveredEventsCount
      : Math.max(0, sentRecipientsCount - bounces);

    const uniqueOpens = uniqueOpenedRecipients.size;
    const uniqueClicks = uniqueClickedRecipients.size;

    // Rates
    const deliveryRate = this.calculateRate(delivered, sentRecipientsCount);
    // Denominator for open rate and click rate is delivered recipients
    const openRate = this.calculateRate(uniqueOpens, delivered);
    const clickRate = this.calculateRate(uniqueClicks, delivered);
    const bounceRate = this.calculateRate(bounces, sentRecipientsCount);
    const complaintRate = this.calculateRate(complaints, delivered);
    const unsubscribeRate = this.calculateRate(unsubscribes, delivered);

    // Context metrics
    const totalCampaigns = await prisma.campaign.count({
      where: {
        workspaceId,
        createdAt: { gte: start, lte: end },
      },
    });

    const activeContacts = await prisma.contact.count({
      where: {
        workspaceId,
        status: "ACTIVE",
      },
    });

    return {
      sent: sentRecipientsCount,
      delivered,
      deliveryRate,
      totalOpens,
      uniqueOpens,
      openRate,
      totalClicks,
      uniqueClicks,
      clickRate,
      bounces,
      bounceRate,
      complaints,
      complaintRate,
      unsubscribes,
      unsubscribeRate,
      totalCampaigns,
      activeContacts,
      hasProviderEvents,
    };
  }

  /**
   * Get campaigns comparison list with performance analytics
   */
  static async getCampaignsAnalytics(
    workspaceId: string,
    filter: AnalyticsDateFilter & { page?: number; limit?: number; search?: string }
  ) {
    const { start, end } = this.resolveDateRange(filter);
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      workspaceId,
      createdAt: { gte: start, lte: end },
    };

    if (filter.search?.trim()) {
      whereClause.OR = [
        { name: { contains: filter.search.trim(), mode: "insensitive" } },
        { subject: { contains: filter.search.trim(), mode: "insensitive" } },
      ];
    }

    const total = await prisma.campaign.count({ where: whereClause });

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const items = await Promise.all(
      campaigns.map(async (camp) => {
        // Query unique opens and unique clicks for this campaign
        const [uniqueOpensResult, uniqueClicksResult] = await Promise.all([
          prisma.emailEvent.groupBy({
            by: ["campaignRecipientId"],
            where: { campaignId: camp.id, eventType: EmailEventType.OPENED },
          }),
          prisma.emailEvent.groupBy({
            by: ["campaignRecipientId"],
            where: { campaignId: camp.id, eventType: EmailEventType.CLICKED },
          }),
        ]);

        const uniqueOpens = uniqueOpensResult.length;
        const uniqueClicks = uniqueClicksResult.length;

        const sent = camp.sentCount;
        const delivered = camp.deliveredCount > 0 ? camp.deliveredCount : sent - camp.bouncedCount;
        const deliveryRate = this.calculateRate(delivered, sent);
        const openRate = this.calculateRate(uniqueOpens, delivered);
        const clickRate = this.calculateRate(uniqueClicks, delivered);
        const bounceRate = this.calculateRate(camp.bouncedCount, sent);

        return {
          id: camp.id,
          name: camp.name,
          subject: camp.subject,
          status: camp.status,
          createdAt: camp.createdAt.toISOString(),
          sentAt: camp.startedAt?.toISOString() || camp.createdAt.toISOString(),
          recipientCount: camp.recipientCount,
          sentCount: sent,
          deliveredCount: delivered,
          deliveryRate,
          uniqueOpens,
          openRate,
          uniqueClicks,
          clickRate,
          bouncedCount: camp.bouncedCount,
          bounceRate,
          complainedCount: camp.complainedCount,
          unsubscribedCount: camp.unsubscribedCount,
          template: camp.template,
        };
      })
    );

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single campaign detailed analytics & timeline
   */
  static async getCampaignDetailAnalytics(workspaceId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    if (!campaign) {
      const err: any = new Error("Campaign not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    // Unique opens and clicks
    const [uniqueOpensResult, uniqueClicksResult, rawEvents] = await Promise.all([
      prisma.emailEvent.groupBy({
        by: ["campaignRecipientId"],
        where: { campaignId, eventType: EmailEventType.OPENED },
      }),
      prisma.emailEvent.groupBy({
        by: ["campaignRecipientId"],
        where: { campaignId, eventType: EmailEventType.CLICKED },
      }),
      prisma.emailEvent.findMany({
        where: { campaignId },
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: {
          campaignRecipient: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const uniqueOpens = uniqueOpensResult.length;
    const uniqueClicks = uniqueClicksResult.length;

    const sent = campaign.sentCount;
    const delivered =
      campaign.deliveredCount > 0 ? campaign.deliveredCount : sent - campaign.bouncedCount;
    const deliveryRate = this.calculateRate(delivered, sent);
    const openRate = this.calculateRate(uniqueOpens, delivered);
    const clickRate = this.calculateRate(uniqueClicks, delivered);
    const bounceRate = this.calculateRate(campaign.bouncedCount, sent);

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        status: campaign.status,
        createdAt: campaign.createdAt.toISOString(),
        startedAt: campaign.startedAt?.toISOString() || null,
        completedAt: campaign.completedAt?.toISOString() || null,
        recipientCount: campaign.recipientCount,
        sentCount: sent,
        deliveredCount: delivered,
        deliveryRate,
        uniqueOpens,
        openRate,
        uniqueClicks,
        clickRate,
        bouncedCount: campaign.bouncedCount,
        bounceRate,
        complainedCount: campaign.complainedCount,
        unsubscribedCount: campaign.unsubscribedCount,
        template: campaign.template,
      },
      recentEvents: rawEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        occurredAt: e.occurredAt.toISOString(),
        recipientEmail: e.campaignRecipient?.email || "Unknown",
        recipientName: e.campaignRecipient?.firstName
          ? `${e.campaignRecipient.firstName} ${e.campaignRecipient.lastName || ""}`.trim()
          : null,
        metadata: e.metadata,
      })),
    };
  }

  /**
   * Get timeline series for performance charts (grouped by day)
   */
  static async getTimelineSeries(
    workspaceId: string,
    filter: AnalyticsDateFilter
  ): Promise<TimelineBucket[]> {
    const { start, end } = this.resolveDateRange(filter);

    // Retrieve events in range
    const events = await prisma.emailEvent.findMany({
      where: {
        workspaceId,
        occurredAt: { gte: start, lte: end },
      },
      select: {
        eventType: true,
        occurredAt: true,
      },
    });

    // Also retrieve recipients sent in range
    const sentRecipients = await prisma.campaignRecipient.findMany({
      where: {
        campaign: { workspaceId },
        sentAt: { gte: start, lte: end },
        status: { notIn: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.SKIPPED] },
      },
      select: {
        sentAt: true,
      },
    });

    // Build day map
    const dayMap = new Map<string, TimelineBucket>();

    // Seed all days in range so charts have a continuous axis
    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().slice(0, 10);
      dayMap.set(dateKey, {
        date: dateKey,
        sent: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        bounces: 0,
      });
      current.setDate(current.getDate() + 1);
    }

    // Populate sent
    for (const r of sentRecipients) {
      if (!r.sentAt) continue;
      const key = r.sentAt.toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        dayMap.get(key)!.sent++;
      }
    }

    // Populate events
    for (const e of events) {
      const key = e.occurredAt.toISOString().slice(0, 10);
      if (!dayMap.has(key)) continue;

      const bucket = dayMap.get(key)!;
      switch (e.eventType) {
        case EmailEventType.DELIVERED:
          bucket.delivered++;
          break;
        case EmailEventType.OPENED:
          bucket.opens++;
          break;
        case EmailEventType.CLICKED:
          bucket.clicks++;
          break;
        case EmailEventType.BOUNCED:
          bucket.bounces++;
          break;
        default:
          break;
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get deliverability metrics broken down by recipient domain (Gmail, Outlook, Yahoo, Apple, etc.)
   */
  static async getDeliverabilityByDomain(
    workspaceId: string,
    filter: AnalyticsDateFilter
  ): Promise<DomainDeliverabilityItem[]> {
    const { start, end } = this.resolveDateRange(filter);

    const recipients = await prisma.campaignRecipient.findMany({
      where: {
        campaign: { workspaceId },
        sentAt: { gte: start, lte: end },
        status: { notIn: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.SKIPPED] },
      },
      select: {
        email: true,
        status: true,
        deliveredAt: true,
        bouncedAt: true,
      },
    });

    const domainGroups = new Map<
      string,
      { sent: number; delivered: number; bounces: number }
    >();

    const getDomainGroup = (email: string): string => {
      const domain = email.split("@")[1]?.toLowerCase() || "other";
      if (domain.includes("gmail") || domain.includes("google")) return "Gmail / Google Workspace";
      if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live") || domain.includes("office365")) {
        return "Microsoft 365 / Outlook";
      }
      if (domain.includes("icloud") || domain.includes("me.com") || domain.includes("apple")) {
        return "Apple Mail / iCloud";
      }
      if (domain.includes("yahoo") || domain.includes("aol") || domain.includes("ymail")) {
        return "Yahoo / AOL";
      }
      return "Corporate / Other Domains";
    };

    for (const r of recipients) {
      const group = getDomainGroup(r.email);
      if (!domainGroups.has(group)) {
        domainGroups.set(group, { sent: 0, delivered: 0, bounces: 0 });
      }
      const data = domainGroups.get(group)!;
      data.sent++;
      if (r.status === CampaignRecipientStatus.BOUNCED || r.bouncedAt) {
        data.bounces++;
      } else {
        data.delivered++;
      }
    }

    const result: DomainDeliverabilityItem[] = [];
    for (const [domain, stats] of domainGroups.entries()) {
      const deliveryRate = this.calculateRate(stats.delivered, stats.sent);
      const bounceRate = this.calculateRate(stats.bounces, stats.sent);

      let status: "Optimal" | "Good" | "Needs Attention" = "Optimal";
      if (deliveryRate < 95 || bounceRate > 5) {
        status = "Needs Attention";
      } else if (deliveryRate < 98 || bounceRate > 2) {
        status = "Good";
      }

      result.push({
        domain,
        sent: stats.sent,
        delivered: stats.delivered,
        deliveryRate,
        bounces: stats.bounces,
        bounceRate,
        status,
      });
    }

    return result.sort((a, b) => b.sent - a.sent);
  }

  /**
   * Get engagement insights: Top clicked links
   */
  static async getEngagementInsights(
    workspaceId: string,
    filter: AnalyticsDateFilter
  ) {
    const { start, end } = this.resolveDateRange(filter);

    const clickEvents = await prisma.emailEvent.findMany({
      where: {
        workspaceId,
        eventType: EmailEventType.CLICKED,
        occurredAt: { gte: start, lte: end },
      },
      select: {
        metadata: true,
        campaignRecipientId: true,
      },
    });

    const linkStats = new Map<string, { totalClicks: number; uniqueRecipients: Set<string> }>();

    for (const evt of clickEvents) {
      const meta = evt.metadata as any;
      const link = meta?.click?.link || meta?.link || "Direct link";
      if (!linkStats.has(link)) {
        linkStats.set(link, { totalClicks: 0, uniqueRecipients: new Set() });
      }
      const entry = linkStats.get(link)!;
      entry.totalClicks++;
      if (evt.campaignRecipientId) {
        entry.uniqueRecipients.add(evt.campaignRecipientId);
      }
    }

    const topLinks = Array.from(linkStats.entries())
      .map(([link, stats]) => ({
        link,
        totalClicks: stats.totalClicks,
        uniqueClicks: stats.uniqueRecipients.size,
      }))
      .sort((a, b) => b.uniqueClicks - a.uniqueClicks)
      .slice(0, 10);

    return {
      topLinks,
      totalClickEvents: clickEvents.length,
    };
  }
}
