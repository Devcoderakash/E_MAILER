import { prisma } from "../../config/database";
import { TemplateService, DEFAULT_STARTER_HTML } from "./template.service";
import { TemplateCategory, TemplateStatus } from "@prisma/client";

async function runTemplateVerification() {
  console.log("=================================================");
  console.log("🧪 MAILPILOT PHASE 5: EMAIL TEMPLATE STUDIO VERIFICATION");
  console.log("=================================================\n");

  const timestamp = Date.now();
  const testEmail = `template-verifier-${timestamp}@mailpilot.io`;
  const testSupabaseId = `supa-tpl-${timestamp}`;

  console.log("1. Setting up test fixtures (User + 2 Workspaces)...");
  const testUser = await prisma.user.create({
    data: {
      supabaseId: testSupabaseId,
      email: testEmail,
      name: "Template Studio Verifier",
    },
  });

  const wsA_record = await prisma.workspace.create({
    data: {
      name: `Template WS Alpha ${timestamp}`,
      slug: `tpl-ws-alpha-${timestamp}`,
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
      name: `Template WS Beta ${timestamp}`,
      slug: `tpl-ws-beta-${timestamp}`,
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
    // TEST 1: Template Creation
    // -----------------------------------------------------------------
    console.log("\n2. Testing Template Creation in Workspace Alpha...");
    const sampleEditorDoc = {
      settings: { contentWidth: 600, backgroundColor: "#f8fafc", cardColor: "#ffffff" },
      blocks: [
        {
          id: "blk-1",
          type: "heading",
          text: "Welcome, {{first_name}} to {{company}}!",
          level: 1,
        },
        {
          id: "blk-2",
          type: "text",
          content: "We are thrilled to have you with us.",
        },
      ],
    };

    const template1 = await TemplateService.createTemplate(wsA, {
      name: `Q2 Launch Announcement ${timestamp}`,
      description: "Launch email with product highlights",
      category: TemplateCategory.MARKETING,
      subject: "Exclusive Preview for {{first_name}}",
      preheader: "Be the first to see what we've built for {{company}}",
      htmlContent: DEFAULT_STARTER_HTML,
      editorContent: sampleEditorDoc,
      status: TemplateStatus.DRAFT,
    });

    console.log(`   Created Template: "${template1.name}" (ID: ${template1.id})`);
    if (template1.category !== TemplateCategory.MARKETING) {
      throw new Error(`Expected category MARKETING, got ${template1.category}`);
    }
    if (template1.status !== TemplateStatus.DRAFT) {
      throw new Error(`Expected status DRAFT, got ${template1.status}`);
    }
    console.log("✅ Template creation verified.");

    // -----------------------------------------------------------------
    // TEST 2: Template Retrieval
    // -----------------------------------------------------------------
    console.log("\n3. Testing Template Retrieval by ID...");
    const fetched1 = await TemplateService.getTemplateById(wsA, template1.id);
    if (fetched1.id !== template1.id || fetched1.name !== template1.name) {
      throw new Error("Fetched template data mismatch");
    }
    if (!fetched1.htmlContent.includes("{{first_name}}")) {
      throw new Error("HTML content missing merge variables");
    }
    console.log("✅ Template retrieval verified.");

    // -----------------------------------------------------------------
    // TEST 3: Template Update (status, category, HTML)
    // -----------------------------------------------------------------
    console.log("\n4. Testing Template Update (DRAFT -> READY)...");
    const updated1 = await TemplateService.updateTemplate(wsA, template1.id, {
      name: `Q2 Launch Announcement (Final) ${timestamp}`,
      category: TemplateCategory.NEWSLETTER,
      status: TemplateStatus.READY,
      subject: "Updated Subject: Welcome to MailPilot!",
    });

    if (updated1.status !== TemplateStatus.READY) {
      throw new Error(`Expected status READY, got ${updated1.status}`);
    }
    if (updated1.category !== TemplateCategory.NEWSLETTER) {
      throw new Error(`Expected category NEWSLETTER, got ${updated1.category}`);
    }
    console.log(`   Updated status to: ${updated1.status}, Category: ${updated1.category}`);
    console.log("✅ Template update verified.");

    // -----------------------------------------------------------------
    // TEST 4: Workspace Isolation
    // -----------------------------------------------------------------
    console.log("\n5. Testing Workspace Isolation (Multi-Tenancy)...");
    // Attempting to access Workspace Alpha's template from Workspace Beta must throw 404
    let crossWorkspaceAccessBlocked = false;
    try {
      await TemplateService.getTemplateById(wsB, template1.id);
    } catch (err: any) {
      if (err.statusCode === 404) {
        crossWorkspaceAccessBlocked = true;
      }
    }
    if (!crossWorkspaceAccessBlocked) {
      throw new Error("Cross-workspace unauthorized access was NOT blocked!");
    }
    console.log("   Workspace Beta blocked from viewing Workspace Alpha's template (HTTP 404).");

    // List templates in Workspace Beta (must return 0)
    const wsBList = await TemplateService.getTemplates(wsB, {});
    if (wsBList.total !== 0) {
      throw new Error(`Expected 0 templates in Workspace Beta, found ${wsBList.total}`);
    }

    // Create a template in Workspace Beta
    const betaTemplate = await TemplateService.createTemplate(wsB, {
      name: `Beta Only Template ${timestamp}`,
      category: TemplateCategory.TRANSACTIONAL,
      htmlContent: "<p>Beta content</p>",
      status: TemplateStatus.DRAFT,
    });
    console.log(`   Created template in Workspace Beta: ID ${betaTemplate.id}`);

    // Verify Workspace Alpha cannot see Workspace Beta's template
    const wsAList = await TemplateService.getTemplates(wsA, {});
    if (wsAList.templates.some((t) => t.id === betaTemplate.id)) {
      throw new Error("Workspace Beta's template leaked into Workspace Alpha list!");
    }
    console.log("✅ Complete workspace isolation verified.");

    // -----------------------------------------------------------------
    // TEST 5: Template Duplication
    // -----------------------------------------------------------------
    console.log("\n6. Testing Template Duplication...");
    const duplicated = await TemplateService.duplicateTemplate(wsA, template1.id);
    console.log(`   Duplicated template created: "${duplicated.name}" (ID: ${duplicated.id})`);

    if (!duplicated.name.includes("(Copy)")) {
      throw new Error(`Expected duplicated name to contain "(Copy)", got ${duplicated.name}`);
    }
    if (duplicated.status !== TemplateStatus.DRAFT) {
      throw new Error(`Expected duplicated template to reset to DRAFT, got ${duplicated.status}`);
    }
    if (duplicated.subject !== updated1.subject) {
      throw new Error("Duplicated template subject did not match source");
    }
    console.log("✅ Template duplication verified.");

    // -----------------------------------------------------------------
    // TEST 6: Template Search & Filtering
    // -----------------------------------------------------------------
    console.log("\n7. Testing Template Search & Filtering...");
    const filteredSearch = await TemplateService.getTemplates(wsA, {
      search: "Launch",
      status: TemplateStatus.READY,
    });
    if (filteredSearch.total !== 1 || filteredSearch.templates[0].id !== template1.id) {
      throw new Error(`Expected 1 matched template for search, got ${filteredSearch.total}`);
    }
    console.log("✅ Template search and status filtering verified.");

    // -----------------------------------------------------------------
    // TEST 7: Template Deletion
    // -----------------------------------------------------------------
    console.log("\n8. Testing Template Deletion...");
    await TemplateService.deleteTemplate(wsA, duplicated.id);

    let deleteConfirmed = false;
    try {
      await TemplateService.getTemplateById(wsA, duplicated.id);
    } catch {
      deleteConfirmed = true;
    }
    if (!deleteConfirmed) {
      throw new Error("Failed to delete duplicated template");
    }
    console.log("✅ Template deletion verified.");

    console.log("\n=================================================");
    console.log("🎉 ALL PHASE 5 TEMPLATE STUDIO TESTS PASSED!");
    console.log("=================================================");
  } finally {
    // Teardown test fixtures
    console.log("\nCleaning up test fixtures from Supabase database...");
    try {
      await prisma.user.delete({ where: { id: testUser.id } });
    } catch {}
    console.log("Cleanup complete.");
  }
}

runTemplateVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ VERIFICATION TEST FAILED:", err);
    process.exit(1);
  });
