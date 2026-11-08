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
  Campaign,
  CampaignRecipient,
  CampaignStats,
  CampaignValidationResponse,
  ScheduleDetails,
  CalendarScheduleItem,
  OverviewMetrics,
  TimelineBucket,
  DomainDeliverabilityItem,
  CampaignAnalyticsItem,
  CampaignDetailAnalytics,
  EngagementInsights,
  Automation,
  AutomationExecution,
  AutomationExecutionDetail,
  WorkflowValidationResult,
  WorkflowDefinition,
  AIStatusResponse,
  AISubjectLinesResponse,
  AIDraftResponse,
  AIPreheadersResponse,
  AIImproveResponse,
  DeliveryProvidersResponse,
  ProviderConnectionTestResponse,
  SendTestEmailResponse,
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

  return (json.data !== undefined ? json.data : json) as T;
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

  // ==========================================
  // Campaign Manager & Email Engine API
  // ==========================================

  async getCampaigns(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{
    items: Campaign[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    if (params?.search) q.set("search", params.search);
    if (params?.status && params.status !== "all") q.set("status", params.status.toUpperCase());
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortOrder) q.set("sortOrder", params.sortOrder);

    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/campaigns${queryStr}`);
  },

  async getCampaign(id: string): Promise<Campaign> {
    return apiRequest<Campaign>(`/api/campaigns/${id}`);
  },

  async createCampaign(data: {
    name: string;
    subject: string;
    preheader?: string | null;
    fromName: string;
    fromEmail: string;
    replyTo?: string | null;
    templateId?: string | null;
    htmlContent: string;
    targetListIds?: string[];
    targetTagIds?: string[];
    scheduledAt?: string | null;
    provider?: string;
  }): Promise<Campaign> {
    return apiRequest<Campaign>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateCampaign(
    id: string,
    data: Partial<{
      name: string;
      subject: string;
      preheader: string | null;
      fromName: string;
      fromEmail: string;
      replyTo: string | null;
      templateId: string | null;
      htmlContent: string;
      targetListIds: string[];
      targetTagIds: string[];
      scheduledAt: string | null;
      status: string;
      provider: string;
    }>
  ): Promise<Campaign> {
    return apiRequest<Campaign>(`/api/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteCampaign(id: string): Promise<{ id: string; deleted: boolean }> {
    return apiRequest<{ id: string; deleted: boolean }>(`/api/campaigns/${id}`, {
      method: "DELETE",
    });
  },

  async duplicateCampaign(id: string): Promise<Campaign> {
    return apiRequest<Campaign>(`/api/campaigns/${id}/duplicate`, {
      method: "POST",
    });
  },

  async validateCampaign(id: string): Promise<CampaignValidationResponse> {
    return apiRequest<CampaignValidationResponse>(`/api/campaigns/${id}/validate`, {
      method: "POST",
    });
  },

  async sendCampaign(id: string): Promise<Campaign> {
    return apiRequest<Campaign>(`/api/campaigns/${id}/send`, {
      method: "POST",
    });
  },

  async cancelCampaign(id: string): Promise<Campaign> {
    return apiRequest<Campaign>(`/api/campaigns/${id}/cancel`, {
      method: "POST",
    });
  },

  async getCampaignRecipients(
    id: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
    }
  ): Promise<{
    items: CampaignRecipient[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    if (params?.search) q.set("search", params.search);
    if (params?.status && params.status !== "all") q.set("status", params.status.toUpperCase());

    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/campaigns/${id}/recipients${queryStr}`);
  },

  async getCampaignStats(id: string): Promise<CampaignStats> {
    return apiRequest<CampaignStats>(`/api/campaigns/${id}/stats`);
  },

  // ==========================================
  // Campaign Scheduling API
  // ==========================================

  async scheduleCampaign(
    id: string,
    data: { scheduledAt: string; timezone?: string }
  ): Promise<Campaign> {
    return apiRequest<Campaign>(`/api/campaigns/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async rescheduleCampaign(
    id: string,
    data: { scheduledAt: string; timezone?: string }
  ): Promise<Campaign> {
    return apiRequest<Campaign>(`/api/campaigns/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async unscheduleCampaign(id: string): Promise<Campaign> {
    return apiRequest<Campaign>(`/api/campaigns/${id}/unschedule`, {
      method: "POST",
    });
  },

  async getSchedules(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    items: (Campaign & {
      template?: { id: string; name: string; category: string } | null;
      delayRemainingMs?: number;
    })[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    if (params?.status) q.set("status", params.status);

    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/schedules${queryStr}`);
  },

  async getCalendarSchedules(
    start: string,
    end: string,
    timezone?: string
  ): Promise<{ items: CalendarScheduleItem[] }> {
    const q = new URLSearchParams({ start, end });
    if (timezone) q.set("timezone", timezone);
    return apiRequest(`/api/schedules/calendar?${q.toString()}`);
  },

  async getScheduleDetails(
    id: string,
    timezone?: string
  ): Promise<ScheduleDetails> {
    const q = new URLSearchParams();
    if (timezone) q.set("timezone", timezone);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/schedules/${id}${queryStr}`);
  },

  // ==========================================
  // Phase 8: Analytics & Performance API
  // ==========================================

  async getAnalyticsOverview(params?: {
    range?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<OverviewMetrics> {
    const q = new URLSearchParams();
    if (params?.range) q.set("range", params.range);
    if (params?.startDate) q.set("startDate", params.startDate);
    if (params?.endDate) q.set("endDate", params.endDate);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest<OverviewMetrics>(`/api/analytics/overview${queryStr}`);
  },

  async getAnalyticsCampaigns(params?: {
    range?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    items: CampaignAnalyticsItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const q = new URLSearchParams();
    if (params?.range) q.set("range", params.range);
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    if (params?.search) q.set("search", params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/analytics/campaigns${queryStr}`);
  },

  async getAnalyticsCampaignDetail(
    id: string
  ): Promise<CampaignDetailAnalytics> {
    return apiRequest<CampaignDetailAnalytics>(`/api/analytics/campaigns/${id}`);
  },

  async getAnalyticsTimeline(params?: {
    range?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: TimelineBucket[] }> {
    const q = new URLSearchParams();
    if (params?.range) q.set("range", params.range);
    if (params?.startDate) q.set("startDate", params.startDate);
    if (params?.endDate) q.set("endDate", params.endDate);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/analytics/timeline${queryStr}`);
  },

  async getAnalyticsDeliverability(params?: {
    range?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: DomainDeliverabilityItem[] }> {
    const q = new URLSearchParams();
    if (params?.range) q.set("range", params.range);
    if (params?.startDate) q.set("startDate", params.startDate);
    if (params?.endDate) q.set("endDate", params.endDate);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/analytics/deliverability${queryStr}`);
  },

  async getAnalyticsEngagement(params?: {
    range?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<EngagementInsights> {
    const q = new URLSearchParams();
    if (params?.range) q.set("range", params.range);
    if (params?.startDate) q.set("startDate", params.startDate);
    if (params?.endDate) q.set("endDate", params.endDate);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/analytics/engagement${queryStr}`);
  },

  // ==========================================
  // Automations (Phase 9)
  // ==========================================
  async getAutomations(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Automation[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/automations${queryStr}`);
  },

  async getAutomation(id: string): Promise<Automation> {
    return apiRequest(`/api/automations/${id}`);
  },

  async createAutomation(data: {
    name: string;
    description?: string;
    triggerType?: string;
    workflowDefinition?: WorkflowDefinition;
  }): Promise<Automation> {
    return apiRequest("/api/automations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateAutomation(
    id: string,
    data: {
      name?: string;
      description?: string;
      triggerType?: string;
      workflowDefinition?: WorkflowDefinition;
    }
  ): Promise<Automation> {
    return apiRequest(`/api/automations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteAutomation(id: string): Promise<{ id: string; deleted: boolean }> {
    return apiRequest(`/api/automations/${id}`, {
      method: "DELETE",
    });
  },

  async validateAutomation(id: string): Promise<WorkflowValidationResult> {
    return apiRequest(`/api/automations/${id}/validate`, {
      method: "POST",
    });
  },

  async activateAutomation(id: string): Promise<Automation> {
    return apiRequest(`/api/automations/${id}/activate`, {
      method: "POST",
    });
  },

  async pauseAutomation(id: string): Promise<Automation> {
    return apiRequest(`/api/automations/${id}/pause`, {
      method: "POST",
    });
  },

  async getAutomationExecutions(
    id: string,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<{ items: AutomationExecution[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiRequest(`/api/automations/${id}/executions${queryStr}`);
  },

  async getAutomationExecutionDetail(
    id: string,
    executionId: string
  ): Promise<AutomationExecutionDetail> {
    return apiRequest(`/api/automations/${id}/executions/${executionId}`);
  },

  // ==========================================
  // AI Campaign Copilot (Phase 9)
  // ==========================================
  async getAIStatus(): Promise<AIStatusResponse> {
    return apiRequest("/api/ai/status");
  },

  async generateSubjectLines(data: {
    purpose: string;
    audience?: string;
    tone?: string;
    count?: number;
  }): Promise<AISubjectLinesResponse> {
    return apiRequest("/api/ai/subject-lines", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async generateEmailDraft(data: {
    goal: string;
    productDetails?: string;
    audience?: string;
    tone?: string;
    cta?: string;
  }): Promise<AIDraftResponse> {
    return apiRequest("/api/ai/generate-email", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async generatePreheader(data: {
    subject: string;
    emailContent?: string;
    count?: number;
  }): Promise<AIPreheadersResponse> {
    return apiRequest("/api/ai/generate-preheader", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async improveCampaign(data: {
    subject?: string;
    preheader?: string;
    htmlContent?: string;
  }): Promise<AIImproveResponse> {
    return apiRequest("/api/ai/improve-campaign", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // ==========================================
  // Delivery Provider Settings
  // ==========================================
  async getDeliveryProviders(): Promise<DeliveryProvidersResponse> {
    return apiRequest<DeliveryProvidersResponse>("/api/settings/providers");
  },

  async testProviderConnection(
    provider: "RESEND" | "BREVO" | string
  ): Promise<ProviderConnectionTestResponse> {
    return apiRequest<ProviderConnectionTestResponse>(
      `/api/settings/providers/${provider.toLowerCase()}/test-connection`,
      { method: "POST" }
    );
  },

  async sendProviderTestEmail(
    provider: "RESEND" | "BREVO" | string,
    to: string
  ): Promise<SendTestEmailResponse> {
    return apiRequest<SendTestEmailResponse>(
      `/api/settings/providers/${provider.toLowerCase()}/send-test-email`,
      {
        method: "POST",
        body: JSON.stringify({ to }),
      }
    );
  },

  async setDefaultDeliveryProvider(
    provider: "RESEND" | "BREVO"
  ): Promise<{ defaultEmailProvider: string }> {
    return apiRequest<{ defaultEmailProvider: string }>(
      "/api/settings/providers/default",
      {
        method: "PATCH",
        body: JSON.stringify({ provider }),
      }
    );
  },
};

