import { Request, Response, NextFunction } from "express";
import { CampaignService } from "../campaigns/campaign.service";
import { AnalyticsService, AnalyticsDateFilter } from "./analytics.service";

export class AnalyticsController {
  private static async getWorkspace(req: Request) {
    if (!req.user) {
      const err: any = new Error("Unauthorized");
      err.statusCode = 401;
      throw err;
    }
    const requestedWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
    return await CampaignService.resolveActiveWorkspace(req.user.id, requestedWorkspaceId);
  }

  private static parseFilter(query: any): AnalyticsDateFilter {
    return {
      range: query.range as any,
      startDate: query.startDate ? String(query.startDate) : undefined,
      endDate: query.endDate ? String(query.endDate) : undefined,
    };
  }

  /**
   * GET /api/analytics/overview
   */
  static async getOverview(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AnalyticsController.getWorkspace(req);
      const filter = AnalyticsController.parseFilter(req.query);

      const metrics = await AnalyticsService.getOverviewMetrics(workspaceId, filter);
      res.status(200).json(metrics);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/campaigns
   */
  static async getCampaigns(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AnalyticsController.getWorkspace(req);
      const filter = AnalyticsController.parseFilter(req.query);
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const search = req.query.search ? String(req.query.search) : undefined;

      const result = await AnalyticsService.getCampaignsAnalytics(workspaceId, {
        ...filter,
        page,
        limit,
        search,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/campaigns/:id
   */
  static async getCampaignDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AnalyticsController.getWorkspace(req);
      const campaignId = req.params.id;

      const detail = await AnalyticsService.getCampaignDetailAnalytics(
        workspaceId,
        campaignId
      );

      res.status(200).json(detail);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/timeline
   */
  static async getTimeline(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AnalyticsController.getWorkspace(req);
      const filter = AnalyticsController.parseFilter(req.query);

      const timeline = await AnalyticsService.getTimelineSeries(workspaceId, filter);
      res.status(200).json({ items: timeline });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/engagement
   */
  static async getEngagement(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AnalyticsController.getWorkspace(req);
      const filter = AnalyticsController.parseFilter(req.query);

      const insights = await AnalyticsService.getEngagementInsights(workspaceId, filter);
      res.status(200).json(insights);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/deliverability
   */
  static async getDeliverability(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AnalyticsController.getWorkspace(req);
      const filter = AnalyticsController.parseFilter(req.query);

      const items = await AnalyticsService.getDeliverabilityByDomain(
        workspaceId,
        filter
      );
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  }
}
