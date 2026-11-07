import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { z } from "zod";
import { prisma } from "../../config/database";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export class AuthController {
  /**
   * GET /api/auth/me
   * Returns current authenticated user, their active workspace, available workspaces,
   * and automatically provisions default workspace if needed.
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { message: "Unauthorized: Missing authentication session", statusCode: 401 },
        });
        return;
      }

      const authContext = await AuthService.syncUserFromSupabase(req.user);

      res.status(200).json({
        success: true,
        data: {
          profile: authContext.profile,
          activeWorkspace: authContext.activeWorkspace,
          workspaces: authContext.workspaces,
          auth: {
            id: req.user.id,
            email: req.user.email,
            phone: req.user.phone,
            lastSignInAt: req.user.last_sign_in_at,
            createdAt: req.user.created_at,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/auth/profile
   * Updates user profile fields in PostgreSQL.
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { message: "Unauthorized", statusCode: 401 },
        });
        return;
      }

      const body = updateProfileSchema.parse(req.body);

      const updated = await prisma.user.update({
        where: { supabaseId: req.user.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
        },
      });

      res.status(200).json({
        success: true,
        data: {
          profile: {
            id: updated.id,
            supabaseId: updated.supabaseId,
            email: updated.email,
            name: updated.name,
            role: updated.role,
            activeWorkspaceId: updated.activeWorkspaceId,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
