import { Router } from "express";
import { SettingsController } from "./settings.controller";
import { requireAuth, requireWorkspace } from "../../middleware/auth.middleware";

const router: Router = Router();

// All settings routes require authentication and workspace scope
router.use(requireAuth);
router.use(requireWorkspace);

router.get("/smtp", SettingsController.getSmtpConfig);
router.post("/smtp", SettingsController.saveSmtpConfig);
router.post("/smtp/test", SettingsController.testSmtpConnection);
router.post("/smtp/send-test", SettingsController.sendTestEmail);
router.delete("/smtp", SettingsController.deleteSmtpConfig);

export default router;
