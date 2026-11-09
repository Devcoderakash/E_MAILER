import { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "../../config/database";

export interface SyncedUser {
  id: string;
  supabaseId: string;
  email: string;
  name: string | null;
  role: string;
  activeWorkspaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAuthContext {
  profile: SyncedUser;
  activeWorkspace: {
    id: string;
    name: string;
    slug: string;
    role: string;
  } | null;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    isOwner: boolean;
  }>;
}

export class AuthService {
  /**
   * Synchronizes an authenticated Supabase user into the local Prisma PostgreSQL database.
   * Performs an idempotent upsert using supabaseId and ensures a default workspace exists.
   */
  static async syncUserFromSupabase(supabaseUser: SupabaseUser): Promise<UserAuthContext> {
    const supabaseId = supabaseUser.id;
    const email = supabaseUser.email;

    if (!email) {
      throw new Error("Cannot sync user without an email address");
    }

    const name =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      null;

    // 1. Resolve User record by supabaseId OR email (handles re-registration or OAuth provider linking)
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ supabaseId }, { email }],
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          supabaseId,
          email,
          ...(name ? { name } : {}),
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          supabaseId,
          email,
          name,
          role: "member",
        },
      });
    }

    // 2. Fetch existing workspace memberships
    let memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    // 3. If user has no workspaces, provision a default workspace
    if (memberships.length === 0) {
      const defaultWsName = name ? `${name}'s Workspace` : "My Workspace";
      const slug = `ws-${user.id.substring(0, 8)}-${Date.now().toString(36)}`;

      const newWs = await prisma.workspace.create({
        data: {
          name: defaultWsName,
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

      await prisma.user.update({
        where: { id: user.id },
        data: { activeWorkspaceId: newWs.id },
      });

      // Refetch memberships
      memberships = await prisma.workspaceMember.findMany({
        where: { userId: user.id },
        include: { workspace: true },
        orderBy: { createdAt: "asc" },
      });
    }

    // 4. Resolve active workspace
    const latestUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    let activeMember = memberships.find(
      (m) => m.workspaceId === latestUser?.activeWorkspaceId
    );

    // If activeWorkspaceId is null or invalid, default to the first workspace
    if (!activeMember && memberships.length > 0) {
      activeMember = memberships[0];
      await prisma.user.update({
        where: { id: user.id },
        data: { activeWorkspaceId: activeMember.workspaceId },
      });
    }

    const activeWorkspace = activeMember
      ? {
          id: activeMember.workspace.id,
          name: activeMember.workspace.name,
          slug: activeMember.workspace.slug,
          role: activeMember.role,
        }
      : null;

    const availableWorkspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      isOwner: m.role === "owner" || m.workspace.ownerId === user.id,
    }));

    return {
      profile: {
        id: user.id,
        supabaseId: user.supabaseId,
        email: user.email,
        name: user.name,
        role: user.role,
        activeWorkspaceId: activeMember?.workspaceId || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      activeWorkspace,
      workspaces: availableWorkspaces,
    };
  }

  /**
   * Retrieves user profile from database by Supabase user UUID.
   */
  static async getUserBySupabaseId(supabaseId: string): Promise<SyncedUser | null> {
    return prisma.user.findUnique({
      where: { supabaseId },
    });
  }
}
