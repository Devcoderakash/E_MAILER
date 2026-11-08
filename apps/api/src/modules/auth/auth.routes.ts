import { Router } from "express";
import { AuthController } from "./auth.controller";
import { requireAuth, requireWorkspace } from "../../middleware/auth.middleware";
import { GoogleCalendarController } from "../schedules/google-calendar.controller";

const router = Router();

// Public OAuth callback from Google (supports both standard and calendar-specific paths)
router.get("/google/calendar/callback", GoogleCalendarController.handleCallback);
router.get("/google/callback", GoogleCalendarController.handleCallback);

// Protected routes
router.get("/me", requireAuth, AuthController.getMe);
router.patch("/profile", requireAuth, AuthController.updateProfile);

// Google Calendar OAuth initiation & management
router.get("/google/calendar", requireAuth, requireWorkspace, GoogleCalendarController.initiateAuth);
router.get("/google/calendar/status", requireAuth, requireWorkspace, GoogleCalendarController.getStatus);
router.delete("/google/calendar", requireAuth, requireWorkspace, GoogleCalendarController.disconnect);

export const authRouter: Router = router;

