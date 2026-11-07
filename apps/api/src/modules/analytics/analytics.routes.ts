import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { AnalyticsController } from "./analytics.controller";

export const analyticsRouter: Router = Router();

// Protect all analytics endpoints with user authentication
analyticsRouter.use(requireAuth);

// Overview KPI metrics
analyticsRouter.get("/overview", AnalyticsController.getOverview);

// Campaign comparison metrics
analyticsRouter.get("/campaigns", AnalyticsController.getCampaigns);

// Single campaign detail analytics & timeline
analyticsRouter.get("/campaigns/:id", AnalyticsController.getCampaignDetail);

// Time-series timeline for charts
analyticsRouter.get("/timeline", AnalyticsController.getTimeline);

// Engagement insights (clicks, links)
analyticsRouter.get("/engagement", AnalyticsController.getEngagement);

// Deliverability breakdown by domain
analyticsRouter.get("/deliverability", AnalyticsController.getDeliverability);
