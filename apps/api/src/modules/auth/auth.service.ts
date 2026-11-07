import { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "../../config/database";

export interface SyncedUser {
  id: string;
  supabaseId: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthService {
  /**
   * Synchronizes an authenticated Supabase user into the local Prisma PostgreSQL database.
   * Performs an idempotent upsert using supabaseId.
   */
  static async syncUserFromSupabase(supabaseUser: SupabaseUser): Promise<SyncedUser> {
    const supabaseId = supabaseUser.id;
    const email = supabaseUser.email;

    if (!email) {
      throw new Error("Cannot sync user without an email address");
    }

    const name =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      null;

    const user = await prisma.user.upsert({
      where: { supabaseId },
      update: {
        email,
        ...(name ? { name } : {}),
      },
      create: {
        supabaseId,
        email,
        name,
        role: "member",
      },
    });

    return user;
  }

  /**
   * Retrieves user profile from the database by Supabase user UUID.
   */
  static async getUserBySupabaseId(supabaseId: string): Promise<SyncedUser | null> {
    return prisma.user.findUnique({
      where: { supabaseId },
    });
  }
}

