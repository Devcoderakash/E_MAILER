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
   * Returns current authenticated user and automatically syncs their record into Prisma.
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { message: "Unauthorized", statusCode: 401 },
        });
        return;
      }

      const syncedUser = await AuthService.syncUserFromSupabase(req.user);

      res.status(200).json({
        success: true,
        data: {
          profile: syncedUser,
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
        data: { profile: updated },
      });
    } catch (err) {
      next(err);
    }
  }
}

