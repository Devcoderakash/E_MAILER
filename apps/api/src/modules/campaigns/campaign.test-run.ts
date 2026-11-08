import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { CampaignService } from "./campaign.service";
import { createCampaignWorker } from "../../workers/campaign.worker";
import { GmailSmtpProvider } from "../../providers";
import {
  ContactStatus,
  ContactSource,
  CampaignStatus,
  CampaignRecipientStatus,
} from "@prisma/client";

async function runCampaignVerification() {
  console.log("=================================================");
  console.log("🧪 MAILPILOT PHASE 6: CAMPAIGN MANAGER VERIFICATION");
  console.log("=================================================\n");

  GmailSmtpProvider.enableTestMode();
  const timestamp = Date.now();
  const testEmail = `campaign-tester-${timestamp}@mailpilot.io`;
  const testSupabaseId = `supa-camp-${timestamp}`;

  // 1. Initialize BullMQ worker for the test
  console.log("1. Initializing test Campaign Worker...");
  const worker = createCampaignWorker();

  console.log("2. Setting up test fixtures (User + 2 Workspaces)...");
  const testUser = await prisma.user.create({
    data: {
      supabaseId: testSupabaseId,
      email: testEmail,
      name: "Campaign Tester",
    },
  });

  const wsA_record = await prisma.workspace.create({
    data: {
      name: `Campaign WS Alpha ${timestamp}`,
      slug: `camp-ws-alpha-${timestamp}`,
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
      name: `Campaign WS Beta ${timestamp}`,
      slug: `camp-ws-beta-${timestamp}`,
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

  // 3. Create Audience with Safety Invariants (Active, Unsubscribed, Bounced)
  console.log("\n3. Creating audience contacts with active, unsubscribed, and bounced statuses...");
  const contact1 = await prisma.contact.create({
    data: {
      workspaceId: wsA,
      email: `active1_${timestamp}@example.com`,
      firstName: "ActiveOne",
      lastName: "User",
      company: "Acme Corp",
      status: ContactStatus.ACTIVE,
      source: ContactSource.MANUAL,
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      workspaceId: wsA,
      email: `active2_${timestamp}@example.com`,
      firstName: "ActiveTwo",
      lastName: "Tester",
      company: "Pilot Labs",
      status: ContactStatus.ACTIVE,
      source: ContactSource.MANUAL,
    },
  });

  const unsubscribedContact = await prisma.contact.create({
    data: {
      workspaceId: wsA,
      email: `unsub_${timestamp}@example.com`,
      firstName: "Unsubscribed",
      lastName: "User",
      status: ContactStatus.UNSUBSCRIBED,
      source: ContactSource.MANUAL,
    },
  });

  const bouncedContact = await prisma.contact.create({
    data: {
      workspaceId: wsA,
      email: `bounced_${timestamp}@example.com`,
      firstName: "Bounced",
      lastName: "Contact",
      status: ContactStatus.BOUNCED,
      source: ContactSource.MANUAL,
    },
  });

  // Create a contact list
  const testList = await prisma.contactList.create({
    data: {
      workspaceId: wsA,
      name: `VIP Newsletter List ${timestamp}`,
    },
  });

  // Add contacts to list
  await prisma.contactListMember.createMany({
    data: [
      { contactId: contact1.id, listId: testList.id },
      { contactId: contact2.id, listId: testList.id },
      { contactId: unsubscribedContact.id, listId: testList.id },
      { contactId: bouncedContact.id, listId: testList.id },
    ],
  });

  console.log(`✅ Created 4 contacts in list: 2 ACTIVE, 1 UNSUBSCRIBED, 1 BOUNCED.`);

  // 4. Test Template Selection & Campaign Creation
  console.log("\n4. Creating email template and draft campaign...");
  const template = await prisma.emailTemplate.create({
    data: {
      workspaceId: wsA,
      name: `Product Update ${timestamp}`,
      subject: "Exclusive Product Launch for {{first_name}}!",
      htmlContent: "<h1>Hello {{first_name}}</h1><p>Welcome to {{company}} updates!</p>",
      status: "READY",
    },
  });

  const campaign = await CampaignService.createCampaign(wsA, {
    name: "Spring Launch 2026",
    subject: "Special Announcement for {{first_name}}",
    preheader: "Check out what's new",
    fromName: "MailPilot Marketing",
    fromEmail: "marketing@mailpilot.io",
    replyTo: "support@mailpilot.io",
    templateId: template.id,
    htmlContent: "<h1>Hello {{first_name}}</h1><p>We are thrilled to invite you to {{company}}!</p>",
    targetListIds: [testList.id],
  });

  console.log(`✅ Campaign created: "${campaign.name}" (ID: ${campaign.id}, Status: ${campaign.status})`);

  // 5. Test Campaign Validation & Safety Checks
  console.log("\n5. Testing campaign validation and audience safety invariants...");
  const validation = await CampaignService.validateCampaign(wsA, campaign.id);
  console.log("Validation result:", JSON.stringify(validation, null, 2));

  if (!validation.canSend) {
    throw new Error(`Expected campaign to be valid, but got errors: ${validation.errors.join(", ")}`);
  }
  if (validation.audienceSummary.totalEligibleActive !== 2) {
    throw new Error(`Expected 2 eligible active contacts, got ${validation.audienceSummary.totalEligibleActive}`);
  }
  if (validation.audienceSummary.excludedUnsubscribed !== 1) {
    throw new Error(`Expected 1 excluded unsubscribed contact, got ${validation.audienceSummary.excludedUnsubscribed}`);
  }
  if (validation.audienceSummary.excludedBounced !== 1) {
    throw new Error(`Expected 1 excluded bounced contact, got ${validation.audienceSummary.excludedBounced}`);
  }
  console.log("✅ Audience Safety Invariants PASSED: Only 2 ACTIVE contacts selected. Unsubscribed and Bounced excluded!");

  // 6. Test Campaign Sending & BullMQ Asynchronous Dispatch
  console.log("\n6. Triggering campaign dispatch (sendCampaign)...");
  const queuedCampaign = await CampaignService.sendCampaign(wsA, campaign.id, { isTest: true });
  console.log(`Campaign queued: Status = ${queuedCampaign.status}, Recipients = ${queuedCampaign.recipientCount}`);

  if (queuedCampaign.status !== CampaignStatus.QUEUED) {
    throw new Error(`Expected campaign status QUEUED, got ${queuedCampaign.status}`);
  }
  if (queuedCampaign.recipientCount !== 2) {
    throw new Error(`Expected 2 recipients snapshotted, got ${queuedCampaign.recipientCount}`);
  }

  // Poll for worker completion (max 15 seconds)
  console.log("Waiting for BullMQ worker to process email batches...");
  let attempts = 0;
  let finalStatus = "";
  while (attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const current = await CampaignService.getCampaignById(wsA, campaign.id);
    finalStatus = current.status;
    if (current.status === CampaignStatus.SENT || current.status === CampaignStatus.FAILED) {
      break;
    }
    attempts++;
  }

  console.log(`Campaign worker finished with status: ${finalStatus}`);
  if (finalStatus !== CampaignStatus.SENT) {
    throw new Error(`Expected campaign status SENT, got ${finalStatus}`);
  }

  // 7. Verify Recipient Snapshot Log & Personalization
  console.log("\n7. Verifying Campaign Recipient logs...");
  const recipientsLog = await CampaignService.getCampaignRecipients(wsA, campaign.id, {
    page: 1,
    limit: 10,
  });

  console.log(`Retrieved ${recipientsLog.items.length} recipient log entries:`);
  for (const r of recipientsLog.items) {
    console.log(` - ${r.email}: status=${r.status}, attempts=${r.attempts}, msgId=${r.providerMessageId}`);
    if (r.status !== CampaignRecipientStatus.SENT) {
      throw new Error(`Expected recipient ${r.email} to be SENT, got ${r.status}`);
    }
    if (!r.providerMessageId) {
      throw new Error(`Expected recipient ${r.email} to have a providerMessageId`);
    }
  }
  console.log("✅ Recipient snapshots and delivery log verified!");

  // 8. Test Campaign Aggregate Delivery Stats
  console.log("\n8. Verifying delivery stats aggregation...");
  const stats = await CampaignService.getCampaignStats(wsA, campaign.id);
  console.log("Stats result:", JSON.stringify(stats, null, 2));

  if (stats.sentCount !== 2 || stats.sendSuccessRate !== 100) {
    throw new Error(`Expected 2 sent and 100% send success rate, got ${stats.sentCount} sent / ${stats.sendSuccessRate}%`);
  }
  console.log("✅ Campaign delivery stats verified!");

  // 9. Test Campaign Duplication
  console.log("\n9. Testing campaign duplication...");
  const duplicated = await CampaignService.duplicateCampaign(wsA, campaign.id);
  console.log(`Duplicated campaign: "${duplicated.name}", status: ${duplicated.status}`);
  if (duplicated.name !== `Copy of ${campaign.name}` || duplicated.status !== CampaignStatus.DRAFT) {
    throw new Error("Campaign duplication failed");
  }
  console.log("✅ Campaign duplication verified!");

  // 10. Test Campaign Cancellation
  console.log("\n10. Testing campaign cancellation...");
  const draftToCancel = await CampaignService.createCampaign(wsA, {
    name: "Campaign To Cancel",
    subject: "Will be cancelled",
    fromName: "Sender",
    fromEmail: "sender@mailpilot.io",
    htmlContent: "<p>Hello</p>",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  });
  const cancelled = await CampaignService.cancelCampaign(wsA, draftToCancel.id);
  if (cancelled.status !== CampaignStatus.CANCELLED) {
    throw new Error(`Expected CANCELLED status, got ${cancelled.status}`);
  }
  console.log("✅ Campaign cancellation verified!");

  // 11. Test Workspace Isolation
  console.log("\n11. Testing workspace isolation...");
  try {
    await CampaignService.getCampaignById(wsB, campaign.id);
    throw new Error("Security violation: Workspace Beta was able to access Workspace Alpha's campaign!");
  } catch (err: any) {
    if (err.statusCode === 404) {
      console.log("✅ Workspace isolation verified: Workspace Beta received 404 for Workspace Alpha's campaign.");
    } else {
      throw err;
    }
  }

  // 12. Cleanup
  console.log("\n12. Cleaning up test data & closing worker...");
  GmailSmtpProvider.disableTestMode();
  await worker.close();

  await prisma.campaignRecipient.deleteMany({
    where: { campaignId: { in: [campaign.id, duplicated.id, draftToCancel.id] } },
  });
  await prisma.campaign.deleteMany({
    where: { id: { in: [campaign.id, duplicated.id, draftToCancel.id] } },
  });
  await prisma.contactListMember.deleteMany({
    where: { listId: testList.id },
  });
  await prisma.contactList.delete({ where: { id: testList.id } });
  await prisma.emailTemplate.delete({ where: { id: template.id } });
  await prisma.contact.deleteMany({
    where: { id: { in: [contact1.id, contact2.id, unsubscribedContact.id, bouncedContact.id] } },
  });
  await prisma.workspaceMember.deleteMany({
    where: { workspaceId: { in: [wsA, wsB] } },
  });
  await prisma.workspace.deleteMany({
    where: { id: { in: [wsA, wsB] } },
  });
  await prisma.user.delete({ where: { id: testUser.id } });

  await prisma.$disconnect();
  await redis.quit();

  console.log("\n✨ ALL PHASE 6 CAMPAIGN & DISPATCH TESTS PASSED SUCCESSFULLY! ✨");
}

runCampaignVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ CAMPAIGN VERIFICATION TEST FAILED:", err);
    process.exit(1);
  });

