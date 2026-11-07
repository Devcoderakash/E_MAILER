import { Request, Response, NextFunction } from "express";
import { WorkspaceService } from "./workspace.service";
import { z } from "zod";

const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(60, "Workspace name cannot exceed 60 characters"),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(60, "Workspace name cannot exceed 60 characters"),
});

export class WorkspaceController {
  /**
   * GET /api/workspaces
   * Returns all workspaces for the authenticated user
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { message: "Unauthorized", statusCode: 401 },
        });
        return;
      }

      const workspaces = await WorkspaceService.listUserWorkspaces(req.user.id);

      res.status(200).json({
        success: true,
        data: { workspaces },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces
   * Creates a new workspace for the authenticated user
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { message: "Unauthorized", statusCode: 401 },
        });
        return;
      }

      const body = createWorkspaceSchema.parse(req.body);
      const workspace = await WorkspaceService.createWorkspace(req.user.id, body.name);

      res.status(201).json({
        success: true,
        data: { workspace },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/workspaces/:id
   * Updates workspace name. Enforces owner/admin permissions.
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { message: "Unauthorized", statusCode: 401 },
        });
        return;
      }

      const workspaceId = req.params.id;
      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: { message: "Workspace ID is required", statusCode: 400 },
        });
        return;
      }

      const body = updateWorkspaceSchema.parse(req.body);
      const workspace = await WorkspaceService.updateWorkspace(
        req.user.id,
        workspaceId,
        body.name
      );

      res.status(200).json({
        success: true,
        data: { workspace },
      });
    } catch (err: any) {
      if (err.statusCode) {
        res.status(err.statusCode).json({
          success: false,
          error: { message: err.message, statusCode: err.statusCode },
        });
        return;
      }
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:id/switch
   * Sets the workspace as the user's active workspace. Enforces membership verification.
   */
  static async switch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { message: "Unauthorized", statusCode: 401 },
        });
        return;
      }

      const workspaceId = req.params.id;
      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: { message: "Workspace ID is required", statusCode: 400 },
        });
        return;
      }

      const workspace = await WorkspaceService.switchActiveWorkspace(
        req.user.id,
        workspaceId
      );

      res.status(200).json({
        success: true,
        data: { activeWorkspace: workspace },
      });
    } catch (err: any) {
      if (err.statusCode) {
        res.status(err.statusCode).json({
          success: false,
          error: { message: err.message, statusCode: err.statusCode },
        });
        return;
      }
      next(err);
    }
  }
}

