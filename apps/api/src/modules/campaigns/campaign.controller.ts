import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  CampaignService,
  PaginationParams,
  RecipientPaginationParams,
} from "./campaign.service";
import { CampaignStatus, CampaignRecipientStatus } from "@prisma/client";

// ==========================================
// Validation Schemas
// ==========================================

const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(100),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  preheader: z.string().trim().max(250).optional().nullable(),
  fromName: z.string().trim().min(1, "Sender name is required").max(100),
  fromEmail: z.string().trim().email("Valid sender email is required"),
  replyTo: z.string().trim().email("Reply-to must be a valid email").optional().nullable().or(z.literal("")),
  templateId: z.string().trim().optional().nullable().or(z.literal("")),
  htmlContent: z.string().min(1, "HTML content is required"),
  targetListIds: z.array(z.string()).optional(),
  targetTagIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  preheader: z.string().trim().max(250).optional().nullable(),
  fromName: z.string().trim().min(1).max(100).optional(),
  fromEmail: z.string().trim().email().optional(),
  replyTo: z.string().trim().email().optional().nullable().or(z.literal("")),
  templateId: z.string().trim().optional().nullable().or(z.literal("")),
  htmlContent: z.string().optional(),
  targetListIds: z.array(z.string()).optional(),
  targetTagIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(CampaignStatus).optional(),
});

export class CampaignController {
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
   * GET /api/campaigns
   * List campaigns
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const params: PaginationParams = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        search: req.query.search as string | undefined,
        status: req.query.status as CampaignStatus | undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: (req.query.sortOrder as any) || "desc",
      };

      const result = await CampaignService.getCampaigns(workspaceId, params);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/campaigns/:id
   * Get campaign by ID
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const campaign = await CampaignService.getCampaignById(workspaceId, req.params.id);
      res.status(200).json({
        success: true,
        data: campaign,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/campaigns
   * Create campaign
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const validated = createCampaignSchema.parse(req.body);

      const campaign = await CampaignService.createCampaign(workspaceId, {
        ...validated,
        replyTo: validated.replyTo || null,
        templateId: validated.templateId || null,
      });

      res.status(201).json({
        success: true,
        data: campaign,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/campaigns/:id
   * Update campaign
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const validated = updateCampaignSchema.parse(req.body);

      const campaign = await CampaignService.updateCampaign(workspaceId, req.params.id, {
        ...validated,
        replyTo: validated.replyTo === "" ? null : validated.replyTo,
        templateId: validated.templateId === "" ? null : validated.templateId,
      });

      res.status(200).json({
        success: true,
        data: campaign,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/campaigns/:id
   * Delete campaign
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const result = await CampaignService.deleteCampaign(workspaceId, req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/campaigns/:id/duplicate
   * Duplicate campaign
   */
  static async duplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const duplicated = await CampaignService.duplicateCampaign(workspaceId, req.params.id);
      res.status(201).json({
        success: true,
        data: duplicated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/campaigns/:id/validate
   * Check campaign readiness
   */
  static async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const validation = await CampaignService.validateCampaign(workspaceId, req.params.id);
      res.status(200).json({
        success: true,
        data: validation,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/campaigns/:id/send
   * Trigger sending
   */
  static async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const campaign = await CampaignService.sendCampaign(workspaceId, req.params.id);
      res.status(200).json({
        success: true,
        data: campaign,
        message: "Campaign queued for sending successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/campaigns/:id/cancel
   * Cancel an in-flight campaign
   */
  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const campaign = await CampaignService.cancelCampaign(workspaceId, req.params.id);
      res.status(200).json({
        success: true,
        data: campaign,
        message: "Campaign cancelled successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/campaigns/:id/recipients
   * Get paginated recipient logs
   */
  static async getRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const params: RecipientPaginationParams = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        search: req.query.search as string | undefined,
        status: req.query.status as CampaignRecipientStatus | undefined,
      };

      const result = await CampaignService.getCampaignRecipients(
        workspaceId,
        req.params.id,
        params
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
   * GET /api/campaigns/:id/stats
   * Get delivery metrics
   */
  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await CampaignController.getWorkspace(req);
      const stats = await CampaignService.getCampaignStats(workspaceId, req.params.id);
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }
}
