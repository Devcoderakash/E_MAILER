import { Request, Response } from "express";

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
}
