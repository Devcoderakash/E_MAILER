import { Router } from "express";
import { CampaignController } from "./campaign.controller";
import { ScheduleController } from "../schedules/schedule.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const campaignRouter: Router = Router();
campaignRouter.use(requireAuth);

// Campaign CRUD
campaignRouter.get("/", CampaignController.list);
campaignRouter.post("/", CampaignController.create);
campaignRouter.get("/:id", CampaignController.getById);
campaignRouter.patch("/:id", CampaignController.update);
campaignRouter.delete("/:id", CampaignController.delete);

// Operations
campaignRouter.post("/test-email", CampaignController.sendTestEmail);
campaignRouter.post("/:id/test-email", CampaignController.sendTestEmail);
campaignRouter.post("/:id/duplicate", CampaignController.duplicate);
campaignRouter.post("/:id/validate", CampaignController.validate);
campaignRouter.post("/:id/send", CampaignController.send);
campaignRouter.post("/:id/cancel", CampaignController.cancel);

// Scheduling operations
campaignRouter.post("/:id/schedule", ScheduleController.schedule);
campaignRouter.patch("/:id/reschedule", ScheduleController.reschedule);
campaignRouter.post("/:id/unschedule", ScheduleController.unschedule);

// Logs & Stats
campaignRouter.get("/:id/recipients", CampaignController.getRecipients);
campaignRouter.get("/:id/stats", CampaignController.getStats);

export { campaignRouter };

