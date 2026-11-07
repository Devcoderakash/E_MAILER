import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CampaignService } from "../campaigns/campaign.service";
import { AutomationService } from "./automation.service";

const createAutomationSchema = z.object({
  name: z.string().trim().min(1, "Automation name is required").max(100),
  description: z.string().trim().max(500).optional(),
  triggerType: z.string().trim().optional(),
  workflowDefinition: z.any().optional(),
});

const updateAutomationSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  triggerType: z.string().trim().optional(),
  workflowDefinition: z.any().optional(),
});

export class AutomationController {
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
   * GET /api/automations
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const result = await AutomationService.getAutomations(workspaceId, {
        status: req.query.status as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/automations
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const validated = createAutomationSchema.parse(req.body);
      const automation = await AutomationService.createAutomation(workspaceId, validated);
      res.status(201).json(automation);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/automations/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const automation = await AutomationService.getAutomationById(workspaceId, req.params.id);
      res.status(200).json(automation);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/automations/:id
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const validated = updateAutomationSchema.parse(req.body);
      const updated = await AutomationService.updateAutomation(workspaceId, req.params.id, validated as any);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/automations/:id
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const result = await AutomationService.deleteAutomation(workspaceId, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/automations/:id/validate
   */
  static async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const result = await AutomationService.validateWorkflow(workspaceId, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/automations/:id/activate
   */
  static async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const activated = await AutomationService.activateAutomation(workspaceId, req.params.id);
      res.status(200).json(activated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/automations/:id/pause
   */
  static async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const paused = await AutomationService.pauseAutomation(workspaceId, req.params.id);
      res.status(200).json(paused);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/automations/:id/executions
   */
  static async getExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const executions = await AutomationService.getExecutions(workspaceId, req.params.id, {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        status: req.query.status as string,
      });
      res.status(200).json(executions);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/automations/:id/executions/:executionId
   */
  static async getExecutionDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await AutomationController.getWorkspace(req);
      const execution = await AutomationService.getExecutionDetail(
        workspaceId,
        req.params.id,
        req.params.executionId
      );
      res.status(200).json(execution);
    } catch (err) {
      next(err);
    }
  }
}
