import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { ScheduleService } from "./schedule.service";
import { CampaignService } from "../campaigns/campaign.service";
import { campaignQueue, getScheduledJobId } from "../../queues/campaign.queue";
import { createCampaignWorker } from "../../workers/campaign.worker";
import { GmailSmtpProvider } from "../../providers";
import {
  ContactStatus,
  ContactSource,
  CampaignStatus,
} from "@prisma/client";

async function runScheduleVerification() {
  console.log("=================================================");
  console.log("🧪 MAILPILOT PHASE 7: SCHEDULING VERIFICATION");
  console.log("=================================================\n");

  GmailSmtpProvider.enableTestMode();
  const timestamp = Date.now();
  const testEmail = `schedule-tester-${timestamp}@mailpilot.io`;
  const testSupabaseId = `supa-sched-${timestamp}`;

  // 1. Initialize BullMQ worker for the test
  console.log("1. Initializing test Campaign Worker...");
  const worker = createCampaignWorker();

  console.log("2. Setting up test fixtures (User + 2 Workspaces)...");
  const testUser = await prisma.user.create({
    data: {
      supabaseId: testSupabaseId,
      email: testEmail,
      name: "Schedule Tester",
    },
  });

  const wsA_record = await prisma.workspace.create({
    data: {
      name: `Schedule WS Alpha ${timestamp}`,
      slug: `sched-ws-alpha-${timestamp}`,
      ownerId: testUser.id,
      members: {
        create: {
          userId: testUser.id,
          role: "OWNER",
        },
      },
    },
  });

  const wsB_record = await prisma.workspace.create({
    data: {
      name: `Schedule WS Beta ${timestamp}`,
      slug: `sched-ws-beta-${timestamp}`,
      ownerId: testUser.id,
      members: {
        create: {
          userId: testUser.id,
          role: "ADMIN",
        },
      },
    },
  });

  const wsA = wsA_record.id;
  const wsB = wsB_record.id;
  console.log(`✅ User created with Workspace Alpha (${wsA}) & Beta (${wsB})`);

  try {
    // 3. Create active contacts & email template
    console.log("\n3. Creating eligible active contacts...");
    const contact = await prisma.contact.create({
      data: {
        workspaceId: wsA,
        email: `sched_active_${timestamp}@example.com`,
        firstName: "Scheduled",
        lastName: "Recipient",
        status: ContactStatus.ACTIVE,
        source: ContactSource.MANUAL,
      },
    });

    const template = await prisma.emailTemplate.create({
      data: {
        workspaceId: wsA,
        name: `Scheduled Newsletter ${timestamp}`,
        subject: "Exclusive announcement for {{first_name}}!",
        htmlContent: "<h1>Hello {{first_name}}</h1><p>Welcome to our scheduled broadcast!</p>",
        status: "READY",
      },
    });

    const campaign = await CampaignService.createCampaign(wsA, {
      name: "Q3 Product Announcement",
      subject: "Exclusive preview for {{first_name}}",
      preheader: "Read our newest update",
      fromName: "MailPilot Marketing",
      fromEmail: "marketing@mailpilot.io",
      templateId: template.id,
      htmlContent: template.htmlContent,
    });

    console.log(`✅ Draft campaign created: "${campaign.name}" (ID: ${campaign.id})`);

    // 4. Test Error Handling: Past Dates & Invalid Timezones
    console.log("\n4. Testing validation errors (past dates, invalid timezones)...");
    
    // Past date test
    try {
      await ScheduleService.scheduleCampaign(wsA, campaign.id, {
        scheduledAt: "2020-01-01T10:00:00",
        timezone: "Asia/Kolkata",
      });
      throw new Error("Failed: Expected past date to be rejected!");
    } catch (err: any) {
      if (err.message.includes("must be in the future")) {
        console.log("✅ Past date correctly rejected with 400 error.");
      } else {
        throw err;
      }
    }

    // Invalid timezone test
    try {
      await ScheduleService.scheduleCampaign(wsA, campaign.id, {
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        timezone: "Invalid/Fake_Timezone",
      });
      throw new Error("Failed: Expected invalid timezone to be rejected!");
    } catch (err: any) {
      if (err.message.includes("Invalid IANA timezone")) {
        console.log("✅ Invalid timezone correctly rejected with 400 error.");
      } else {
        throw err;
      }
    }

    // 5. Test Successful Campaign Scheduling (Timezone-Aware)
    console.log("\n5. Scheduling campaign for future delivery in Asia/Kolkata...");
    const futureTimeUtc = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours in future
    const scheduled = await ScheduleService.scheduleCampaign(wsA, campaign.id, {
      scheduledAt: futureTimeUtc.toISOString(),
      timezone: "Asia/Kolkata",
    });

    console.log(`Scheduled result: status=${scheduled.status}, scheduledAt=${scheduled.scheduledAt?.toISOString()}, timezone=${scheduled.scheduledTimezone}`);

    if (scheduled.status !== CampaignStatus.SCHEDULED) {
      throw new Error(`Expected status SCHEDULED, got ${scheduled.status}`);
    }
    if (scheduled.scheduledTimezone !== "Asia/Kolkata") {
      throw new Error(`Expected timezone Asia/Kolkata, got ${scheduled.scheduledTimezone}`);
    }

    // Verify BullMQ delayed job in Redis
    const expectedJobId = getScheduledJobId(campaign.id);
    const job = await campaignQueue.getJob(expectedJobId);
    if (!job) {
      throw new Error(`Expected BullMQ job #${expectedJobId} to exist in Redis!`);
    }
    const jobState = await job.getState();
    console.log(`✅ BullMQ delayed job #${job.id} exists in state "${jobState}" (Delay: ${Math.round((job.opts.delay || 0) / 1000)}s)`);

    // 6. Test Rescheduling
    console.log("\n6. Testing campaign rescheduling...");
    const newFutureTimeUtc = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48 hours in future
    const rescheduled = await ScheduleService.rescheduleCampaign(wsA, campaign.id, {
      scheduledAt: newFutureTimeUtc.toISOString(),
      timezone: "America/New_York",
    });

    console.log(`Rescheduled result: status=${rescheduled.status}, scheduledAt=${rescheduled.scheduledAt?.toISOString()}, timezone=${rescheduled.scheduledTimezone}`);
    if (rescheduled.scheduledTimezone !== "America/New_York") {
      throw new Error(`Expected timezone America/New_York, got ${rescheduled.scheduledTimezone}`);
    }
    const updatedJob = await campaignQueue.getJob(expectedJobId);
    if (!updatedJob) {
      throw new Error(`Expected rescheduled BullMQ job #${expectedJobId} to exist!`);
    }
    console.log("✅ Campaign rescheduled and BullMQ delayed job updated.");

    // 7. Test Unscheduling (reverting to DRAFT)
    console.log("\n7. Testing unscheduling campaign...");
    const unscheduled = await ScheduleService.unscheduleCampaign(wsA, campaign.id);
    console.log(`Unscheduled result: status=${unscheduled.status}, scheduledJobId=${unscheduled.scheduledJobId}`);

    if (unscheduled.status !== CampaignStatus.DRAFT) {
      throw new Error(`Expected status DRAFT after unschedule, got ${unscheduled.status}`);
    }

    // Verify job was removed from BullMQ
    const removedJob = await campaignQueue.getJob(expectedJobId);
    if (removedJob) {
      throw new Error(`Expected BullMQ job #${expectedJobId} to be deleted from queue!`);
    }
    console.log("✅ Campaign unscheduled and BullMQ delayed job removed from Redis.");

    // 8. Test Startup Reconciliation & Missing Job Recovery
    console.log("\n8. Testing startup reconciliation & recovery...");
    // Put campaign into SCHEDULED in DB without job in Redis
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 10), // 10 minutes in future
        scheduledTimezone: "UTC",
        scheduledJobId: null,
      },
    });

    // Run reconciliation
    const reconResult = await ScheduleService.reconcileScheduledJobs();
    console.log("Reconciliation result:", JSON.stringify(reconResult));

    if (reconResult.recovered < 1) {
      throw new Error(`Expected at least 1 recovered job, got ${reconResult.recovered}`);
    }

    const recoveredJob = await campaignQueue.getJob(expectedJobId);
    if (!recoveredJob) {
      throw new Error(`Expected job #${expectedJobId} to be recreated by reconciliation!`);
    }
    console.log("✅ Startup reconciliation recovered missing delayed job successfully!");

    // 9. Test Calendar & Schedule Query Endpoints
    console.log("\n9. Testing calendar and schedules listing queries...");
    const scheduleList = await ScheduleService.getSchedules(wsA, { page: 1, limit: 10 });
    console.log(`Retrieved ${scheduleList.items.length} schedule entries.`);
    if (scheduleList.items.length === 0) {
      throw new Error("Expected at least 1 scheduled campaign in list!");
    }

    const calendarList = await ScheduleService.getCalendarSchedules(
      wsA,
      new Date(Date.now() - 3600000).toISOString(),
      new Date(Date.now() + 86400000 * 7).toISOString(),
      "Asia/Kolkata"
    );
    console.log(`Retrieved ${calendarList.length} calendar entries.`);
    if (calendarList.length === 0) {
      throw new Error("Expected at least 1 calendar entry!");
    }
    console.log("✅ Schedule listing and calendar queries verified!");

    // 10. Test End-to-End Delayed Execution
    console.log("\n10. Testing end-to-end delayed execution (short delay)...");
    const nearFutureTime = new Date(Date.now() + 2000); // 2 seconds delay
    await ScheduleService.rescheduleCampaign(wsA, campaign.id, {
      scheduledAt: nearFutureTime.toISOString(),
      timezone: "UTC",
    });

    console.log("Waiting for BullMQ worker to fire delayed job (up to 10s)...");
    let execAttempts = 0;
    let postExecutionStatus = "";
    while (execAttempts < 20) {
      await new Promise((r) => setTimeout(r, 600));
      const current = await CampaignService.getCampaignById(wsA, campaign.id);
      postExecutionStatus = current.status;
      if (current.status === CampaignStatus.SENDING || current.status === CampaignStatus.SENT) {
        break;
      }
      execAttempts++;
    }

    console.log(`Campaign status after delayed execution: ${postExecutionStatus}`);
    if (postExecutionStatus !== CampaignStatus.SENDING && postExecutionStatus !== CampaignStatus.SENT) {
      throw new Error(`Expected campaign to transition to SENDING or SENT, got ${postExecutionStatus}`);
    }
    console.log("✅ Delayed BullMQ execution fired and triggered campaign engine successfully!");

    // 11. Test Workspace Isolation
    console.log("\n11. Testing workspace isolation...");
    try {
      await ScheduleService.getScheduleById(wsB, campaign.id);
      throw new Error("Security violation: Workspace Beta was able to access Workspace Alpha's schedule!");
    } catch (err: any) {
      if (err.statusCode === 404) {
        console.log("✅ Workspace isolation verified: Workspace Beta received 404.");
      } else {
        throw err;
      }
    }

    // 12. Cleanup
    console.log("\n12. Cleaning up test fixtures...");
    GmailSmtpProvider.disableTestMode();
    await worker.close();

    await prisma.campaignRecipient.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaign.deleteMany({ where: { id: campaign.id } });
    await prisma.emailTemplate.deleteMany({ where: { id: template.id } });
    await prisma.contact.deleteMany({ where: { id: contact.id } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });

    await prisma.$disconnect();
    await redis.quit();

    console.log("\n✨ ALL PHASE 7 SCHEDULING TESTS PASSED SUCCESSFULLY! ✨");
  } catch (err) {
    GmailSmtpProvider.disableTestMode();
    await worker.close();
    await prisma.$disconnect();
    await redis.quit();
    throw err;
  }
}

runScheduleVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ SCHEDULING VERIFICATION TEST FAILED:", err);
    process.exit(1);
  });

