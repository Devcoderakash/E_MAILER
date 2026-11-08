import { google } from "googleapis";
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { encryptCredential, decryptCredential } from "../../utils/crypto.util";

export interface CalendarConnectionStatus {
  isConfigured: boolean;
  connected: boolean;
  googleEmail?: string | null;
  lastSyncedAt?: Date | null;
}

export class GoogleCalendarService {
  private static testMode = false;
  private static testMockEvents = new Map<string, any>();

  public static enableTestMode(): void {
    this.testMode = true;
    this.testMockEvents.clear();
  }

  public static disableTestMode(): void {
    this.testMode = false;
    this.testMockEvents.clear();
  }

  public static isTestModeEnabled(): boolean {
    return this.testMode;
  }

  public static isConfigured(): boolean {
    return Boolean(
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      !env.GOOGLE_CLIENT_ID.includes("placeholder") &&
      !env.GOOGLE_CLIENT_SECRET.includes("placeholder")
    );
  }

  /**
   * Get an authorized OAuth2 client for Google APIs
   */
  public static getOAuth2Client(redirectUri?: string): InstanceType<typeof google.auth.OAuth2> {
    const callbackUri =
      redirectUri ||
      env.GOOGLE_REDIRECT_URI ||
      `http://localhost:${env.PORT}/api/auth/google/calendar/callback`;

    return new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      callbackUri
    );
  }

  /**
   * Generate Google OAuth authorization URL for Calendar sync
   */
  public static getAuthorizationUrl(workspaceId: string, userId: string): string {
    if (!this.isConfigured() && !this.isTestModeEnabled()) {
      throw new Error(
        "Google OAuth is unconfigured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment."
      );
    }

    const oauth2Client = this.getOAuth2Client();

    const state = Buffer.from(
      JSON.stringify({
        workspaceId,
        userId,
        timestamp: Date.now(),
      })
    ).toString("base64");

    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      include_granted_scopes: true,
      prompt: "consent",
      state,
    });
  }

  /**
   * Exchange authorization code for tokens and store securely
   */
  public static async handleOAuthCallback(code: string, stateBase64: string) {
    let state: { workspaceId: string; userId: string; timestamp: number };
    try {
      state = JSON.parse(Buffer.from(stateBase64, "base64").toString("utf8"));
    } catch {
      throw new Error("Invalid or corrupted OAuth state parameter.");
    }

    const { workspaceId } = state;
    if (!workspaceId) {
      throw new Error("Missing workspaceId in OAuth state.");
    }

    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Retrieve user email
    let googleEmail = "connected-user@gmail.com";
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      if (userInfo.data.email) {
        googleEmail = userInfo.data.email;
      }
    } catch {
      // Fallback if userinfo fetch fails
    }

    const accessToken = tokens.access_token || "";
    const refreshToken = tokens.refresh_token || "";
    const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

    const encryptedAccess = encryptCredential(accessToken);
    const encryptedRefresh = encryptCredential(refreshToken || accessToken);

    const connection = await prisma.googleCalendarConnection.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        googleEmail,
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        tokenExpiry: expiryDate,
        calendarId: "primary",
      },
      update: {
        googleEmail,
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: refreshToken ? encryptedRefresh : undefined,
        tokenExpiry: expiryDate,
      },
    });

    return { success: true, googleEmail: connection.googleEmail, workspaceId };
  }

  /**
   * Get calendar connection status for a workspace
   */
  public static async getConnectionStatus(workspaceId: string): Promise<CalendarConnectionStatus> {
    const isConfigured = this.isConfigured();

    if (this.isTestModeEnabled()) {
      return {
        isConfigured: true,
        connected: true,
        googleEmail: "test-calendar@gmail.com",
        lastSyncedAt: new Date(),
      };
    }

    const connection = await prisma.googleCalendarConnection.findUnique({
      where: { workspaceId },
    });

    return {
      isConfigured,
      connected: Boolean(connection),
      googleEmail: connection?.googleEmail || null,
      lastSyncedAt: connection?.updatedAt || null,
    };
  }

  /**
   * Disconnect and revoke Google Calendar integration
   */
  public static async disconnect(workspaceId: string) {
    const connection = await prisma.googleCalendarConnection.findUnique({
      where: { workspaceId },
    });

    if (connection) {
      try {
        const refreshToken = decryptCredential(connection.encryptedRefreshToken);
        const oauth2Client = this.getOAuth2Client();
        await oauth2Client.revokeToken(refreshToken);
      } catch {
        // Continue deleting local records even if token revocation fails
      }

      await prisma.googleCalendarEvent.deleteMany({
        where: { connectionId: connection.id },
      });

      await prisma.googleCalendarConnection.delete({
        where: { workspaceId },
      });
    }

    return { success: true, message: "Google Calendar disconnected." };
  }

  /**
   * Resolve an authenticated Google Calendar API client for workspace
   */
  private static async getAuthenticatedCalendar(workspaceId: string) {
    const connection = await prisma.googleCalendarConnection.findUnique({
      where: { workspaceId },
    });

    if (!connection) return null;

    const oauth2Client = this.getOAuth2Client();
    const accessToken = decryptCredential(connection.encryptedAccessToken);
    const refreshToken = decryptCredential(connection.encryptedRefreshToken);

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: connection.tokenExpiry.getTime(),
    });

    // Check if access token is expired or expiring within 2 minutes
    if (connection.tokenExpiry.getTime() <= Date.now() + 120000) {
      try {
        const refreshed = await oauth2Client.refreshAccessToken();
        const newAccessToken = refreshed.credentials.access_token;
        const newExpiry = refreshed.credentials.expiry_date
          ? new Date(refreshed.credentials.expiry_date)
          : new Date(Date.now() + 3600 * 1000);

        if (newAccessToken) {
          await prisma.googleCalendarConnection.update({
            where: { id: connection.id },
            data: {
              encryptedAccessToken: encryptCredential(newAccessToken),
              tokenExpiry: newExpiry,
            },
          });
        }
      } catch (refreshErr) {
        console.warn(`[GoogleCalendarService] Token refresh failed for workspace ${workspaceId}:`, refreshErr);
        return null;
      }
    }

    return {
      calendar: google.calendar({ version: "v3", auth: oauth2Client }),
      connection,
    };
  }

  /**
   * Synchronize scheduled campaign to Google Calendar
   */
  public static async syncCampaignScheduled(workspaceId: string, campaign: any) {
    try {
      if (!campaign.scheduledAt) return;

      if (this.isTestModeEnabled()) {
        const mockEventId = `mock_event_${campaign.id}`;
        this.testMockEvents.set(campaign.id, {
          id: mockEventId,
          summary: `[MailPilot] Campaign: ${campaign.name}`,
          start: campaign.scheduledAt,
        });

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            googleCalendarEventId: mockEventId,
            googleCalendarSyncedAt: new Date(),
          },
        });
        return { eventId: mockEventId, simulated: true };
      }

      const client = await this.getAuthenticatedCalendar(workspaceId);
      if (!client) {
        // Workspace has not connected Google Calendar: ignore gracefully
        return null;
      }

      const startTime = new Date(campaign.scheduledAt);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min block

      const eventPayload = {
        summary: `[MailPilot] Campaign: ${campaign.name}`,
        description: [
          `Campaign: ${campaign.name}`,
          `Subject: ${campaign.subject}`,
          `Estimated Audience: ${campaign.recipientCount || 0} contacts`,
          `Timezone: ${campaign.scheduledTimezone || "UTC"}`,
          `Platform: MailPilot Email Engine`,
          `Campaign URL: ${env.FRONTEND_URL}/campaigns`,
        ].join("\n"),
        start: {
          dateTime: startTime.toISOString(),
          timeZone: campaign.scheduledTimezone || "UTC",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: campaign.scheduledTimezone || "UTC",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "email", minutes: 60 },
          ],
        },
      };

      // Check if event already exists
      const existingMapping = await prisma.googleCalendarEvent.findUnique({
        where: { campaignId: campaign.id },
      });

      let googleEventId: string;

      if (existingMapping) {
        // Update existing calendar event
        const updated = await client.calendar.events.update({
          calendarId: client.connection.calendarId,
          eventId: existingMapping.googleEventId,
          requestBody: eventPayload,
        });
        googleEventId = updated.data.id || existingMapping.googleEventId;

        await prisma.googleCalendarEvent.update({
          where: { campaignId: campaign.id },
          data: { syncedAt: new Date() },
        });
      } else {
        // Insert new calendar event
        const created = await client.calendar.events.insert({
          calendarId: client.connection.calendarId,
          requestBody: eventPayload,
        });
        googleEventId = created.data.id!;

        await prisma.googleCalendarEvent.create({
          data: {
            connectionId: client.connection.id,
            campaignId: campaign.id,
            googleEventId,
            calendarId: client.connection.calendarId,
          },
        });
      }

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          googleCalendarEventId: googleEventId,
          googleCalendarSyncedAt: new Date(),
        },
      });

      return { eventId: googleEventId };
    } catch (err: any) {
      console.warn(`[GoogleCalendarService] Failed to sync campaign ${campaign.id}: ${err.message}`);
      return null;
    }
  }

  /**
   * Remove calendar event when campaign is unscheduled or cancelled
   */
  public static async syncCampaignUnscheduled(workspaceId: string, campaignId: string) {
    try {
      if (this.isTestModeEnabled()) {
        this.testMockEvents.delete(campaignId);
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            googleCalendarEventId: null,
            googleCalendarSyncedAt: null,
          },
        });
        return { deleted: true };
      }

      const client = await this.getAuthenticatedCalendar(workspaceId);
      const existing = await prisma.googleCalendarEvent.findUnique({
        where: { campaignId },
      });

      if (existing && client) {
        try {
          await client.calendar.events.delete({
            calendarId: client.connection.calendarId,
            eventId: existing.googleEventId,
          });
        } catch {
          // Continue deleting local reference if remote event is already gone
        }

        await prisma.googleCalendarEvent.delete({
          where: { campaignId },
        });
      }

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          googleCalendarEventId: null,
          googleCalendarSyncedAt: null,
        },
      });

      return { deleted: true };
    } catch (err: any) {
      console.warn(`[GoogleCalendarService] Failed to remove event for campaign ${campaignId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Update calendar event with delivery summary after sending
   */
  public static async syncCampaignCompleted(workspaceId: string, campaign: any) {
    try {
      if (this.isTestModeEnabled()) return;

      const client = await this.getAuthenticatedCalendar(workspaceId);
      const existing = await prisma.googleCalendarEvent.findUnique({
        where: { campaignId: campaign.id },
      });

      if (existing && client) {
        await client.calendar.events.patch({
          calendarId: client.connection.calendarId,
          eventId: existing.googleEventId,
          requestBody: {
            summary: `[MailPilot COMPLETED] Campaign: ${campaign.name}`,
            description: [
              `Campaign: ${campaign.name}`,
              `Subject: ${campaign.subject}`,
              `Dispatched to SMTP: ${campaign.sentCount || 0} recipients`,
              `Completed At: ${new Date().toISOString()}`,
              `Status: All dispatches accepted by Gmail SMTP.`,
            ].join("\n"),
          },
        });
      }
    } catch (err: any) {
      console.warn(`[GoogleCalendarService] Could not update completed status for ${campaign.id}: ${err.message}`);
    }
  }
}
