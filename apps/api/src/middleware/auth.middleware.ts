import { Request, Response, NextFunction } from "express";
import { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "../config/supabase";

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User;
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
    next();
  } catch (err: any) {
    res.status(500).json({
      error: "AuthenticationError",
      message: "An unexpected error occurred during token verification.",
    });
  }
}

