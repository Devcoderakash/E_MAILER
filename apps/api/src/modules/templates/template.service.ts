import { prisma } from "../../config/database";
import { TemplateCategory, TemplateStatus } from "@prisma/client";
import { env } from "../../config/env";

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: TemplateCategory;
  status?: TemplateStatus;
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}

export interface CreateTemplateDTO {
  name: string;
  description?: string;
  category?: TemplateCategory;
  subject?: string;
  preheader?: string;
  htmlContent: string;
  editorContent?: any;
  status?: TemplateStatus;
}

export interface UpdateTemplateDTO {
  name?: string;
  description?: string | null;
  category?: TemplateCategory;
  subject?: string | null;
  preheader?: string | null;
  htmlContent?: string;
  editorContent?: any;
  status?: TemplateStatus;
}

export const DEFAULT_STARTER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background-color: #4f46e5; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; }
    .content { padding: 32px 24px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .button-wrapper { text-align: center; margin: 28px 0; }
    .button { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; }
    .divider { border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #64748b; background-color: #f1f5f9; }
  </style>
</head>
<body>
  <div style="background-color: #f8fafc; padding: 40px 12px;">
    <div class="container">
      <div class="header">
        <img src="${(env.PUBLIC_BASE_URL || "https://e-mailer-00sp.onrender.com").replace(/\/+$/, "")}/logo-512.png" alt="MailPilot" width="32" height="32" style="display: block; margin: 0 auto 12px; border-radius: 6px; border: 0;" />
        <h1>Welcome to MailPilot, {{first_name}}!</h1>
      </div>
      <div class="content">
        <p>Hi {{first_name}},</p>
        <p>Thank you for connecting with us at {{company}}. We are thrilled to welcome you to our growing community.</p>
        <p>Explore your dashboard, create engaging campaigns, and automate your audience reach effortlessly.</p>
        <div class="button-wrapper">
          <a href="https://mailpilot.io" class="button">Get Started Now</a>
        </div>
        <div class="divider"></div>
        <p style="font-size: 13px; color: #64748b;">If you have any questions, simply reply to this email.</p>
      </div>
      <div class="footer">
        <p>&copy; 2026 MailPilot. Sent to {{email}}.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

export class TemplateService {
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
      activeMember =
        user.memberships.find((m) => m.workspaceId === user.activeWorkspaceId) ||
        user.memberships[0];

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

  /**
   * Lists workspace-scoped templates with filtering, search, and pagination
   */
  static async getTemplates(workspaceId: string, params: PaginationParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (params.category) {
      where.category = params.category;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
      ];
    }

    const orderByField = params.sortBy || "updatedAt";
    const orderDirection = params.sortOrder || "desc";

    const [templates, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderDirection },
      }),
      prisma.emailTemplate.count({ where }),
    ]);

    return {
      templates,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Retrieves single template by ID ensuring workspace isolation
   */
  static async getTemplateById(workspaceId: string, id: string) {
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template || template.workspaceId !== workspaceId) {
      const err: any = new Error("Template not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    return template;
  }

  /**
   * Creates a new workspace-scoped template
   */
  static async createTemplate(workspaceId: string, data: CreateTemplateDTO) {
    const cleanName = data.name.trim();
    if (!cleanName) {
      const err: any = new Error("Template name is required");
      err.statusCode = 400;
      throw err;
    }

    const template = await prisma.emailTemplate.create({
      data: {
        workspaceId,
        name: cleanName,
        description: data.description?.trim() || null,
        category: data.category || TemplateCategory.MARKETING,
        subject: data.subject?.trim() || null,
        preheader: data.preheader?.trim() || null,
        htmlContent: data.htmlContent || DEFAULT_STARTER_HTML,
        editorContent: data.editorContent !== undefined ? data.editorContent : null,
        status: data.status || TemplateStatus.DRAFT,
      },
    });

    return template;
  }

  /**
   * Updates an existing template
   */
  static async updateTemplate(
    workspaceId: string,
    id: string,
    data: UpdateTemplateDTO
  ) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("Template not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description ? data.description.trim() : null }
          : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.subject !== undefined
          ? { subject: data.subject ? data.subject.trim() : null }
          : {}),
        ...(data.preheader !== undefined
          ? { preheader: data.preheader ? data.preheader.trim() : null }
          : {}),
        ...(data.htmlContent !== undefined ? { htmlContent: data.htmlContent } : {}),
        ...(data.editorContent !== undefined ? { editorContent: data.editorContent } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });

    return updated;
  }

  /**
   * Duplicates an existing template within the active workspace
   */
  static async duplicateTemplate(workspaceId: string, id: string) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("Template not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    const copyName = `${existing.name} (Copy)`;

    const duplicated = await prisma.emailTemplate.create({
      data: {
        workspaceId,
        name: copyName,
        description: existing.description,
        category: existing.category,
        subject: existing.subject,
        preheader: existing.preheader,
        htmlContent: existing.htmlContent,
        editorContent: existing.editorContent ?? undefined,
        status: TemplateStatus.DRAFT,
      },
    });

    return duplicated;
  }

  /**
   * Deletes a template from the active workspace
   */
  static async deleteTemplate(workspaceId: string, id: string) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      const err: any = new Error("Template not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return { id, name: existing.name };
  }
}
