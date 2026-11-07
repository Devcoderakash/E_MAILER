import { supabase } from "./supabase";
import type {
  AuthMeResponse,
  Workspace,
  UserProfile,
  Contact,
  ContactStats,
  ContactList,
  ContactTag,
  ImportJob,
  EmailTemplate,
} from "@/types";
import { useAuthStore } from "@/features/auth/use-auth-store";

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

  const activeWorkspaceId = useAuthStore.getState().activeWorkspace?.id;
  if (activeWorkspaceId && !headers.has("x-workspace-id")) {
    headers.set("x-workspace-id", activeWorkspaceId);
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

  // ==========================================
  // Contacts API
  // ==========================================

  async getContacts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tagId?: string;
    listId?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{
    contacts: Contact[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    if (params?.search) q.set("search", params.search);
    if (params?.status && params.status !== "all") q.set("status", params.status);
    if (params?.tagId && params.tagId !== "all") q.set("tagId", params.tagId);
    if (params?.listId && params.listId !== "all") q.set("listId", params.listId);
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortOrder) q.set("sortOrder", params.sortOrder);

    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<{
      contacts: Contact[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/contacts${queryStr}`);
  },

  async getContactStats(): Promise<ContactStats> {
    return apiRequest<ContactStats>("/api/contacts/stats");
  },

  async getContact(id: string): Promise<{ contact: Contact }> {
    return apiRequest<{ contact: Contact }>(`/api/contacts/${id}`);
  },

  async createContact(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
    status?: string;
    tags?: string[];
    listIds?: string[];
    customFields?: Record<string, any>;
  }): Promise<{ contact: Contact }> {
    return apiRequest<{ contact: Contact }>("/api/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateContact(
    id: string,
    data: Partial<{
      email: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      company: string | null;
      status: string;
      tags: string[];
      listIds: string[];
      customFields: Record<string, any>;
    }>
  ): Promise<{ contact: Contact }> {
    return apiRequest<{ contact: Contact }>(`/api/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteContact(id: string): Promise<{ id: string; email: string }> {
    return apiRequest<{ id: string; email: string }>(`/api/contacts/${id}`, {
      method: "DELETE",
    });
  },

  async bulkDeleteContacts(ids: string[]): Promise<{ count: number }> {
    return apiRequest<{ count: number }>("/api/contacts/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },

  // ==========================================
  // Contact Lists API
  // ==========================================

  async getContactLists(): Promise<{ lists: ContactList[] }> {
    return apiRequest<{ lists: ContactList[] }>("/api/contact-lists");
  },

  async createContactList(data: {
    name: string;
    description?: string;
  }): Promise<{ list: ContactList }> {
    return apiRequest<{ list: ContactList }>("/api/contact-lists", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateContactList(
    id: string,
    data: { name: string; description?: string }
  ): Promise<{ list: ContactList }> {
    return apiRequest<{ list: ContactList }>(`/api/contact-lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteContactList(id: string): Promise<{ id: string; name: string }> {
    return apiRequest<{ id: string; name: string }>(`/api/contact-lists/${id}`, {
      method: "DELETE",
    });
  },

  // ==========================================
  // Contact Tags API
  // ==========================================

  async getContactTags(): Promise<{ tags: ContactTag[] }> {
    return apiRequest<{ tags: ContactTag[] }>("/api/contact-tags");
  },

  async createContactTag(data: {
    name: string;
    color?: string;
  }): Promise<{ tag: ContactTag }> {
    return apiRequest<{ tag: ContactTag }>("/api/contact-tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateContactTag(
    id: string,
    data: { name: string; color?: string }
  ): Promise<{ tag: ContactTag }> {
    return apiRequest<{ tag: ContactTag }>(`/api/contact-tags/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteContactTag(id: string): Promise<{ id: string; name: string }> {
    return apiRequest<{ id: string; name: string }>(`/api/contact-tags/${id}`, {
      method: "DELETE",
    });
  },

  // ==========================================
  // CSV Import API
  // ==========================================

  async importContacts(data: {
    fileName: string;
    rows: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      company?: string;
      tags?: string[];
      customFields?: Record<string, any>;
    }>;
    tags?: string[];
    listIds?: string[];
  }): Promise<{
    jobId: string;
    totalRows: number;
    importedRows: number;
    skippedRows: number;
    failedRows: number;
    status: string;
    errors: Array<{ row: number; email?: string; error: string }>;
  }> {
    return apiRequest("/api/contacts/import", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getImportJobs(): Promise<{ jobs: ImportJob[] }> {
    return apiRequest<{ jobs: ImportJob[] }>("/api/contacts/import-jobs");
  },

  // ==========================================
  // Email Template Studio API
  // ==========================================

  async getTemplates(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{
    templates: EmailTemplate[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    if (params?.search) q.set("search", params.search);
    if (params?.category && params.category !== "all") q.set("category", params.category.toUpperCase());
    if (params?.status && params.status !== "all") q.set("status", params.status.toUpperCase());
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortOrder) q.set("sortOrder", params.sortOrder);

    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<{
      templates: EmailTemplate[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/templates${queryStr}`);
  },

  async getTemplate(id: string): Promise<{ template: EmailTemplate }> {
    return apiRequest<{ template: EmailTemplate }>(`/api/templates/${id}`);
  },

  async createTemplate(data: {
    name: string;
    description?: string;
    category?: string;
    subject?: string;
    preheader?: string;
    htmlContent: string;
    editorContent?: any;
    status?: string;
  }): Promise<{ template: EmailTemplate }> {
    return apiRequest<{ template: EmailTemplate }>("/api/templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateTemplate(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      category: string;
      subject: string | null;
      preheader: string | null;
      htmlContent: string;
      editorContent: any;
      status: string;
    }>
  ): Promise<{ template: EmailTemplate }> {
    return apiRequest<{ template: EmailTemplate }>(`/api/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async duplicateTemplate(id: string): Promise<{ template: EmailTemplate }> {
    return apiRequest<{ template: EmailTemplate }>(`/api/templates/${id}/duplicate`, {
      method: "POST",
    });
  },

  async deleteTemplate(id: string): Promise<{ id: string; name: string }> {
    return apiRequest<{ id: string; name: string }>(`/api/templates/${id}`, {
      method: "DELETE",
    });
  },
};

