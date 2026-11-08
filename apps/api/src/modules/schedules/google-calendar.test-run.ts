import { GoogleCalendarService } from "./google-calendar.service";
import { ScheduleService } from "./schedule.service";
import { GmailSmtpProvider } from "../../providers";
import { prisma } from "../../config/database";
import { CampaignStatus } from "@prisma/client";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` - ${details}` : ""}`);
    testsFailed++;
  }
}

async function run() {
  console.log("\n🧪 STARTING GOOGLE CALENDAR SYNC & OAUTH TEST SUITE\n");

  const testWorkspaceId = `test_ws_cal_${Date.now()}`;
  const testUserId = `test_user_cal_${Date.now()}`;
  let campaignId = "";

  try {
    GmailSmtpProvider.enableTestMode();
    GoogleCalendarService.enableTestMode();

    // 1. Service Configuration Check
    console.log("--- 1. Service Configuration ---");
    assert(typeof GoogleCalendarService.isConfigured() === "boolean", "Returns boolean configuration status");

    // 2. OAuth URL Generation & State Verification
    console.log("--- 2. OAuth Authorization URL Generation ---");
    const authUrl = GoogleCalendarService.getAuthorizationUrl(testWorkspaceId, testUserId);
    assert(authUrl.includes("accounts.google.com"), "Generates Google Accounts OAuth URL");
    assert(authUrl.includes("calendar.events"), "Includes calendar.events scope in consent request");
    assert(authUrl.includes("state="), "Includes encoded state parameter for CSRF mitigation");

    // 3. Database and Model Setup
    console.log("--- 3. Workspace & Campaign Fixtures ---");
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        supabaseId: `sb_cal_${Date.now()}`,
        email: `cal_user_${Date.now()}@example.com`,
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        id: testWorkspaceId,
        name: "Calendar Test Workspace",
        slug: `cal-ws-${Date.now()}`,
        ownerId: user.id,
      },
    });

    const contact = await prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        email: `cal_lead_${Date.now()}@example.com`,
        firstName: "Cal",
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: workspace.id,
        name: "Q4 Roadmap Launch Webinar",
        subject: "Join our Q4 Roadmap Preview",
        fromName: "MailPilot Product",
        fromEmail: "webinar@mailpilot.io",
        htmlContent: "<p>Webinar link inside.</p>",
        status: CampaignStatus.DRAFT,
      },
    });
    campaignId = campaign.id;

    // 4. Status Check
    console.log("--- 4. Connection Status ---");
    const status = await GoogleCalendarService.getConnectionStatus(workspace.id);
    assert(status.connected === true, "Reports connected status in test mode");

    // 5. Campaign Scheduling Synchronization
    console.log("--- 5. Calendar Event Sync on Scheduling ---");
    const futureDate = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
    const scheduled = await ScheduleService.scheduleCampaign(workspace.id, campaign.id, {
      scheduledAt: futureDate,
      timezone: "America/New_York",
    });

    assert(scheduled.status === CampaignStatus.SCHEDULED, "Campaign transitioned to SCHEDULED");
    assert(scheduled.googleCalendarEventId !== null, "Google Calendar event ID generated and persisted on Campaign");
    assert(typeof scheduled.googleCalendarEventId === "string" && scheduled.googleCalendarEventId.startsWith("mock_event_"), "Event ID matches expected format");

    // 6. Rescheduling Synchronization
    console.log("--- 6. Calendar Event Sync on Rescheduling ---");
    const newFutureDate = new Date(Date.now() + 5 * 86400 * 1000).toISOString();
    const rescheduled = await ScheduleService.rescheduleCampaign(workspace.id, campaign.id, {
      scheduledAt: newFutureDate,
      timezone: "America/New_York",
    });

    assert(rescheduled.status === CampaignStatus.SCHEDULED, "Rescheduled campaign remains SCHEDULED");
    assert(rescheduled.googleCalendarEventId !== null, "Maintains Google Calendar event ID on reschedule");

    // 7. Unschedule Synchronization (Event Deletion)
    console.log("--- 7. Calendar Event Sync on Unschedule ---");
    const unscheduled = await ScheduleService.unscheduleCampaign(workspace.id, campaign.id);
    assert(unscheduled.status === CampaignStatus.DRAFT, "Unscheduled campaign returns to DRAFT");
    assert(unscheduled.googleCalendarEventId === null, "Clears googleCalendarEventId from campaign record");

    // 8. Graceful Disconnect
    console.log("--- 8. Disconnect Integration ---");
    const discRes = await GoogleCalendarService.disconnect(workspace.id);
    assert(discRes.success === true, "Disconnect execution succeeds cleanly");

  } catch (err: any) {
    console.error("❌ Exception during Google Calendar test suite:", err);
    testsFailed++;
  } finally {
    GmailSmtpProvider.disableTestMode();
    GoogleCalendarService.disableTestMode();

    // Cleanup DB
    try {
      if (campaignId) {
        await prisma.campaign.deleteMany({ where: { id: campaignId } });
      }
      await prisma.contact.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await prisma.googleCalendarEvent.deleteMany({ where: { campaignId } });
      await prisma.googleCalendarConnection.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch (_) {}

    console.log(`\n========================================`);
    console.log(`CALENDAR TEST SUMMARY: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log(`========================================\n`);

    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

run();
