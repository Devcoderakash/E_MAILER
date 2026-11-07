import { Router } from "express";
import { CampaignController } from "./campaign.controller";
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
campaignRouter.post("/:id/duplicate", CampaignController.duplicate);
campaignRouter.post("/:id/validate", CampaignController.validate);
campaignRouter.post("/:id/send", CampaignController.send);
campaignRouter.post("/:id/cancel", CampaignController.cancel);

// Logs & Stats
campaignRouter.get("/:id/recipients", CampaignController.getRecipients);
campaignRouter.get("/:id/stats", CampaignController.getStats);

export { campaignRouter };
