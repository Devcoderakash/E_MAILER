import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { TemplateService, PaginationParams } from "./template.service";
import { TemplateCategory, TemplateStatus } from "@prisma/client";

// ==========================================
// Validation Schemas
// ==========================================

const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(100, "Name cannot exceed 100 characters"),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.nativeEnum(TemplateCategory).optional(),
  subject: z.string().trim().max(200).optional().nullable(),
  preheader: z.string().trim().max(250).optional().nullable(),
  htmlContent: z.string().min(1, "HTML content is required"),
  editorContent: z.any().optional().nullable(),
  status: z.nativeEnum(TemplateStatus).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.nativeEnum(TemplateCategory).optional(),
  subject: z.string().trim().max(200).optional().nullable(),
  preheader: z.string().trim().max(250).optional().nullable(),
  htmlContent: z.string().optional(),
  editorContent: z.any().optional().nullable(),
  status: z.nativeEnum(TemplateStatus).optional(),
});

export class TemplateController {
  private static async getWorkspace(req: Request) {
    if (!req.user) {
      const err: any = new Error("Unauthorized");
      err.statusCode = 401;
      throw err;
    }
    const requestedWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
    return await TemplateService.resolveActiveWorkspace(req.user.id, requestedWorkspaceId);
  }

  /**
   * GET /api/templates
   * Lists templates with filtering, search, and pagination
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await TemplateController.getWorkspace(req);

      const params: PaginationParams = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        search: req.query.search as string | undefined,
        category: req.query.category as TemplateCategory | undefined,
        status: req.query.status as TemplateStatus | undefined,
        sortBy: req.query.sortBy as "createdAt" | "updatedAt" | "name" | undefined,
        sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
      };

      const result = await TemplateService.getTemplates(workspaceId, params);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/templates/:id
   * Retrieves single template
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await TemplateController.getWorkspace(req);
      const template = await TemplateService.getTemplateById(workspaceId, req.params.id);

      res.status(200).json({
        success: true,
        data: { template },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/templates
   * Creates new template in active workspace
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await TemplateController.getWorkspace(req);
      const parsed = createTemplateSchema.parse(req.body);

      const template = await TemplateService.createTemplate(workspaceId, {
        name: parsed.name,
        description: parsed.description || undefined,
        category: parsed.category,
        subject: parsed.subject || undefined,
        preheader: parsed.preheader || undefined,
        htmlContent: parsed.htmlContent,
        editorContent: parsed.editorContent,
        status: parsed.status,
      });

      res.status(201).json({
        success: true,
        data: { template },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/templates/:id
   * Updates an existing template
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await TemplateController.getWorkspace(req);
      const parsed = updateTemplateSchema.parse(req.body);

      const template = await TemplateService.updateTemplate(workspaceId, req.params.id, parsed);

      res.status(200).json({
        success: true,
        data: { template },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/templates/:id
   * Deletes template
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await TemplateController.getWorkspace(req);
      const result = await TemplateService.deleteTemplate(workspaceId, req.params.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/templates/:id/duplicate
   * Duplicates an existing template
   */
  static async duplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await TemplateController.getWorkspace(req);
      const template = await TemplateService.duplicateTemplate(workspaceId, req.params.id);

      res.status(201).json({
        success: true,
        data: { template },
      });
    } catch (err) {
      next(err);
    }
  }
}
