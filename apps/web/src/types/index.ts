export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    statusCode?: number;
    details?: unknown;
  };
}

export interface UserProfile {
  id: string;
  supabaseId: string;
  email: string;
  name: string | null;
  role: string;
  activeWorkspaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  isOwner?: boolean;
  memberCount?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthMeResponse {
  profile: UserProfile;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  auth: {
    id: string;
    email?: string;
    phone?: string;
    lastSignInAt?: string;
    createdAt?: string;
  };
}

export interface HealthResponse {
  status: "healthy" | "unhealthy" | string;
  service?: string;
  timestamp: string;
  metrics?: {
    uptimeSeconds?: number;
    databaseLatencyMs?: number;
    redisLatencyMs?: number;
  };
  dependencies?: {
    database?: string;
    redis?: string;
  };
  services?: {
    redis?: { status: string; latencyMs?: number };
    database?: { status: string; latencyMs?: number };
  };
}

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  audience: string;
  recipientCount: number;
  sentAt?: string;
  scheduledFor?: string;
  createdAt: string;
  stats?: {
    sent: number;
    delivered: number;
    opens: number;
    openRate: number;
    clicks: number;
    clickRate: number;
  };
}

export type ContactStatus = "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED" | "active" | "unsubscribed" | "bounced";
export type ContactSource = "MANUAL" | "CSV" | "API";

export interface ContactTag {
  id: string;
  name: string;
  color?: string;
  count?: number;
  createdAt?: string;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string | null;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contact {
  id: string;
  workspaceId?: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  status: ContactStatus;
  source?: ContactSource;
  tags?: Array<{ id: string; name: string; color?: string } | string>;
  lists?: Array<{ id: string; name: string }>;
  customFields?: Record<string, any> | null;
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string;
  engagementScore?: number;
}

export interface ContactStats {
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
  listCount: number;
  tagCount: number;
}

export interface ImportJob {
  id: string;
  workspaceId: string;
  fileName: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorReport?: Array<{ row: number; email?: string; error: string }>;
  createdAt: string;
  completedAt?: string | null;
}

export type TemplateCategory = "marketing" | "transactional" | "newsletter" | "onboarding" | "announcement";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnailColor: string;
  lastModified: string;
  tags: string[];
}

export type AutomationTriggerType = "user_signup" | "tag_added" | "cart_abandoned" | "link_clicked" | "custom_event";

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  triggerType: AutomationTriggerType;
  isActive: boolean;
  stepCount: number;
  totalEnrolled: number;
  completedCount: number;
  lastTriggeredAt?: string;
}

export interface ScheduledCampaign {
  id: string;
  name: string;
  scheduledTime: string;
  recipientCount: number;
  targetAudience: string;
  queueStatus: "queued" | "delayed" | "processing";
  channel: string;
}

export interface ActivityEvent {
  id: string;
  type: "campaign_sent" | "contacts_imported" | "automation_triggered" | "system_worker" | "domain_verified";
  title: string;
  description: string;
  timestamp: string;
  status?: "success" | "pending" | "info";
}
