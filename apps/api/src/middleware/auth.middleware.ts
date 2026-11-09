import { Request, Response, NextFunction } from "express";
import { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "../config/supabase";

// Extend Express Request to include authenticated user and active workspace
declare global {
  namespace Express {
    interface Request {
      user?: User;
      workspaceId?: string;
    }
  }
}

/**
 * Middleware: Verify Supabase JWT Bearer token
 * Validates token against Supabase Auth service.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or malformed Authorization header. Expected 'Bearer <token>'.",
    });
    return;
  }

  const token = authHeader.split(" ")[1]?.trim();

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or malformed Authorization header. Expected 'Bearer <token>'.",
    });
    return;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        error: "Unauthorized",
        message: error?.message || "Invalid or expired authentication token.",
      });
      return;
    }

    req.user = user;

    // Automatically ensure user & default workspace exist in PostgreSQL database
    try {
      const { AuthService } = await import("../modules/auth/auth.service");
      await AuthService.syncUserFromSupabase(user);
    } catch (syncErr: any) {
      console.warn("[AuthMiddleware] User auto-sync notice:", syncErr.message);
    }

    next();
  } catch (err: any) {
    res.status(500).json({
      error: "AuthenticationError",
      message: "An unexpected error occurred during token verification.",
    });
  }
}

/**
 * Middleware: Verify and resolve active workspace for authenticated user
 */
export async function requireWorkspace(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", message: "User not authenticated." });
      return;
    }

    const { CampaignService } = await import("../modules/campaigns/campaign.service");
    const requestedWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
    const { workspaceId } = await CampaignService.resolveActiveWorkspace(
      req.user.id,
      requestedWorkspaceId
    );

    req.workspaceId = workspaceId;
    next();
  } catch (err: any) {
    res.status(403).json({
      error: "WorkspaceForbidden",
      message: err.message || "Failed to resolve active workspace.",
    });
  }
}


