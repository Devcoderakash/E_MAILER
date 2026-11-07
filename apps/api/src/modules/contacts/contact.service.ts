import { prisma } from "../../config/database";
import { ContactStatus, ContactSource, ImportJobStatus } from "@prisma/client";
import { AutomationService } from "../automations/automation.service";

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ContactStatus;
  tagId?: string;
  listId?: string;
  sortBy?: "createdAt" | "email" | "firstName";
  sortOrder?: "asc" | "desc";
}

export interface CreateContactDTO {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  status?: ContactStatus;
  source?: ContactSource;
  tags?: string[]; // tag names or IDs
  listIds?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateContactDTO {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  status?: ContactStatus;
  tags?: string[];
  listIds?: string[];
  customFields?: Record<string, any>;
}

export interface ImportContactRow {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ContactService {
  /**
   * Resolves the authenticated user's active workspace and verifies membership.
   */
  static async resolveActiveWorkspace(
    supabaseId: string,
    requestedWorkspaceId?: string
  ): Promise<{
    user: { id: string; email: string; name: string | null };
    workspaceId: string;
    role: string;
  }> {
    const user = await prisma.user.findUnique({
      where: { supabaseId },
      include: {
        memberships: {
          include: { workspace: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user) {
      const err: any = new Error("User record not found in database");
      err.statusCode = 404;
      throw err;
    }

    if (user.memberships.length === 0) {
      const err: any = new Error("User does not belong to any workspace");
      err.statusCode = 403;
      throw err;
    }

    let activeMember = requestedWorkspaceId
      ? user.memberships.find((m) => m.workspaceId === requestedWorkspaceId)
      : user.memberships.find((m) => m.workspaceId === user.activeWorkspaceId);

    if (!activeMember) {
      activeMember = user.memberships.find(
        (m) => m.workspaceId === user.activeWorkspaceId
      ) || user.memberships[0];

      await prisma.user.update({
        where: { id: user.id },
        data: { activeWorkspaceId: activeMember.workspaceId },
      });
    }

    return {
      user: { id: user.id, email: user.email, name: user.name },
      workspaceId: activeMember.workspaceId,
      role: activeMember.role,
    };
  }

  // ==========================================
  // Contacts Operations
  // ==========================================

  static async getContacts(workspaceId: string, params: PaginationParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ];
    }

    if (params.tagId) {
      where.tagAssignments = {
        some: { tagId: params.tagId },
      };
    }

    if (params.listId) {
      where.listMemberships = {
        some: { listId: params.listId },
      };
    }

    const orderByField = params.sortBy || "createdAt";
    const orderDirection = params.sortOrder || "desc";

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderDirection },
        include: {
          tagAssignments: {
            include: { tag: true },
          },
          listMemberships: {
            include: { list: true },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    const formatted = contacts.map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || null,
      phone: c.phone,
      company: c.company,
      status: c.status,
      source: c.source,
      customFields: c.customFields,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      tags: c.tagAssignments.map((ta) => ({
        id: ta.tag.id,
        name: ta.tag.name,
        color: ta.tag.color,
      })),
      lists: c.listMemberships.map((lm) => ({
        id: lm.list.id,
        name: lm.list.name,
      })),
    }));

    return {
      contacts: formatted,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  static async getContactById(workspaceId: string, id: string) {
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        tagAssignments: {
          include: { tag: true },
        },
        listMemberships: {
          include: { list: true },
        },
      },
    });

    if (!contact || contact.workspaceId !== workspaceId) {
      const err: any = new Error("Contact not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    return {
      ...contact,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
      tags: contact.tagAssignments.map((ta) => ({
        id: ta.tag.id,
        name: ta.tag.name,
        color: ta.tag.color,
      })),
      lists: contact.listMemberships.map((lm) => ({
        id: lm.list.id,
        name: lm.list.name,
      })),
    };
  }

  static async createContact(workspaceId: string, data: CreateContactDTO) {
    const cleanEmail = data.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      const err: any = new Error("Invalid email format");
      err.statusCode = 400;
      throw err;
    }

    // Check duplicate email in workspace
    const existing = await prisma.contact.findUnique({
      where: {
        workspaceId_email: {
          workspaceId,
          email: cleanEmail,
        },
      },
    });

    if (existing) {
      const err: any = new Error("A contact with this email already exists in this workspace");
      err.statusCode = 409;
      throw err;
    }

    // Resolve or create tags
    let tagIdsToAssign: string[] = [];
    if (data.tags && data.tags.length > 0) {
      for (const tagStr of data.tags) {
        const cleanTag = tagStr.trim();
        if (!cleanTag) continue;
        const tag = await prisma.contactTag.upsert({
          where: {
            workspaceId_name: {
              workspaceId,
              name: cleanTag,
            },
          },
          update: {},
          create: {
            workspaceId,
            name: cleanTag,
            color: "#4f46e5",
          },
        });
        tagIdsToAssign.push(tag.id);
      }
    }

    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        email: cleanEmail,
        firstName: data.firstName?.trim() || null,
        lastName: data.lastName?.trim() || null,
        phone: data.phone?.trim() || null,
        company: data.company?.trim() || null,
        status: data.status || ContactStatus.ACTIVE,
        source: data.source || ContactSource.MANUAL,
        customFields: data.customFields || undefined,
        tagAssignments: {
          create: tagIdsToAssign.map((tagId) => ({ tagId })),
        },
        listMemberships: {
          create: (data.listIds || []).map((listId) => ({ listId })),
        },
      },
      include: {
        tagAssignments: { include: { tag: true } },
        listMemberships: { include: { list: true } },
      },
    });

    // Ingest workflow trigger for new contact subscription
    AutomationService.triggerAutomationsForEvent(
      workspaceId,
      "contact_subscribed",
      contact.id
    ).catch((err) => {
      console.error("[AutomationTrigger] Error triggering contact_subscribed:", err.message);
    });

    return {
      ...contact,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
      tags: contact.tagAssignments.map((ta) => ta.tag),
      lists: contact.listMemberships.map((lm) => lm.list),
    };
  }

  static async updateContact(
    workspaceId: string,
    id: string,
    data: UpdateContactDTO
  ) {
    const existing = await prisma.contact.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("Contact not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    let cleanEmail: string | undefined = undefined;
    if (data.email) {
      cleanEmail = data.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        const err: any = new Error("Invalid email format");
        err.statusCode = 400;
        throw err;
      }

      if (cleanEmail !== existing.email) {
        const conflict = await prisma.contact.findUnique({
          where: {
            workspaceId_email: {
              workspaceId,
              email: cleanEmail,
            },
          },
        });
        if (conflict) {
          const err: any = new Error("A contact with this email already exists in this workspace");
          err.statusCode = 409;
          throw err;
        }
      }
    }

    // Handle tag sync if provided
    if (data.tags !== undefined) {
      await prisma.contactTagAssignment.deleteMany({
        where: { contactId: id },
      });

      for (const tagStr of data.tags) {
        const cleanTag = tagStr.trim();
        if (!cleanTag) continue;
        const tag = await prisma.contactTag.upsert({
          where: {
            workspaceId_name: {
              workspaceId,
              name: cleanTag,
            },
          },
          update: {},
          create: {
            workspaceId,
            name: cleanTag,
            color: "#4f46e5",
          },
        });
        await prisma.contactTagAssignment.create({
          data: {
            contactId: id,
            tagId: tag.id,
          },
        });
      }
    }

    // Handle list sync if provided
    if (data.listIds !== undefined) {
      await prisma.contactListMember.deleteMany({
        where: { contactId: id },
      });

      for (const listId of data.listIds) {
        await prisma.contactListMember.create({
          data: {
            contactId: id,
            listId,
          },
        });
      }
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(data.firstName !== undefined ? { firstName: data.firstName?.trim() || null } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.company !== undefined ? { company: data.company?.trim() || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.customFields !== undefined ? { customFields: data.customFields } : {}),
      },
      include: {
        tagAssignments: { include: { tag: true } },
        listMemberships: { include: { list: true } },
      },
    });

    return {
      ...updated,
      name: [updated.firstName, updated.lastName].filter(Boolean).join(" ") || null,
      tags: updated.tagAssignments.map((ta) => ta.tag),
      lists: updated.listMemberships.map((lm) => lm.list),
    };
  }

  static async deleteContact(workspaceId: string, id: string) {
    const existing = await prisma.contact.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("Contact not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    await prisma.contact.delete({
      where: { id },
    });

    return { id, email: existing.email };
  }

  static async bulkDeleteContacts(workspaceId: string, ids: string[]) {
    if (!ids || ids.length === 0) {
      return { count: 0 };
    }

    const result = await prisma.contact.deleteMany({
      where: {
        id: { in: ids },
        workspaceId,
      },
    });

    return { count: result.count };
  }

  static async getContactStats(workspaceId: string) {
    const [total, active, unsubscribed, bounced, listCount, tagCount] =
      await Promise.all([
        prisma.contact.count({ where: { workspaceId } }),
        prisma.contact.count({ where: { workspaceId, status: ContactStatus.ACTIVE } }),
        prisma.contact.count({ where: { workspaceId, status: ContactStatus.UNSUBSCRIBED } }),
        prisma.contact.count({ where: { workspaceId, status: ContactStatus.BOUNCED } }),
        prisma.contactList.count({ where: { workspaceId } }),
        prisma.contactTag.count({ where: { workspaceId } }),
      ]);

    return {
      total,
      active,
      unsubscribed,
      bounced,
      listCount,
      tagCount,
    };
  }

  // ==========================================
  // Lists Operations
  // ==========================================

  static async getLists(workspaceId: string) {
    const lists = await prisma.contactList.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      memberCount: l._count.members,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
  }

  static async createList(
    workspaceId: string,
    data: { name: string; description?: string }
  ) {
    const cleanName = data.name.trim();
    if (!cleanName) {
      const err: any = new Error("List name is required");
      err.statusCode = 400;
      throw err;
    }

    const existing = await prisma.contactList.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: cleanName,
        },
      },
    });

    if (existing) {
      const err: any = new Error("A list with this name already exists in this workspace");
      err.statusCode = 409;
      throw err;
    }

    const list = await prisma.contactList.create({
      data: {
        workspaceId,
        name: cleanName,
        description: data.description?.trim() || null,
      },
    });

    return { ...list, memberCount: 0 };
  }

  static async updateList(
    workspaceId: string,
    id: string,
    data: { name: string; description?: string }
  ) {
    const existing = await prisma.contactList.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("List not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    const cleanName = data.name.trim();
    const updated = await prisma.contactList.update({
      where: { id },
      data: {
        name: cleanName,
        description: data.description?.trim() || null,
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      memberCount: updated._count.members,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  static async deleteList(workspaceId: string, id: string) {
    const existing = await prisma.contactList.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("List not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    await prisma.contactList.delete({
      where: { id },
    });

    return { id, name: existing.name };
  }

  static async addListMembers(
    workspaceId: string,
    listId: string,
    contactIds: string[]
  ) {
    const list = await prisma.contactList.findUnique({
      where: { id: listId },
    });

    if (!list || list.workspaceId !== workspaceId) {
      const err: any = new Error("List not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    // Verify all contactIds belong to this workspace
    const validContacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        workspaceId,
      },
      select: { id: true },
    });

    let addedCount = 0;
    for (const contact of validContacts) {
      try {
        await prisma.contactListMember.upsert({
          where: {
            contactId_listId: {
              contactId: contact.id,
              listId,
            },
          },
          update: {},
          create: {
            contactId: contact.id,
            listId,
          },
        });
        addedCount++;

        // Ingest workflow trigger for list membership
        AutomationService.triggerAutomationsForEvent(
          workspaceId,
          "contact_added_to_list",
          contact.id,
          { listId }
        ).catch((err) => {
          console.error("[AutomationTrigger] Error triggering contact_added_to_list:", err.message);
        });
      } catch {
        // Skip duplicate
      }
    }

    return { addedCount, totalRequested: contactIds.length };
  }

  static async removeListMember(
    workspaceId: string,
    listId: string,
    contactId: string
  ) {
    const list = await prisma.contactList.findUnique({
      where: { id: listId },
    });

    if (!list || list.workspaceId !== workspaceId) {
      const err: any = new Error("List not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    await prisma.contactListMember.deleteMany({
      where: {
        contactId,
        listId,
      },
    });

    return { success: true };
  }

  // ==========================================
  // Tags Operations
  // ==========================================

  static async getTags(workspaceId: string) {
    const tags = await prisma.contactTag.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      count: t._count.assignments,
      createdAt: t.createdAt,
    }));
  }

  static async createTag(
    workspaceId: string,
    data: { name: string; color?: string }
  ) {
    const cleanName = data.name.trim();
    if (!cleanName) {
      const err: any = new Error("Tag name is required");
      err.statusCode = 400;
      throw err;
    }

    const tag = await prisma.contactTag.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name: cleanName,
        },
      },
      update: {
        ...(data.color ? { color: data.color } : {}),
      },
      create: {
        workspaceId,
        name: cleanName,
        color: data.color || "#4f46e5",
      },
    });

    return { ...tag, count: 0 };
  }

  static async updateTag(
    workspaceId: string,
    id: string,
    data: { name: string; color?: string }
  ) {
    const existing = await prisma.contactTag.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("Tag not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    const cleanName = data.name.trim();
    const updated = await prisma.contactTag.update({
      where: { id },
      data: {
        name: cleanName,
        ...(data.color ? { color: data.color } : {}),
      },
    });

    return updated;
  }

  static async deleteTag(workspaceId: string, id: string) {
    const existing = await prisma.contactTag.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("Tag not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    await prisma.contactTag.delete({
      where: { id },
    });

    return { id, name: existing.name };
  }

  static async assignTagToContact(
    workspaceId: string,
    contactId: string,
    tagId: string
  ) {
    const [contact, tag] = await Promise.all([
      prisma.contact.findUnique({ where: { id: contactId } }),
      prisma.contactTag.findUnique({ where: { id: tagId } }),
    ]);

    if (!contact || contact.workspaceId !== workspaceId) {
      const err: any = new Error("Contact not found in this workspace");
      err.statusCode = 404;
      throw err;
    }
    if (!tag || tag.workspaceId !== workspaceId) {
      const err: any = new Error("Tag not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    await prisma.contactTagAssignment.upsert({
      where: {
        contactId_tagId: {
          contactId,
          tagId,
        },
      },
      update: {},
      create: {
        contactId,
        tagId,
      },
    });

    // Ingest workflow trigger for tag assignment
    AutomationService.triggerAutomationsForEvent(
      workspaceId,
      "tag_assigned",
      contactId,
      { tagId }
    ).catch((err) => {
      console.error("[AutomationTrigger] Error triggering tag_assigned:", err.message);
    });

    return { contactId, tagId };
  }

  static async removeTagFromContact(
    workspaceId: string,
    contactId: string,
    tagId: string
  ) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.workspaceId !== workspaceId) {
      const err: any = new Error("Contact not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    await prisma.contactTagAssignment.deleteMany({
      where: {
        contactId,
        tagId,
      },
    });

    return { success: true };
  }

  // ==========================================
  // CSV Import Operations
  // ==========================================

  static async importContacts(
    workspaceId: string,
    params: {
      fileName: string;
      rows: ImportContactRow[];
      tags?: string[];
      listIds?: string[];
    }
  ) {
    const { fileName, rows, tags = [], listIds = [] } = params;

    // Create tracking job
    const job = await prisma.importJob.create({
      data: {
        workspaceId,
        fileName,
        totalRows: rows.length,
        status: ImportJobStatus.PROCESSING,
      },
    });

    let importedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;
    const errors: Array<{ row: number; email?: string; error: string }> = [];

    // Resolve or create tags once for performance
    const tagRecordIds: string[] = [];
    for (const tagStr of tags) {
      const cleanTag = tagStr.trim();
      if (!cleanTag) continue;
      const tag = await prisma.contactTag.upsert({
        where: {
          workspaceId_name: {
            workspaceId,
            name: cleanTag,
          },
        },
        update: {},
        create: {
          workspaceId,
          name: cleanTag,
          color: "#4f46e5",
        },
      });
      tagRecordIds.push(tag.id);
    }

    // Process in sequential batches
    const seenEmailsInFile = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 1;

      if (!row.email || typeof row.email !== "string") {
        failedRows++;
        errors.push({ row: rowIndex, error: "Missing email address" });
        continue;
      }

      const cleanEmail = row.email.trim().toLowerCase();

      if (!EMAIL_REGEX.test(cleanEmail)) {
        failedRows++;
        errors.push({ row: rowIndex, email: cleanEmail, error: "Invalid email format" });
        continue;
      }

      // Check duplicates within the file itself
      if (seenEmailsInFile.has(cleanEmail)) {
        skippedRows++;
        errors.push({ row: rowIndex, email: cleanEmail, error: "Duplicate email within import file (skipped)" });
        continue;
      }
      seenEmailsInFile.add(cleanEmail);

      // Check database for existing contact in this workspace
      const existing = await prisma.contact.findUnique({
        where: {
          workspaceId_email: {
            workspaceId,
            email: cleanEmail,
          },
        },
      });

      if (existing) {
        skippedRows++;
        // Requirement 7: Preserve unsubscribe status when duplicate emails are encountered.
        // Never allow unsubscribed contacts to become active through accidental imports.
        errors.push({
          row: rowIndex,
          email: cleanEmail,
          error: `Already exists in workspace (${existing.status}). Preserved existing contact without reactivation.`,
        });
        continue;
      }

      try {
        await prisma.contact.create({
          data: {
            workspaceId,
            email: cleanEmail,
            firstName: row.firstName?.trim() || null,
            lastName: row.lastName?.trim() || null,
            phone: row.phone?.trim() || null,
            company: row.company?.trim() || null,
            status: ContactStatus.ACTIVE,
            source: ContactSource.CSV,
            customFields: row.customFields || undefined,
            tagAssignments: {
              create: tagRecordIds.map((tagId) => ({ tagId })),
            },
            listMemberships: {
              create: listIds.map((listId) => ({ listId })),
            },
          },
        });
        importedRows++;
      } catch (err: any) {
        failedRows++;
        errors.push({
          row: rowIndex,
          email: cleanEmail,
          error: err.message || "Failed to save contact",
        });
      }
    }

    // Finalize import job record
    const finalJob = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        importedRows,
        skippedRows,
        failedRows,
        status: failedRows === rows.length && rows.length > 0
          ? ImportJobStatus.FAILED
          : ImportJobStatus.COMPLETED,
        errorReport: errors.length > 0 ? (errors as any) : undefined,
        completedAt: new Date(),
      },
    });

    return {
      jobId: finalJob.id,
      totalRows: rows.length,
      importedRows,
      skippedRows,
      failedRows,
      status: finalJob.status,
      errors: errors.slice(0, 100), // Return sample of errors
    };
  }

  static async getImportJobs(workspaceId: string) {
    const jobs = await prisma.importJob.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return jobs;
  }
}
