import { Router } from "express";
import { WebhookController } from "./webhook.controller";

export const webhookRouter: Router = Router();

// Webhook status endpoint
webhookRouter.get("/status", WebhookController.getStatus);

// Unsubscribe endpoints
// 1. GET /api/webhooks/unsubscribe: Human recipient one-click browser unsubscribe
webhookRouter.get("/unsubscribe", WebhookController.handleUnsubscribeGet);

// 2. POST /api/webhooks/unsubscribe: RFC 8058 machine one-click unsubscribe
webhookRouter.post("/unsubscribe", WebhookController.handleUnsubscribePost);
