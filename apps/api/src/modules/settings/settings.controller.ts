import { Request, Response, NextFunction } from "express";
import { SettingsService } from "./settings.service";

export class SettingsController {
  public static async getSmtpConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(400).json({ error: "Missing workspace context." });
        return;
      }

      const config = await SettingsService.getSmtpConfig(workspaceId);
      res.json(config);
    } catch (err) {
      next(err);
    }
  }

  public static async saveSmtpConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(400).json({ error: "Missing workspace context." });
        return;
      }

      const { user, appPassword, senderName, replyTo, host, port, secure } = req.body;
      const result = await SettingsService.saveSmtpConfig(workspaceId, {
        user,
        appPassword,
        senderName,
        replyTo,
        host,
        port: port ? Number(port) : undefined,
        secure: secure === true || secure === "true",
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to save SMTP configuration." });
    }
  }

  public static async testSmtpConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(400).json({ error: "Missing workspace context." });
        return;
      }

      const { user, appPassword, host, port, secure } = req.body;
      const result = await SettingsService.testSmtpConnection(
        workspaceId,
        user ? { user, appPassword, host, port, secure } : undefined
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ healthy: false, error: err.message || "Connection test failed." });
    }
  }

  public static async sendTestEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(400).json({ error: "Missing workspace context." });
        return;
      }

      const { to, user, appPassword, senderName } = req.body;
      if (!to) {
        res.status(400).json({ error: "Recipient email ('to') is required." });
        return;
      }

      const result = await SettingsService.sendTestEmail(
        workspaceId,
        to,
        user ? { user, appPassword, senderName } : undefined
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to send test email." });
    }
  }

  public static async deleteSmtpConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(400).json({ error: "Missing workspace context." });
        return;
      }

      const result = await SettingsService.deleteSmtpConfig(workspaceId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

