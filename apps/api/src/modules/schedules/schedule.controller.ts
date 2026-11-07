import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ScheduleService } from "./schedule.service";
import { CampaignService } from "../campaigns/campaign.service";
import { CampaignStatus } from "@prisma/client";

// ==========================================
// Validation Schemas
// ==========================================

const scheduleCampaignSchema = z.object({
  scheduledAt: z.string().trim().min(1, "Scheduled date/time is required"),
  timezone: z.string().trim().optional(),
});

const rescheduleCampaignSchema = z.object({
  scheduledAt: z.string().trim().min(1, "Rescheduled date/time is required"),
  timezone: z.string().trim().optional(),
});

const calendarQuerySchema = z.object({
  start: z.string().trim().min(1, "Start date is required"),
  end: z.string().trim().min(1, "End date is required"),
  timezone: z.string().trim().optional(),
});

export class ScheduleController {
  private static async getWorkspace(req: Request) {
    if (!req.user) {
      const err: any = new Error("Unauthorized");
      err.statusCode = 401;
      throw err;
    }
    const requestedWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
    return await CampaignService.resolveActiveWorkspace(req.user.id, requestedWorkspaceId);
  }

  /**
   * POST /api/campaigns/:id/schedule
   */
  static async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ScheduleController.getWorkspace(req);
      const validated = scheduleCampaignSchema.parse(req.body);

      const result = await ScheduleService.scheduleCampaign(
        workspaceId,
        req.params.id,
        validated
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Campaign scheduled successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/campaigns/:id/reschedule
   */
  static async reschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ScheduleController.getWorkspace(req);
      const validated = rescheduleCampaignSchema.parse(req.body);

      const result = await ScheduleService.rescheduleCampaign(
        workspaceId,
        req.params.id,
        validated
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Campaign rescheduled successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/campaigns/:id/unschedule
   */
  static async unschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ScheduleController.getWorkspace(req);
      const result = await ScheduleService.unscheduleCampaign(workspaceId, req.params.id);

      res.status(200).json({
        success: true,
        data: result,
        message: "Campaign unscheduled successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/schedules
   * Lists scheduled campaigns
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ScheduleController.getWorkspace(req);

      const result = await ScheduleService.getSchedules(workspaceId, {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        search: req.query.search as string | undefined,
        status: req.query.status as CampaignStatus | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        timezone: req.query.timezone as string | undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/schedules/calendar
   * Returns scheduled campaigns for a calendar date range
   */
  static async calendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ScheduleController.getWorkspace(req);
      const query = calendarQuerySchema.parse(req.query);

      const result = await ScheduleService.getCalendarSchedules(
        workspaceId,
        query.start,
        query.end,
        query.timezone
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/schedules/:id
   * Returns single schedule details with delayed job status
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ScheduleController.getWorkspace(req);
      const timezone = req.query.timezone as string | undefined;

      const result = await ScheduleService.getScheduleById(
        workspaceId,
        req.params.id,
        timezone
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
