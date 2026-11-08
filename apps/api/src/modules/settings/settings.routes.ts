import { Router } from "express";
import { SettingsController } from "./settings.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const settingsRouter: Router = Router();

// All settings routes require authentication and workspace scope
settingsRouter.use(requireAuth);

// Provider listing and active default
settingsRouter.get("/providers", SettingsController.getProviders);

// Provider connection diagnostics
settingsRouter.post("/providers/:provider/test-connection", SettingsController.testConnection);

// Controlled single-recipient test email delivery
settingsRouter.post("/providers/:provider/send-test-email", SettingsController.sendTestEmail);

// Update workspace default provider
settingsRouter.patch("/providers/default", SettingsController.setDefaultProvider);

export { settingsRouter };

