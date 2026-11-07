import { Router } from "express";
import { WebhookController } from "./webhook.controller";

export const webhookRouter: Router = Router();

// Public webhook receiver for Resend
webhookRouter.post("/resend", WebhookController.handleResendWebhook);
