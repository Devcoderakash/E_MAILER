import { Router } from "express";
import { WebhookController } from "./webhook.controller";

export const webhookRouter: Router = Router();

// Webhook status endpoint
webhookRouter.get("/status", WebhookController.getStatus);
