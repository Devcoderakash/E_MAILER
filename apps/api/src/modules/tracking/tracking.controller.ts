import { Request, Response } from "express";
import { TrackingService } from "./tracking.service";

export class TrackingController {
  /**
   * Public tracking pixel endpoint.
   * Returns a 1x1 transparent GIF with cache-busting headers.
   */
  public static async handleOpen(req: Request, res: Response): Promise<void> {
    const { recipientId } = req.params;
    const userAgent = req.headers["user-agent"] as string;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;

    // Set strict cache-busting headers so email clients do not cache the pixel
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Length", TrackingService.getPixelBuffer().length);

    // Record open in background to ensure instant HTTP response
    TrackingService.recordOpen(recipientId, { userAgent, ip }).catch((err) => {
      console.error("[TrackingController] Open logging error:", err);
    });

    res.status(200).end(TrackingService.getPixelBuffer());
  }

  /**
   * Public click redirect endpoint.
   * Records click event and redirects (302) to destination URL.
   */
  public static async handleClick(req: Request, res: Response): Promise<void> {
    const { recipientId } = req.params;
    const targetUrl = (req.query.url as string) || "";
    const userAgent = req.headers["user-agent"] as string;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;

    try {
      const destination = await TrackingService.recordClick(recipientId, targetUrl, {
        userAgent,
        ip,
      });

      res.redirect(302, destination);
    } catch (err: any) {
      console.error("[TrackingController] Click logging error:", err);
      // Fallback redirect even on unexpected failure
      res.redirect(302, TrackingService.getPublicBaseUrl());
    }
  }
}

