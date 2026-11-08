import { Request, Response, NextFunction } from "express";
import { env } from "../../config/env";
import { verifyResendWebhook } from "./resend-webhook.verifier";
import { verifyBrevoWebhook } from "./brevo-webhook.verifier";
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

  /**
   * Handle incoming Brevo transactional webhooks
   * POST /api/webhooks/brevo
   */
  static async handleBrevoWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // 1. Webhook Authentication Verification
      const verification = verifyBrevoWebhook(
        req.headers,
        req.query,
        env.BREVO_WEBHOOK_SECRET
      );

      if (!verification.isValid) {
        console.warn(`[WebhookController] Brevo webhook verification failed: ${verification.error}`);
        res.status(401).json({
          error: "Unauthorized",
          message: verification.error || "Invalid webhook secret.",
        });
        return;
      }

      // 2. Payload Parsing (Brevo can send single object or an array of event objects)
      const rawPayload = req.body;
      if (!rawPayload || (typeof rawPayload !== "object")) {
        res.status(400).json({
          error: "Bad Request",
          message: "Webhook payload must be a JSON object or array of event objects.",
        });
        return;
      }

      const events: any[] = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
      const enqueuedEventIds: string[] = [];

      for (const ev of events) {
        const eventName = ev.event;
        const rawMessageId = ev["message-id"] || ev.messageId || ev.message_id;

        if (!eventName || !rawMessageId) {
          console.warn("[WebhookController] Brevo event missing event or message-id. Skipping entry.", ev);
          continue;
        }

        const cleanMessageId = String(rawMessageId).replace(/^<|>$/g, "").trim();

        // Determine unique event ID: use Brevo event id if present, else deterministic combination
        const providerEventId = ev.id
          ? String(ev.id)
          : `${cleanMessageId}_${eventName}_${ev.ts_event || ev.ts || Date.now()}`;

        // Calculate ISO occurrence timestamp
        let occurredAt = new Date().toISOString();
        if (ev.date) {
          const parsed = new Date(ev.date);
          if (!isNaN(parsed.getTime())) occurredAt = parsed.toISOString();
        } else if (ev.ts_epoch) {
          occurredAt = new Date(Number(ev.ts_epoch)).toISOString();
        } else if (ev.ts_event || ev.ts) {
          const sec = Number(ev.ts_event || ev.ts);
          occurredAt = new Date(sec < 10000000000 ? sec * 1000 : sec).toISOString();
        }

        await addWebhookJob({
          provider: "BREVO",
          providerEventId,
          eventType: eventName,
          occurredAt,
          data: {
            email_id: cleanMessageId,
            raw_message_id: rawMessageId,
            to: ev.email ? [ev.email] : [],
            event: eventName,
            reason: ev.reason,
            tag: ev.tag || ev.tags,
            subject: ev.subject,
            click: ev.link ? { link: ev.link, ipAddress: ev.ip || ev.sending_ip } : undefined,
            bounce:
              ev.reason || eventName.includes("bounce")
                ? { type: eventName, message: ev.reason || "Bounced via Brevo" }
                : undefined,
          },
          headers: {
            "x-brevo-event": eventName,
          },
        });

        enqueuedEventIds.push(providerEventId);
      }

      res.status(200).json({
        received: true,
        count: enqueuedEventIds.length,
        eventIds: enqueuedEventIds,
      });
    } catch (err) {
      next(err);
    }
  }
}
