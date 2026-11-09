import { Request, Response } from "express";
import { UnsubscribeService, UnsubscribeError } from "./unsubscribe.service";

export class WebhookController {
  /**
   * GET /api/webhooks/status
   * Status endpoint for webhooks subsystem
   */
  static async getStatus(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "active",
      engine: "google-native",
      message: "Webhook subsystem active.",
    });
  }

  /**
   * GET /api/webhooks/unsubscribe
   * User-facing unsubscribe endpoint (one-click web GET)
   */
  static async handleUnsubscribeGet(req: Request, res: Response): Promise<void> {
    const tokenStr = (req.query.token as string) || (req.query.t as string);

    if (!tokenStr) {
      res.status(400).send(
        UnsubscribeService.renderErrorPage("This unsubscribe link is incomplete or missing a valid token.")
      );
      return;
    }

    try {
      const payload = UnsubscribeService.verifyToken(tokenStr);

      const result = await UnsubscribeService.executeUnsubscribe(payload, {
        source: "web_get",
        userAgent: req.get("user-agent") || undefined,
        ip: req.ip || undefined,
      });

      res.status(200).send(
        UnsubscribeService.renderSuccessPage(result.maskedEmail, result.alreadyUnsubscribed)
      );
    } catch (err: any) {
      console.warn(`[WebhookController] Unsubscribe GET failed: ${err.message}`);
      const isSecurityOrToken = err instanceof UnsubscribeError;
      const userMessage = isSecurityOrToken
        ? err.message
        : "We were unable to process your unsubscribe request. Please try again later.";

      res.status(400).send(UnsubscribeService.renderErrorPage(userMessage));
    }
  }

  /**
   * POST /api/webhooks/unsubscribe
   * RFC 8058 compliant one-click unsubscribe endpoint for mail user agents (Gmail, Yahoo, Apple Mail)
   */
  static async handleUnsubscribePost(req: Request, res: Response): Promise<void> {
    const tokenStr =
      (req.query.token as string) ||
      (req.query.t as string) ||
      (req.body && req.body.token);

    if (!tokenStr) {
      res.status(400).json({
        success: false,
        error: "Missing required unsubscribe token.",
      });
      return;
    }

    try {
      const payload = UnsubscribeService.verifyToken(tokenStr);

      const result = await UnsubscribeService.executeUnsubscribe(payload, {
        source: "rfc8058_post",
        userAgent: req.get("user-agent") || undefined,
        ip: req.ip || undefined,
      });

      res.status(200).json({
        success: true,
        message: "Unsubscribed successfully.",
        alreadyUnsubscribed: result.alreadyUnsubscribed,
      });
    } catch (err: any) {
      console.warn(`[WebhookController] Unsubscribe RFC 8058 POST failed: ${err.message}`);
      const isSecurityOrToken = err instanceof UnsubscribeError;
      const statusCode = isSecurityOrToken && err.code === "SECURITY_MISMATCH" ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        error: err.message || "Failed to process unsubscribe request.",
        code: err.code || "UNSUBSCRIBE_FAILED",
      });
    }
  }
}
