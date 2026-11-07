import { Request, Response, NextFunction } from "express";
import { env } from "../../config/env";
import { verifyResendWebhook } from "./resend-webhook.verifier";
import { addWebhookJob } from "../../queues/webhook.queue";

export class WebhookController {
  /**
   * Handle incoming Resend webhooks
   * POST /api/webhooks/resend
   */
  static async handleResendWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // 1. Signature Verification
      const verification = verifyResendWebhook(
        rawBody,
        req.headers,
        env.RESEND_WEBHOOK_SECRET
      );

      if (!verification.isValid) {
        console.warn(`[WebhookController] Resend signature verification failed: ${verification.error}`);
        res.status(401).json({
          error: "Unauthorized",
          message: verification.error || "Invalid webhook signature.",
        });
        return;
      }

      // 2. Payload Validation
      const payload = req.body;
      if (!payload || typeof payload !== "object") {
        res.status(400).json({
          error: "Bad Request",
          message: "Webhook payload must be a JSON object.",
        });
        return;
      }

      const eventType = payload.type;
      if (!eventType || typeof eventType !== "string") {
        res.status(400).json({
          error: "Bad Request",
          message: "Missing 'type' in webhook payload.",
        });
        return;
      }

      const emailId = payload.data?.email_id;
      if (!emailId) {
        console.warn("[WebhookController] Payload missing data.email_id. Acknowledging.");
        res.status(200).json({ received: true, note: "missing_email_id_acknowledged" });
        return;
      }

      // 3. Determine provider event ID
      const svixId = req.headers["svix-id"] as string | undefined;
      const providerEventId =
        svixId ||
        payload.id ||
        `${emailId}_${eventType}_${payload.created_at || Date.now()}`;

      // 4. Enqueue processing job via BullMQ
      await addWebhookJob({
        provider: "RESEND",
        providerEventId,
        eventType,
        occurredAt: payload.created_at || new Date().toISOString(),
        data: payload.data,
        headers: {
          "svix-id": svixId || "",
          "svix-timestamp": (req.headers["svix-timestamp"] as string) || "",
        },
      });

      res.status(200).json({
        received: true,
        eventId: providerEventId,
        type: eventType,
      });
    } catch (err) {
      next(err);
    }
  }
}
