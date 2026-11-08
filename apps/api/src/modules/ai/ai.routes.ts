import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { AIController } from "./ai.controller";

export const aiRouter: Router = Router();

// Protect all AI Copilot endpoints
aiRouter.use(requireAuth);

aiRouter.get("/status", AIController.getStatus);
aiRouter.post("/subject-lines", AIController.generateSubjectLines);
aiRouter.post("/generate-email", AIController.generateEmailDraft);
aiRouter.post("/generate-preheader", AIController.generatePreheader);
aiRouter.post("/improve-campaign", AIController.improveCampaign);
aiRouter.post("/generate-workflow", AIController.generateWorkflow);
aiRouter.post("/chat", AIController.chat);

