import { supabase } from "./supabase";
import type { AuthMeResponse, Workspace, UserProfile } from "@/types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * Retrieves the current session Bearer access token
 */
async function getBearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

/**
 * Generic authorized JSON request helper
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getBearerToken();

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      json.error?.message || json.message || `Request failed with status ${res.status}`;
    const error: any = new Error(errorMsg);
    error.status = res.status;
    error.statusCode = res.status;
    throw error;
  }

  return json.data as T;
}

export const api = {
  /**
   * Fetches user profile, active workspace, and accessible workspaces
   */
  async getMe(): Promise<AuthMeResponse> {
    return apiRequest<AuthMeResponse>("/api/auth/me");
  },

  /**
   * Updates user profile fields (e.g. name)
   */
  async updateProfile(data: { name?: string }): Promise<{ profile: UserProfile }> {
    return apiRequest<{ profile: UserProfile }>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Lists all workspaces for authenticated user
   */
  async listWorkspaces(): Promise<{ workspaces: Workspace[] }> {
    return apiRequest<{ workspaces: Workspace[] }>("/api/workspaces");
  },

  /**
   * Creates a new workspace
   */
  async createWorkspace(name: string): Promise<{ workspace: Workspace }> {
    return apiRequest<{ workspace: Workspace }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  /**
   * Renames an existing workspace
   */
  async updateWorkspace(id: string, name: string): Promise<{ workspace: Workspace }> {
    return apiRequest<{ workspace: Workspace }>(`/api/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },

  /**
   * Switches active workspace
   */
  async switchWorkspace(id: string): Promise<{ activeWorkspace: Workspace }> {
    return apiRequest<{ activeWorkspace: Workspace }>(`/api/workspaces/${id}/switch`, {
      method: "POST",
    });
  },
};

