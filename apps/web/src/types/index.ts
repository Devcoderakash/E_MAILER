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
  defaultEmailProvider?: "RESEND" | "BREVO" | string;
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

export type CampaignStatus =
  | "DRAFT"
  | "QUEUED"
  | "SCHEDULED"
  | "SENDING"
  | "SENT"
  | "PAUSED"
  | "FAILED"
  | "CANCELLED"
  | "draft"
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "failed"
  | "cancelled";

export type CampaignRecipientStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "SKIPPED";

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: CampaignRecipientStatus;
  attempts: number;
  errorMessage?: string | null;
  sentAt?: string | null;
  providerMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  workspaceId?: string;
  name: string;
  subject: string;
  preheader?: string | null;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string | null;
  templateId?: string | null;
  template?: { id: string; name: string; category?: string } | null;
  htmlContent?: string;
  status: CampaignStatus;
  targetListIds?: string[];
  targetTagIds?: string[];
  provider?: "RESEND" | "BREVO" | string;
  recipientCount: number;
  sentCount?: number;
  failedCount?: number;
  deliveredCount?: number;
  openedCount?: number;
  clickedCount?: number;
  bouncedCount?: number;
  complainedCount?: number;
  unsubscribedCount?: number;
  scheduledAt?: string | null;
  scheduledTimezone?: string | null;
  scheduledJobId?: string | null;
  lastScheduledAt?: string | null;
  schedulingError?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  // UI compatibility aliases
  audience?: string;
  sentAt?: string;
  scheduledFor?: string;
  stats?: {
    sent: number;
    delivered?: number;
    opens?: number;
    openRate?: number;
    clicks?: number;
    clickRate?: number;
  };
}

export interface CampaignStats {
  campaignId: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  processingCount: number;
  skippedCount: number;
  progressPercent: number;
  deliveryRate: number;
  startedAt?: string | null;
  completedAt?: string | null;
  durationSeconds?: number | null;
}

export interface CampaignValidationResponse {
  canSend: boolean;
  errors: string[];
  checklist: {
    hasSubject: boolean;
    hasFromEmail: boolean;
    hasFromName: boolean;
    hasContent: boolean;
    hasAudience: boolean;
    hasValidProvider?: boolean;
    hasValidSenderDomain?: boolean;
  };
  audienceSummary: {
    totalEligibleActive: number;
    excludedUnsubscribed: number;
    excludedBounced: number;
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

export type TemplateCategory =
  | "MARKETING"
  | "NEWSLETTER"
  | "TRANSACTIONAL"
  | "WELCOME"
  | "PROMOTIONAL"
  | "CUSTOM"
  | "marketing"
  | "newsletter"
  | "transactional"
  | "welcome"
  | "promotional"
  | "custom";

export type TemplateStatus = "DRAFT" | "READY" | "draft" | "ready";

export interface EmailTemplate {
  id: string;
  workspaceId?: string;
  name: string;
  description?: string | null;
  category: TemplateCategory;
  subject?: string | null;
  preheader?: string | null;
  htmlContent: string;
  editorContent?: any;
  status: TemplateStatus;
  createdAt: string;
  updatedAt: string;
  thumbnailColor?: string;
  tags?: string[];
}

export type Template = EmailTemplate;

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

export interface ScheduleDetails {
  campaign: Campaign;
  queueStatus: {
    jobId: string | null;
    isDelayed: boolean;
    delayRemainingMs: number;
    state: string;
  };
  audienceSummary: {
    totalEligibleActive: number;
    excludedUnsubscribed: number;
    excludedBounced: number;
  };
}

export interface CalendarScheduleItem {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  scheduledAt: string;
  formattedLocal: string;
  userTimezone: string;
  recipientCount: number;
}

export interface ActivityEvent {
  id: string;
  type: "campaign_sent" | "contacts_imported" | "automation_triggered" | "system_worker" | "domain_verified";
  title: string;
  description: string;
  timestamp: string;
  status?: "success" | "pending" | "info";
}

// ==========================================
// Phase 8: Webhooks & Analytics Types
// ==========================================

export interface OverviewMetrics {
  sent: number;
  delivered: number;
  deliveryRate: number;
  totalOpens: number;
  uniqueOpens: number;
  openRate: number;
  totalClicks: number;
  uniqueClicks: number;
  clickRate: number;
  bounces: number;
  bounceRate: number;
  complaints: number;
  complaintRate: number;
  unsubscribes: number;
  unsubscribeRate: number;
  totalCampaigns: number;
  activeContacts: number;
  hasProviderEvents: boolean;
}

export interface TimelineBucket {
  date: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
}

export interface DomainDeliverabilityItem {
  domain: string;
  sent: number;
  delivered: number;
  deliveryRate: number;
  bounces: number;
  bounceRate: number;
  status: "Optimal" | "Good" | "Needs Attention";
}

export interface CampaignAnalyticsItem {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  createdAt: string;
  sentAt: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  deliveryRate: number;
  uniqueOpens: number;
  openRate: number;
  uniqueClicks: number;
  clickRate: number;
  bouncedCount: number;
  bounceRate: number;
  complainedCount: number;
  unsubscribedCount: number;
  template?: { id: string; name: string; category?: string } | null;
}

export interface CampaignDetailAnalytics {
  campaign: CampaignAnalyticsItem & {
    fromName: string;
    fromEmail: string;
    startedAt?: string | null;
    completedAt?: string | null;
  };
  recentEvents: {
    id: string;
    eventType: string;
    occurredAt: string;
    recipientEmail: string;
    recipientName?: string | null;
    metadata?: any;
  }[];
}

export interface EngagementInsights {
  topLinks: {
    link: string;
    totalClicks: number;
    uniqueClicks: number;
  }[];
  totalClickEvents: number;
}

// ==========================================
// Phase 9: Automations & AI Campaign Copilot
// ==========================================

export type AutomationStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type AutomationExecutionStatus = "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type AutomationStepStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

export interface WorkflowNode {
  id: string;
  type: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  status: AutomationStatus;
  triggerType: string;
  workflowDefinition?: WorkflowDefinition;
  stepCount?: number;
  totalEnrolled?: number;
  completedCount?: number;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
}

export interface AutomationExecution {
  id: string;
  status: AutomationExecutionStatus;
  currentNodeId: string | null;
  stepCount: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  contact?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface AutomationStepExecution {
  id: string;
  nodeId: string;
  nodeType: string;
  status: AutomationStepStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  result: Record<string, any> | null;
  createdAt: string;
}

export interface AutomationExecutionDetail extends AutomationExecution {
  stepExecutions: AutomationStepExecution[];
  contextData?: Record<string, any>;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  triggerNode?: WorkflowNode;
}

// AI Copilot Types
export interface AIStatusResponse {
  configured: boolean;
  provider: string;
  model?: string;
  notice?: string;
}

export interface AISubjectLinesResponse {
  provider: string;
  suggestions: string[];
}

export interface AIDraftResponse {
  provider: string;
  draft: {
    subject: string;
    preheader: string;
    heading: string;
    bodyHtml: string;
    ctaText: string;
    ctaUrl: string;
  };
}

export interface AIPreheadersResponse {
  provider: string;
  suggestions: string[];
}

export interface AIImproveResponse {
  provider: string;
  analysis: {
    readabilityScore: number;
    clarityGrade: string;
    ctaStrength: string;
    spamRisk: string;
    suggestions: string[];
    spamWarnings: string[];
  };
}

// Delivery Provider Settings Types
export interface DeliveryProviderInfo {
  type: "RESEND" | "BREVO";
  name: string;
  configured: boolean;
  isConfigured: boolean;
  default: boolean;
  isDefault: boolean;
  senderEmail?: string;
  senderName?: string;
  supportsPersonalEmail: boolean;
  supportsPersonalSender: boolean;
  requiresCustomDomain: boolean;
}

export interface DeliveryProvidersResponse {
  defaultProvider: "RESEND" | "BREVO";
  providers: DeliveryProviderInfo[];
}

export interface ProviderConnectionTestResponse {
  success: boolean;
  ok: boolean;
  message: string;
  details?: {
    success: boolean;
    provider: string;
    accountEmail?: string;
    planType?: string;
    credits?: number;
    message: string;
    testedAt: string;
  };
}

export interface SendTestEmailResponse {
  success: boolean;
  ok?: boolean;
  status?: string;
  providerMessageId?: string;
  message?: string;
  error?: string;
}
