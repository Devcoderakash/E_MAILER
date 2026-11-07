import { prisma } from "../../config/database";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  isOwner: boolean;
  memberCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkspaceService {
  /**
   * Helper to resolve internal User from Supabase auth UUID
   */
  private static async getInternalUser(supabaseId: string) {
    const user = await prisma.user.findUnique({
      where: { supabaseId },
    });
    if (!user) {
      throw new Error("User record not found in database");
    }
    return user;
  }

  /**
   * List all workspaces where the user is an active member
   */
  static async listUserWorkspaces(supabaseId: string): Promise<WorkspaceSummary[]> {
    const user = await this.getInternalUser(supabaseId);

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      isOwner: m.role === "owner" || m.workspace.ownerId === user.id,
      memberCount: m.workspace._count.members,
      isActive: m.workspace.id === user.activeWorkspaceId,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
    }));
  }

  /**
   * Create a new workspace and assign the creator as owner
   */
  static async createWorkspace(
    supabaseId: string,
    name: string
  ): Promise<WorkspaceSummary> {
    const user = await this.getInternalUser(supabaseId);

    // Create unique slug
    const cleanName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${cleanName || "ws"}-${Date.now().toString(36)}`;

    const newWorkspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });

    // Switch active workspace to newly created one
    await prisma.user.update({
      where: { id: user.id },
      data: { activeWorkspaceId: newWorkspace.id },
    });

    return {
      id: newWorkspace.id,
      name: newWorkspace.name,
      slug: newWorkspace.slug,
      role: "owner",
      isOwner: true,
      memberCount: 1,
      isActive: true,
      createdAt: newWorkspace.createdAt,
      updatedAt: newWorkspace.updatedAt,
    };
  }

  /**
   * Update workspace name. Enforces owner/admin role authorization.
   */
  static async updateWorkspace(
    supabaseId: string,
    workspaceId: string,
    name: string
  ): Promise<WorkspaceSummary> {
    const user = await this.getInternalUser(supabaseId);

    // Check membership and permissions
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
      include: {
        workspace: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    if (!membership) {
      const error: any = new Error("Workspace not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      const error: any = new Error("Forbidden: You must be an owner or admin to rename this workspace");
      error.statusCode = 403;
      throw error;
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      role: membership.role,
      isOwner: membership.role === "owner" || updated.ownerId === user.id,
      memberCount: membership.workspace._count.members,
      isActive: updated.id === user.activeWorkspaceId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Switch the user's active workspace. Enforces membership verification.
   */
  static async switchActiveWorkspace(
    supabaseId: string,
    workspaceId: string
  ): Promise<WorkspaceSummary> {
    const user = await this.getInternalUser(supabaseId);

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
      include: {
        workspace: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    if (!membership) {
      const error: any = new Error("Forbidden: You are not a member of this workspace");
      error.statusCode = 403;
      throw error;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { activeWorkspaceId: workspaceId },
    });

    return {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
      isOwner: membership.role === "owner" || membership.workspace.ownerId === user.id,
      memberCount: membership.workspace._count.members,
      isActive: true,
      createdAt: membership.workspace.createdAt,
      updatedAt: membership.workspace.updatedAt,
    };
  }
}
