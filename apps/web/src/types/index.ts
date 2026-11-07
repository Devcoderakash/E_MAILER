export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    statusCode?: number;
    details?: unknown;
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

export type ContactStatus = "active" | "unsubscribed" | "bounced" | "pending";

export interface Contact {
  id: string;
  email: string;
  name?: string;
  status: ContactStatus;
  tags: string[];
  createdAt: string;
  lastActiveAt?: string;
  engagementScore?: number;
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
