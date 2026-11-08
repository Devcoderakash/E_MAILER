import { Router } from "express";
import { WebhookController } from "./webhook.controller";

export const webhookRouter: Router = Router();

// Public webhook receiver for Resend
webhookRouter.post("/resend", WebhookController.handleResendWebhook);

// Public webhook receiver for Brevo
webhookRouter.post("/brevo", WebhookController.handleBrevoWebhook);
