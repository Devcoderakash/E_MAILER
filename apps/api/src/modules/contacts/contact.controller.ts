import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ContactService, PaginationParams } from "./contact.service";
import { ContactStatus, ContactSource } from "@prisma/client";

// ==========================================
// Validation Schemas
// ==========================================

const createContactSchema = z.object({
  email: z.string().trim().email("A valid email address is required"),
  firstName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  company: z.string().trim().max(100).optional().nullable(),
  status: z.nativeEnum(ContactStatus).optional(),
  source: z.nativeEnum(ContactSource).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  listIds: z.array(z.string().uuid()).optional(),
  customFields: z.record(z.any()).optional().nullable(),
});

const updateContactSchema = z.object({
  email: z.string().trim().email("A valid email address is required").optional(),
  firstName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  company: z.string().trim().max(100).optional().nullable(),
  status: z.nativeEnum(ContactStatus).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  listIds: z.array(z.string().uuid()).optional(),
  customFields: z.record(z.any()).optional().nullable(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one contact ID is required"),
});

const createListSchema = z.object({
  name: z.string().trim().min(1, "List name is required").max(100, "Name cannot exceed 100 characters"),
  description: z.string().trim().max(500).optional().nullable(),
});

const updateListSchema = z.object({
  name: z.string().trim().min(1, "List name is required").max(100, "Name cannot exceed 100 characters"),
  description: z.string().trim().max(500).optional().nullable(),
});

const addListMembersSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1, "At least one contact ID is required"),
});

const createTagSchema = z.object({
  name: z.string().trim().min(1, "Tag name is required").max(50, "Tag name cannot exceed 50 characters"),
  color: z.string().trim().max(20).optional(),
});

const updateTagSchema = z.object({
  name: z.string().trim().min(1, "Tag name is required").max(50, "Tag name cannot exceed 50 characters"),
  color: z.string().trim().max(20).optional(),
});

const importContactsSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required"),
  rows: z
    .array(
      z.object({
        email: z.string().trim().min(1, "Email is required"),
        firstName: z.string().trim().optional().nullable(),
        lastName: z.string().trim().optional().nullable(),
        phone: z.string().trim().optional().nullable(),
        company: z.string().trim().optional().nullable(),
        tags: z.array(z.string()).optional(),
        customFields: z.record(z.any()).optional().nullable(),
      })
    )
    .min(1, "At least one row is required for import"),
  tags: z.array(z.string().trim().min(1)).optional(),
  listIds: z.array(z.string().uuid()).optional(),
});

export class ContactController {
  // Helper to extract workspace
  private static async getWorkspace(req: Request) {
    if (!req.user) {
      const err: any = new Error("Unauthorized");
      err.statusCode = 401;
      throw err;
    }
    const requestedWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
    return await ContactService.resolveActiveWorkspace(req.user.id, requestedWorkspaceId);
  }

  // ==========================================
  // Contacts Endpoints
  // ==========================================

  /**
   * GET /api/contacts
   * Lists contacts with pagination, search, status, tag, and list filters
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);

      const params: PaginationParams = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        search: req.query.search as string | undefined,
        status: req.query.status as ContactStatus | undefined,
        tagId: req.query.tagId as string | undefined,
        listId: req.query.listId as string | undefined,
        sortBy: req.query.sortBy as "createdAt" | "email" | "firstName" | undefined,
        sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
      };

      const result = await ContactService.getContacts(workspaceId, params);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/contacts/stats
   * Returns counts of total, active, unsubscribed, bounced, lists, tags
   */
  static async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const stats = await ContactService.getContactStats(workspaceId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/contacts/:id
   * Returns single contact by ID
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const contact = await ContactService.getContactById(workspaceId, req.params.id);

      res.status(200).json({
        success: true,
        data: { contact },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/contacts
   * Creates a new contact in the active workspace
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = createContactSchema.parse(req.body);

      const contact = await ContactService.createContact(workspaceId, {
        ...parsed,
        firstName: parsed.firstName || undefined,
        lastName: parsed.lastName || undefined,
        phone: parsed.phone || undefined,
        company: parsed.company || undefined,
        customFields: parsed.customFields || undefined,
      });

      res.status(201).json({
        success: true,
        data: { contact },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/contacts/:id
   * Updates an existing contact
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = updateContactSchema.parse(req.body);

      const contact = await ContactService.updateContact(workspaceId, req.params.id, {
        ...parsed,
        firstName: parsed.firstName === null ? "" : parsed.firstName,
        lastName: parsed.lastName === null ? "" : parsed.lastName,
        phone: parsed.phone === null ? "" : parsed.phone,
        company: parsed.company === null ? "" : parsed.company,
        customFields: parsed.customFields || undefined,
      });

      res.status(200).json({
        success: true,
        data: { contact },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/contacts/:id
   * Deletes a contact from the active workspace
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const result = await ContactService.deleteContact(workspaceId, req.params.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/contacts/bulk-delete
   * Deletes multiple contacts by IDs
   */
  static async bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = bulkDeleteSchema.parse(req.body);

      const result = await ContactService.bulkDeleteContacts(workspaceId, parsed.ids);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Tag Assignment Endpoints
  // ==========================================

  /**
   * POST /api/contacts/:id/tags/:tagId
   * Assigns a tag to a contact
   */
  static async assignTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const result = await ContactService.assignTagToContact(
        workspaceId,
        req.params.id,
        req.params.tagId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/contacts/:id/tags/:tagId
   * Removes a tag from a contact
   */
  static async removeTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const result = await ContactService.removeTagFromContact(
        workspaceId,
        req.params.id,
        req.params.tagId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // CSV Import Endpoints
  // ==========================================

  /**
   * POST /api/contacts/import
   * Batch imports contacts with deduplication and unsubscribe preservation
   */
  static async importCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = importContactsSchema.parse(req.body);

      const result = await ContactService.importContacts(workspaceId, {
        fileName: parsed.fileName,
        rows: parsed.rows.map((r) => ({
          ...r,
          firstName: r.firstName || undefined,
          lastName: r.lastName || undefined,
          phone: r.phone || undefined,
          company: r.company || undefined,
          customFields: r.customFields || undefined,
        })),
        tags: parsed.tags,
        listIds: parsed.listIds,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/contacts/import-jobs
   * Returns recent import jobs for the active workspace
   */
  static async listImportJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const jobs = await ContactService.getImportJobs(workspaceId);

      res.status(200).json({
        success: true,
        data: { jobs },
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Lists Endpoints
  // ==========================================

  /**
   * GET /api/contact-lists
   */
  static async listLists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const lists = await ContactService.getLists(workspaceId);

      res.status(200).json({
        success: true,
        data: { lists },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/contact-lists
   */
  static async createList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = createListSchema.parse(req.body);

      const list = await ContactService.createList(workspaceId, {
        name: parsed.name,
        description: parsed.description || undefined,
      });

      res.status(201).json({
        success: true,
        data: { list },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/contact-lists/:id
   */
  static async updateList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = updateListSchema.parse(req.body);

      const list = await ContactService.updateList(workspaceId, req.params.id, {
        name: parsed.name,
        description: parsed.description || undefined,
      });

      res.status(200).json({
        success: true,
        data: { list },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/contact-lists/:id
   */
  static async deleteList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const result = await ContactService.deleteList(workspaceId, req.params.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/contact-lists/:id/members
   */
  static async addMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = addListMembersSchema.parse(req.body);

      const result = await ContactService.addListMembers(
        workspaceId,
        req.params.id,
        parsed.contactIds
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/contact-lists/:id/members/:contactId
   */
  static async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const result = await ContactService.removeListMember(
        workspaceId,
        req.params.id,
        req.params.contactId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Tags Endpoints
  // ==========================================

  /**
   * GET /api/contact-tags
   */
  static async listTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const tags = await ContactService.getTags(workspaceId);

      res.status(200).json({
        success: true,
        data: { tags },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/contact-tags
   */
  static async createTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = createTagSchema.parse(req.body);

      const tag = await ContactService.createTag(workspaceId, {
        name: parsed.name,
        color: parsed.color,
      });

      res.status(201).json({
        success: true,
        data: { tag },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/contact-tags/:id
   */
  static async updateTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const parsed = updateTagSchema.parse(req.body);

      const tag = await ContactService.updateTag(workspaceId, req.params.id, {
        name: parsed.name,
        color: parsed.color,
      });

      res.status(200).json({
        success: true,
        data: { tag },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/contact-tags/:id
   */
  static async deleteTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = await ContactController.getWorkspace(req);
      const result = await ContactService.deleteTag(workspaceId, req.params.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
