import { Request, Response, NextFunction } from "express";
import { GoogleCalendarService } from "./google-calendar.service";
import { env } from "../../config/env";

export class GoogleCalendarController {
  /**
   * GET /api/auth/google/calendar
   * Initiates Google Calendar OAuth consent flow
   */
  public static async initiateAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId || (req.headers["x-workspace-id"] as string);
      const userId = req.user?.id;

      if (!workspaceId || !userId) {
        res.status(400).json({ error: "Missing workspace or user context." });
        return;
      }

      if (!GoogleCalendarService.isConfigured()) {
        res.status(503).json({
          error: "Google Calendar integration is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server environment.",
        });
        return;
      }

      const authUrl = GoogleCalendarService.getAuthorizationUrl(workspaceId, userId);

      // If client requests JSON (e.g. from single-page app button)
      if (req.headers.accept?.includes("application/json")) {
        res.json({ url: authUrl });
        return;
      }

      // Otherwise redirect browser directly
      res.redirect(authUrl);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/google/calendar/callback
   * Handles Google OAuth callback code exchange
   */
  public static async handleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      const error = req.query.error as string;

      if (error) {
        console.warn(`[GoogleCalendarController] OAuth error from Google: ${error}`);
        res.redirect(`${env.FRONTEND_URL}/settings?tab=google&calendar_error=${encodeURIComponent(error)}`);
        return;
      }

      if (!code || !state) {
        res.redirect(`${env.FRONTEND_URL}/settings?tab=google&calendar_error=missing_code_or_state`);
        return;
      }

      await GoogleCalendarService.handleOAuthCallback(code, state);

      res.redirect(`${env.FRONTEND_URL}/settings?tab=google&calendar=connected`);
    } catch (err: any) {
      console.error("[GoogleCalendarController] Callback processing error:", err);
      res.redirect(
        `${env.FRONTEND_URL}/settings?tab=google&calendar_error=${encodeURIComponent(err.message || "Failed to exchange tokens")}`
      );
    }
  }

  /**
   * GET /api/auth/google/calendar/status
   */
  public static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId || (req.headers["x-workspace-id"] as string);
      if (!workspaceId) {
        res.status(400).json({ error: "Missing workspace context." });
        return;
      }

      const status = await GoogleCalendarService.getConnectionStatus(workspaceId);
      res.json(status);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/auth/google/calendar
   */
  public static async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId || (req.headers["x-workspace-id"] as string);
      if (!workspaceId) {
        res.status(400).json({ error: "Missing workspace context." });
        return;
      }

      const result = await GoogleCalendarService.disconnect(workspaceId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

