import { prisma } from "../../config/database";
import { ContactService } from "./contact.service";
import { ContactStatus, ContactSource } from "@prisma/client";

async function runContactVerification() {
  console.log("=================================================");
  console.log("🧪 MAILPILOT PHASE 4: CONTACT MODULE VERIFICATION");
  console.log("=================================================\n");

  const timestamp = Date.now();
  const testEmailUser = `verifier-${timestamp}@mailpilot.io`;
  const testSupabaseId = `supa-test-${timestamp}`;

  console.log("1. Setting up test fixtures (User + 2 Workspaces)...");
  const testUser = await prisma.user.create({
    data: {
      supabaseId: testSupabaseId,
      email: testEmailUser,
      name: "Phase 4 Verifier",
    },
  });

  const wsA_record = await prisma.workspace.create({
    data: {
      name: `Test Workspace Alpha ${timestamp}`,
      slug: `ws-alpha-${timestamp}`,
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
      name: `Test Workspace Beta ${timestamp}`,
      slug: `ws-beta-${timestamp}`,
      ownerId: testUser.id,
      members: {
        create: {
          userId: testUser.id,
          role: "ADMIN",
        },
      },
    },
  });

  // Set active workspace
  await prisma.user.update({
    where: { id: testUser.id },
    data: { activeWorkspaceId: wsA_record.id },
  });

  const wsA = wsA_record.id;
  const wsB = wsB_record.id;
  console.log(`✅ User created with Workspace Alpha (${wsA}) & Beta (${wsB})`);

  try {
    // -----------------------------------------------------------------
    // TEST 1: Contact Creation & Retrieval
    // -----------------------------------------------------------------
    console.log("\n2. Testing Contact Creation & Retrieval...");
    const contact1 = await ContactService.createContact(wsA, {
      email: `alice.${timestamp}@example.com`,
      firstName: "Alice",
      lastName: "Smith",
      phone: "+1-555-0101",
      company: "Acme Corp",
      status: ContactStatus.ACTIVE,
      source: ContactSource.MANUAL,
      tags: ["VIP", "Beta Tester"],
    });

    console.log(`   Created contact: ${contact1.email} (ID: ${contact1.id})`);
    if (contact1.email !== `alice.${timestamp}@example.com`) {
      throw new Error("Created contact email mismatch");
    }
    if (contact1.tags.length !== 2) {
      throw new Error(`Expected 2 tags, got ${contact1.tags.length}`);
    }

    const fetched1 = await ContactService.getContactById(wsA, contact1.id);
    if (fetched1.id !== contact1.id || fetched1.name !== "Alice Smith") {
      throw new Error("Fetched contact data mismatch");
    }
    console.log("✅ Contact creation and retrieval verified.");

    // -----------------------------------------------------------------
    // TEST 2: Contact Update
    // -----------------------------------------------------------------
    console.log("\n3. Testing Contact Update...");
    const updated1 = await ContactService.updateContact(wsA, contact1.id, {
      firstName: "Alicia",
      company: "Global Tech Inc",
      status: ContactStatus.ACTIVE,
      tags: ["VIP", "Enterprise"],
    });

    if (updated1.firstName !== "Alicia" || updated1.company !== "Global Tech Inc") {
      throw new Error("Contact update fields mismatch");
    }
    console.log(`   Updated contact name: ${updated1.name}, Company: ${updated1.company}`);
    console.log("✅ Contact update verified.");

    // -----------------------------------------------------------------
    // TEST 3: Duplicate Email Check Within Workspace
    // -----------------------------------------------------------------
    console.log("\n4. Testing Duplicate Email Detection in Same Workspace...");
    let duplicateCaught = false;
    try {
      await ContactService.createContact(wsA, {
        email: `alice.${timestamp}@example.com`,
        firstName: "Duplicate Alice",
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        duplicateCaught = true;
      }
    }
    if (!duplicateCaught) {
      throw new Error("Failed to block duplicate email within the same workspace!");
    }
    console.log("✅ Correctly rejected duplicate email in same workspace (HTTP 409).");

    // -----------------------------------------------------------------
    // TEST 4: Workspace Isolation
    // -----------------------------------------------------------------
    console.log("\n5. Testing Workspace Isolation...");
    // Same email in Workspace Beta should SUCCEED
    const contactInBeta = await ContactService.createContact(wsB, {
      email: `alice.${timestamp}@example.com`,
      firstName: "Alice in Beta",
    });
    if (!contactInBeta.id) {
      throw new Error("Failed to create same email in independent Workspace Beta");
    }
    console.log(`   Created same email in Workspace Beta: ID ${contactInBeta.id}`);

    // Query Workspace A contacts - must not see Workspace Beta contact
    const wsAContacts = await ContactService.getContacts(wsA, { search: "alice" });
    const wsBContacts = await ContactService.getContacts(wsB, { search: "alice" });

    if (wsAContacts.total !== 1 || wsAContacts.contacts[0].id !== contact1.id) {
      throw new Error("Workspace A query leaked cross-workspace data!");
    }
    if (wsBContacts.total !== 1 || wsBContacts.contacts[0].id !== contactInBeta.id) {
      throw new Error("Workspace B query leaked cross-workspace data!");
    }

    // Try accessing contact1 from Workspace Beta (must throw 404)
    let unauthorizedAccessBlocked = false;
    try {
      await ContactService.getContactById(wsB, contact1.id);
    } catch (err: any) {
      if (err.statusCode === 404) {
        unauthorizedAccessBlocked = true;
      }
    }
    if (!unauthorizedAccessBlocked) {
      throw new Error("Cross-workspace direct access was not blocked!");
    }
    console.log("✅ Workspace isolation completely verified (zero cross-tenant leaks).");

    // -----------------------------------------------------------------
    // TEST 5: Lists and Memberships
    // -----------------------------------------------------------------
    console.log("\n6. Testing Contact Lists & Memberships...");
    const list = await ContactService.createList(wsA, {
      name: `Q2 Marketing List ${timestamp}`,
      description: "Test list for Q2 product rollout",
    });
    console.log(`   Created list: ${list.name} (ID: ${list.id})`);

    const addMemberResult = await ContactService.addListMembers(wsA, list.id, [contact1.id]);
    if (addMemberResult.addedCount !== 1) {
      throw new Error("Failed to add contact to list");
    }

    const listsWithCount = await ContactService.getLists(wsA);
    const targetList = listsWithCount.find((l) => l.id === list.id);
    if (!targetList || targetList.memberCount !== 1) {
      throw new Error(`Expected memberCount 1, got ${targetList?.memberCount}`);
    }

    await ContactService.removeListMember(wsA, list.id, contact1.id);
    const listsAfterRemove = await ContactService.getLists(wsA);
    const targetListAfter = listsAfterRemove.find((l) => l.id === list.id);
    if (targetListAfter?.memberCount !== 0) {
      throw new Error("Failed to remove member from list");
    }
    console.log("✅ List creation, membership addition & removal verified.");

    // -----------------------------------------------------------------
    // TEST 6: Tags and Tag Assignments
    // -----------------------------------------------------------------
    console.log("\n7. Testing Contact Tags...");
    const tag = await ContactService.createTag(wsA, {
      name: `Special-Tag-${timestamp}`,
      color: "#10b981",
    });
    console.log(`   Created tag: ${tag.name} (ID: ${tag.id})`);

    await ContactService.assignTagToContact(wsA, contact1.id, tag.id);
    const contactWithTag = await ContactService.getContactById(wsA, contact1.id);
    const hasTag = contactWithTag.tags.some((t) => t.id === tag.id);
    if (!hasTag) {
      throw new Error("Failed to assign tag to contact");
    }

    await ContactService.removeTagFromContact(wsA, contact1.id, tag.id);
    const contactWithoutTag = await ContactService.getContactById(wsA, contact1.id);
    const stillHasTag = contactWithoutTag.tags.some((t) => t.id === tag.id);
    if (stillHasTag) {
      throw new Error("Failed to remove tag from contact");
    }
    console.log("✅ Tag creation, assignment & removal verified.");

    // -----------------------------------------------------------------
    // TEST 7: CSV Batch Import & Unsubscribe Preservation
    // -----------------------------------------------------------------
    console.log("\n8. Testing CSV Batch Import & Unsubscribe Preservation...");

    // First create an UNSUBSCRIBED contact
    const unsubContact = await ContactService.createContact(wsA, {
      email: `unsub.${timestamp}@example.com`,
      firstName: "Unsubscribed",
      status: ContactStatus.UNSUBSCRIBED,
    });
    console.log(`   Created pre-existing UNSUBSCRIBED contact: ${unsubContact.email}`);

    // Now attempt a batch import containing:
    // 1. Valid new contact: new1@example.com
    // 2. Duplicate within file: new1@example.com (must skip)
    // 3. Invalid email format: not-an-email (must fail)
    // 4. Pre-existing unsubscribed contact: unsub@example.com (MUST PRESERVE STATUS and skip!)
    // 5. Valid new contact: new2@example.com
    const importResult = await ContactService.importContacts(wsA, {
      fileName: `import-test-${timestamp}.csv`,
      rows: [
        { email: `new1.${timestamp}@example.com`, firstName: "New", lastName: "One" },
        { email: `new1.${timestamp}@example.com`, firstName: "Duplicate in file" },
        { email: "invalid-email-string", firstName: "Bad Email" },
        { email: `unsub.${timestamp}@example.com`, firstName: "Attempt to Reactivate" },
        { email: `new2.${timestamp}@example.com`, firstName: "New", lastName: "Two" },
      ],
      tags: ["Imported-Lead"],
    });

    console.log("   Import Result Summary:", {
      total: importResult.totalRows,
      imported: importResult.importedRows,
      skipped: importResult.skippedRows,
      failed: importResult.failedRows,
      status: importResult.status,
    });

    if (importResult.importedRows !== 2) {
      throw new Error(`Expected 2 imported rows, got ${importResult.importedRows}`);
    }
    if (importResult.skippedRows !== 2) {
      // 1 duplicate in file + 1 duplicate unsubscribed in DB
      throw new Error(`Expected 2 skipped rows, got ${importResult.skippedRows}`);
    }
    if (importResult.failedRows !== 1) {
      // 1 invalid email format
      throw new Error(`Expected 1 failed row, got ${importResult.failedRows}`);
    }

    // Check that pre-existing unsubscribed contact REMAINS UNSUBSCRIBED
    const unsubAfter = await ContactService.getContactById(wsA, unsubContact.id);
    if (unsubAfter.status !== ContactStatus.UNSUBSCRIBED) {
      throw new Error(
        `CRITICAL: Unsubscribe status was NOT preserved! Current status: ${unsubAfter.status}`
      );
    }
    console.log(`   Verified unsubscribe preservation: ${unsubAfter.email} remains status '${unsubAfter.status}'`);

    // Verify ImportJob record created
    const jobs = await ContactService.getImportJobs(wsA);
    const thisJob = jobs.find((j) => j.id === importResult.jobId);
    if (!thisJob || thisJob.status !== "COMPLETED") {
      throw new Error("ImportJob record not found or not marked COMPLETED");
    }
    console.log(`   Verified ImportJob record: ID ${thisJob.id}, status: ${thisJob.status}`);
    console.log("✅ CSV batch import, validation, deduplication and unsubscribe preservation verified.");

    // -----------------------------------------------------------------
    // TEST 8: Contact Stats
    // -----------------------------------------------------------------
    console.log("\n9. Testing Contact Metrics & Stats...");
    const stats = await ContactService.getContactStats(wsA);
    console.log("   Workspace Alpha Stats:", stats);

    if (stats.total < 3) {
      throw new Error(`Expected at least 3 total contacts, got ${stats.total}`);
    }
    if (stats.unsubscribed !== 1) {
      throw new Error(`Expected 1 unsubscribed contact, got ${stats.unsubscribed}`);
    }
    console.log("✅ Contact metrics calculation verified.");

    // -----------------------------------------------------------------
    // TEST 9: Single & Bulk Deletion
    // -----------------------------------------------------------------
    console.log("\n10. Testing Deletion (Single & Bulk)...");
    // Single delete
    await ContactService.deleteContact(wsA, contact1.id);
    let singleDeleted = false;
    try {
      await ContactService.getContactById(wsA, contact1.id);
    } catch {
      singleDeleted = true;
    }
    if (!singleDeleted) {
      throw new Error("Single delete failed to remove contact");
    }
    console.log("   Single contact deletion verified.");

    // Bulk delete contacts imported in TEST 7
    const contactsInWsA = await ContactService.getContacts(wsA, { limit: 100 });
    const idsToDelete = contactsInWsA.contacts.map((c) => c.id);
    const bulkResult = await ContactService.bulkDeleteContacts(wsA, idsToDelete);
    if (bulkResult.count !== idsToDelete.length) {
      throw new Error(`Bulk delete count mismatch: expected ${idsToDelete.length}, got ${bulkResult.count}`);
    }
    console.log(`   Bulk deleted ${bulkResult.count} contacts.`);

    const remaining = await ContactService.getContacts(wsA, {});
    if (remaining.total !== 0) {
      throw new Error(`Expected 0 contacts remaining after bulk delete, got ${remaining.total}`);
    }
    console.log("✅ Bulk deletion verified.");

    console.log("\n=================================================");
    console.log("🎉 ALL PHASE 4 CONTACT TESTS PASSED CLEANLY!");
    console.log("=================================================");
  } finally {
    // Clean up test fixtures (deleting user cascades to workspaces, contacts, lists, tags)
    console.log("\nCleaning up test fixtures from Supabase database...");
    try {
      await prisma.user.delete({
        where: { id: testUser.id },
      });
    } catch {}
    console.log("Cleanup complete.");
  }
}

runContactVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ VERIFICATION TEST FAILED:", err);
    process.exit(1);
  });
