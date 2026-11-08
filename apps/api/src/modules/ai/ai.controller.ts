import { Request, Response, NextFunction } from "express";
import { CampaignService } from "../campaigns/campaign.service";
import { env } from "../../config/env";
import {
  AIService,
  generateSubjectLinesSchema,
  generateEmailDraftSchema,
  generatePreheaderSchema,
  improveCampaignSchema,
  generateWorkflowSchema,
  chatSchema,
} from "./ai.service";

export class AIController {
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
   * GET /api/ai/status
   * Check if Google Gemini AI is configured
   */
  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isConfigured = AIService.isConfigured();
      res.status(200).json({
        configured: isConfigured,
        provider: "Google Gemini",
        model: env.GEMINI_MODEL,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ai/subject-lines
   */
  static async generateSubjectLines(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AIController.getWorkspace(req);
      const validated = generateSubjectLinesSchema.parse(req.body);
      const result = await AIService.generateSubjectLines(workspaceId, validated);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ai/generate-email
   */
  static async generateEmailDraft(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AIController.getWorkspace(req);
      const validated = generateEmailDraftSchema.parse(req.body);
      const result = await AIService.generateEmailDraft(workspaceId, validated);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ai/preheaders
   */
  static async generatePreheader(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AIController.getWorkspace(req);
      const validated = generatePreheaderSchema.parse(req.body);
      const result = await AIService.generatePreheader(workspaceId, validated);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ai/improve
   */
  static async improveCampaign(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AIController.getWorkspace(req);
      const validated = improveCampaignSchema.parse(req.body);
      const result = await AIService.improveCampaign(workspaceId, validated);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ai/generate-workflow
   */
  static async generateWorkflow(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AIController.getWorkspace(req);
      const validated = generateWorkflowSchema.parse(req.body);
      const result = await AIService.generateWorkflow(workspaceId, validated);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ai/chat
   */
  static async chat(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { workspaceId } = await AIController.getWorkspace(req);
      const validated = chatSchema.parse(req.body);
      const result = await AIService.chatCopilot(workspaceId, validated);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
