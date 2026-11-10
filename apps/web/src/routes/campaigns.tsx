import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MailCheck,
  Plus,
  Copy,
  Trash2,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  Tag as TagIcon,
  Loader2,
  Play,
  RotateCcw,
  Calendar,
  Sparkles,
  Monitor,
  Smartphone,
  FileText,
  Search,
} from "lucide-react";
import { AICopilotModal } from "@/features/campaigns/ai-copilot-modal";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  EmptyState,
  TopProgressBar,
} from "@/components/common";
import type { Campaign } from "@/types";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { STARTER_TEMPLATES, getStarterHTML } from "@/features/templates/sample-templates";
import { TemplatesPage } from "./templates";

/**
 * Client-side merge tag interpolation with fallback support (e.g. {{first_name|there}})
 */
function interpolatePreview(
  template: string,
  data: { firstName?: string; lastName?: string; company?: string; email?: string }
): string {
  if (!template) return "";
  const lookup: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v != null) {
      lookup[k.toLowerCase()] = String(v);
      lookup[k.toLowerCase().replace(/[-_]/g, "")] = String(v);
    }
  }
  if (data.firstName) {
    lookup["first_name"] = data.firstName;
    lookup["firstname"] = data.firstName;
  }
  if (data.lastName) {
    lookup["last_name"] = data.lastName;
    lookup["lastname"] = data.lastName;
  }

  return template.replace(
    /\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g,
    (_match, rawKey, fallback) => {
      const norm = rawKey.toLowerCase();
      const stripped = norm.replace(/[-_]/g, "");
      const val = lookup[norm] ?? lookup[stripped];
      if (val && val.trim() !== "") return val;
      if (fallback !== undefined) return fallback.trim();
      return "";
    }
  );
}

export function CampaignsPage() {
  const queryClient = useQueryClient();
  const { activeWorkspace, profile, user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Unified Filter & Search State
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Notifications
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Modal / Drawer states
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [detailsCampaign, setDetailsCampaign] = useState<Campaign | null>(null);

  // Auto-open wizard if URL param ?action=create
  useEffect(() => {
    if (searchParams.get("action") === "create") {
      openCreateWizard();
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  // Form State for 4-Step Campaign Creation Wizard
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formPreheader, setFormPreheader] = useState("");
  const [formFromName, setFormFromName] = useState("");
  const [formFromEmail, setFormFromEmail] = useState("");
  const [formReplyTo, setFormReplyTo] = useState("");
  const [formTemplateId, setFormTemplateId] = useState<string | null>(null);
  const [formHtmlContent, setFormHtmlContent] = useState<string>("");
  const [formAudienceType, setFormAudienceType] = useState<"all" | "segmented">("all");
  const [formSelectedListIds, setFormSelectedListIds] = useState<string[]>([]);
  const [formSelectedTagIds, setFormSelectedTagIds] = useState<string[]>([]);

  // Step 2 & 3 State
  const [contentDesignMode, setContentDesignMode] = useState<"templates" | "html">("templates");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [sendTimingMode, setSendTimingMode] = useState<"now" | "schedule">("now");
  const [scheduledDateTime, setScheduledDateTime] = useState<string>("");

  // Step 4 Review & Test Email State
  const [testEmailAddress, setTestEmailAddress] = useState<string>("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [showWizardConfirmSend, setShowWizardConfirmSend] = useState(false);

  // Context Actions Modals
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [campaignToSend, setCampaignToSend] = useState<Campaign | null>(null);
  const [campaignToCancel, setCampaignToCancel] = useState<Campaign | null>(null);

  // 1. Fetch campaigns with unified filter
  const { data: campaignsData, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: [
      "campaigns",
      activeWorkspace?.id,
      page,
      statusFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      api.getCampaigns({
        page,
        limit: 12,
        status: statusFilter === "all" ? undefined : (statusFilter as any),
        search: debouncedSearch || undefined,
      }),
    enabled: !!activeWorkspace?.id,
    refetchInterval: 15000,
  });

  // Fetch all campaigns to compute exact counts for filter chips
  const { data: allCampaignsData } = useQuery({
    queryKey: ["campaigns-all-counts", activeWorkspace?.id],
    queryFn: () => api.getCampaigns({ limit: 100 }),
    enabled: !!activeWorkspace?.id,
    refetchInterval: 15000,
  });

  const allItems = allCampaignsData?.items || [];
  const campaignCounts = useMemo(() => {
    return {
      all: allCampaignsData?.pagination?.total ?? allItems.length,
      DRAFT: allItems.filter((c: any) => c.status === "DRAFT").length,
      SCHEDULED: allItems.filter((c: any) => c.status === "SCHEDULED").length,
      SENDING: allItems.filter((c: any) => c.status === "SENDING" || c.status === "QUEUED").length,
      SENT: allItems.filter((c: any) => c.status === "SENT").length,
      FAILED: allItems.filter((c: any) => c.status === "FAILED" || c.status === "CANCELLED").length,
    };
  }, [allItems, allCampaignsData]);

  // 2. Fetch Contact lists & tags for audience step
  const listsQuery = useQuery({
    queryKey: ["contact-lists", activeWorkspace?.id],
    queryFn: () => api.getContactLists(),
    enabled: isWizardOpen && !!activeWorkspace?.id,
  });

  const tagsQuery = useQuery({
    queryKey: ["contact-tags", activeWorkspace?.id],
    queryFn: () => api.getContactTags(),
    enabled: isWizardOpen && !!activeWorkspace?.id,
  });

  const contactStatsQuery = useQuery({
    queryKey: ["contact-stats", activeWorkspace?.id],
    queryFn: () => api.getContactStats(),
    enabled: !!activeWorkspace?.id,
  });

  // Fetch real contact data for live merge tag preview
  const sampleContactQuery = useQuery({
    queryKey: ["sample-contact", activeWorkspace?.id],
    queryFn: () => api.getContacts({ page: 1, limit: 1 }),
    enabled: isWizardOpen && !!activeWorkspace?.id,
  });

  const sampleContact = sampleContactQuery.data?.contacts?.[0];
  const sampleData = {
    firstName: sampleContact?.firstName || "Alex",
    lastName: sampleContact?.lastName || "Taylor",
    company: sampleContact?.company || "Acme Corp",
    email: sampleContact?.email || user?.email || "alex@example.com",
  };

  // Recipient delivery logs for campaign details
  const campaignRecipientsQuery = useQuery({
    queryKey: ["campaign-recipients", detailsCampaign?.id],
    queryFn: () => api.getCampaignRecipients(detailsCampaign!.id, { limit: 50 }),
    enabled: !!detailsCampaign?.id,
  });

  const campaigns = campaignsData?.items || [];
  const pagination = campaignsData?.pagination;

  // Mutations
  const sendCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => api.sendCampaign(campaignId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCampaignToSend(null);
      setShowWizardConfirmSend(false);
      setIsWizardOpen(false);
      setToastMessage({
        type: "success",
        text: `Campaign "${updated.name}" is now sending!`,
      });
    },
    onError: (err: any) => {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to send campaign",
      });
    },
  });

  const cancelCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => api.cancelCampaign(campaignId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCampaignToCancel(null);
      setToastMessage({
        type: "success",
        text: `Campaign "${updated.name}" schedule cancelled.`,
      });
    },
    onError: (err: any) => {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to cancel campaign",
      });
    },
  });

  const duplicateCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => api.duplicateCampaign(campaignId),
    onSuccess: (duplicated) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setToastMessage({
        type: "success",
        text: `Duplicated as "${duplicated.name}"`,
      });
    },
    onError: (err: any) => {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to duplicate campaign",
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => api.deleteCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCampaignToDelete(null);
      if (detailsCampaign?.id === campaignToDelete?.id) {
        setDetailsCampaign(null);
      }
      setToastMessage({
        type: "success",
        text: "Campaign deleted successfully",
      });
    },
    onError: (err: any) => {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to delete campaign",
      });
    },
  });

  // Open creation wizard with default values
  const openCreateWizard = () => {
    const defaultTemplate = STARTER_TEMPLATES[0];
    setFormName("");
    setFormSubject(defaultTemplate.subject);
    setFormPreheader(defaultTemplate.preheader);
    setFormFromName(profile?.name || user?.user_metadata?.full_name || "MailPilot");
    setFormFromEmail(user?.email || "newsletter@mailpilot.io");
    setFormReplyTo("");
    setFormTemplateId(null);
    setFormHtmlContent(getStarterHTML(defaultTemplate));
    setFormAudienceType("all");
    setFormSelectedListIds([]);
    setFormSelectedTagIds([]);
    setContentDesignMode("templates");
    setSendTimingMode("now");
    setScheduledDateTime("");
    setTestEmailAddress(user?.email || "");
    setTestEmailFeedback(null);
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  // Test email sending in step 4 (sends directly to logged-in user)
  const handleSendTestEmail = async () => {
    const targetEmail = (user?.email || profile?.email || testEmailAddress).trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setTestEmailFeedback({
        success: false,
        text: "Please sign in or enter a valid email address.",
      });
      return;
    }

    setIsSendingTest(true);
    setTestEmailFeedback(null);
    try {
      const res = await api.sendCampaignTestEmail({
        subject: formSubject || "Test Preview",
        htmlContent: formHtmlContent || "<p>Hello from MailPilot!</p>",
        fromName: formFromName || "MailPilot",
        targetEmail,
      });

      if (res.success) {
        setTestEmailFeedback({
          success: true,
          text: `Test email sent to ${targetEmail}! Check your inbox.`,
        });
        setToastMessage({
          type: "success",
          text: `Test email sent to ${targetEmail}`,
        });
      } else {
        setTestEmailFeedback({
          success: false,
          text: "Could not send test email. Please check your Gmail connection in Settings.",
        });
      }
    } catch (err: any) {
      setTestEmailFeedback({
        success: false,
        text: err.message || "Could not send test email. Please check your Gmail connection in Settings.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Final confirmation to launch or schedule
  const handleConfirmedSend = async () => {
    try {
      const created = await api.createCampaign({
        name: formName || "Untitled Campaign",
        subject: formSubject,
        preheader: formPreheader || null,
        fromName: formFromName,
        fromEmail: formFromEmail,
        replyTo: formReplyTo || null,
        templateId: formTemplateId || null,
        htmlContent: formHtmlContent,
        targetListIds: formAudienceType === "segmented" ? formSelectedListIds : [],
        targetTagIds: formAudienceType === "segmented" ? formSelectedTagIds : [],
        scheduledAt: sendTimingMode === "schedule" && scheduledDateTime ? new Date(scheduledDateTime).toISOString() : null,
      });

      if (sendTimingMode === "schedule" && scheduledDateTime) {
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        setShowWizardConfirmSend(false);
        setIsWizardOpen(false);
        setToastMessage({
          type: "success",
          text: `Campaign "${created.name}" scheduled for delivery!`,
        });
      } else {
        await api.sendCampaign(created.id);
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        setShowWizardConfirmSend(false);
        setIsWizardOpen(false);
        setToastMessage({
          type: "success",
          text: `Campaign "${created.name}" is now sending!`,
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to dispatch campaign",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-xs font-medium animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Campaign Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create, manage, and dispatch email campaigns to your audience.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTemplatesModalOpen(true)}
            className="flex-1 sm:flex-none justify-center text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            <span>Templates</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAICopilotOpen(true)}
            className="flex-1 sm:flex-none justify-center text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>AI Copilot</span>
          </Button>

          <Button
            size="sm"
            onClick={openCreateWizard}
            className="w-full sm:w-auto justify-center bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs font-semibold h-9 px-4 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Campaign</span>
          </Button>
        </div>
      </div>

      {/* Compact Status Filter Chips & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filters with hidden scrollbar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { id: "all", label: `All (${campaignCounts.all})` },
            { id: "DRAFT", label: `Drafts (${campaignCounts.DRAFT})` },
            { id: "SCHEDULED", label: `Scheduled (${campaignCounts.SCHEDULED})` },
            { id: "SENDING", label: `Sending (${campaignCounts.SENDING})` },
            { id: "SENT", label: `Sent (${campaignCounts.SENT})` },
            { id: "FAILED", label: `Failed (${campaignCounts.FAILED})` },
          ].map((item) => {
            const isActive = statusFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setStatusFilter(item.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Campaign Listing Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
        {isLoadingCampaigns ? (
          <>
            <TopProgressBar />
            <div className="p-4 sm:p-5 space-y-3">
              {[1, 2, 3, 4, 5].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50/60 space-x-4 animate-pulse"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div
                      className="h-3.5 rounded bg-slate-200/70"
                      style={{ width: `${60 - row * 6}%` }}
                    />
                    <div
                      className="h-2.5 rounded bg-slate-200/40"
                      style={{ width: `${80 - row * 7}%` }}
                    />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-slate-200/60 shrink-0" />
                  <div className="h-4 w-12 rounded bg-slate-200/50 shrink-0 hidden sm:block" />
                  <div className="h-6 w-16 rounded-md bg-slate-200/40 shrink-0" />
                </div>
              ))}
            </div>
          </>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No campaigns found"
            description={
              statusFilter !== "all" || debouncedSearch
                ? "No campaigns match your current filters. Try resetting the filter."
                : "You haven't created any campaigns yet. Start your first email broadcast."
            }
            actionLabel="Create Campaign"
            onAction={openCreateWizard}
          />
        ) : (
          <>
            {/* Mobile View (< md): High-density Touch Cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {campaigns.map((camp) => {
                const openRate =
                  (camp.sentCount ?? 0) > 0
                    ? (((camp.openedCount ?? 0) / (camp.sentCount ?? 1)) * 100).toFixed(1)
                    : null;

                const isPartiallySent =
                  (camp.status === "SENT" || camp.status === "FAILED") &&
                  (camp.sentCount ?? 0) > 0 &&
                  (camp.recipientCount ?? 0) > (camp.sentCount ?? 0);

                const displayStatus = isPartiallySent ? "partially_sent" : camp.status;
                const displayLabel = isPartiallySent
                  ? `Partially sent (${camp.sentCount} of ${camp.recipientCount} sent)`
                  : undefined;

                return (
                  <div
                    key={camp.id}
                    onClick={() => setDetailsCampaign(camp)}
                    className="p-4 hover:bg-slate-50/75 transition-colors cursor-pointer space-y-2.5 active:bg-slate-100/60"
                  >
                    {/* Top Row: Name and Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-slate-900 truncate">
                          {camp.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {camp.subject}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={displayStatus} label={displayLabel} />
                      </div>
                    </div>

                    {/* Middle Row: Metrics Chips */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        <Users className="h-3 w-3 text-slate-500" />
                        {(camp.recipientCount ?? 0).toLocaleString()} recipients
                      </span>

                      {(camp.status === "SENT" || (camp.sentCount ?? 0) > 0) && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-100">
                          <MailCheck className="h-3 w-3 text-emerald-600" />
                          {(camp.sentCount ?? 0).toLocaleString()} sent
                          {openRate && ` • ${openRate}% open`}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-slate-400 text-[11px] ml-auto">
                        <Calendar className="h-3 w-3" />
                        {camp.scheduledAt
                          ? new Date(camp.scheduledAt).toLocaleDateString()
                          : new Date(camp.updatedAt || camp.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Bottom Row: Quick Touch Actions */}
                    <div
                      className="flex items-center justify-end gap-1 pt-1.5 border-t border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Send if draft, failed, or cancelled */}
                      {(camp.status === "DRAFT" || camp.status === "FAILED" || camp.status === "CANCELLED") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCampaignToSend(camp)}
                          className="h-8 px-2.5 text-xs text-emerald-700 hover:bg-emerald-50 font-medium"
                          title={camp.status === "FAILED" || camp.status === "CANCELLED" ? "Retry Campaign" : "Send Campaign"}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          {camp.status === "DRAFT" ? "Send" : "Retry"}
                        </Button>
                      )}

                      {/* Cancel if scheduled or queued */}
                      {(camp.status === "SCHEDULED" || camp.status === "QUEUED") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCampaignToCancel(camp)}
                          className="h-8 px-2.5 text-xs text-amber-600 hover:bg-amber-50 font-medium"
                          title={camp.status === "QUEUED" ? "Cancel Queue" : "Cancel Schedule"}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Cancel
                        </Button>
                      )}

                      {/* Duplicate */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateCampaignMutation.mutate(camp.id)}
                        disabled={duplicateCampaignMutation.isPending}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                        title="Duplicate"
                        aria-label="Duplicate campaign"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCampaignToDelete(camp)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete"
                        aria-label="Delete campaign"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View (>= md): Full Structured Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-medium">
                  <tr>
                    <th className="py-3 px-4">Campaign</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Audience</th>
                    <th className="py-3 px-4">Performance</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((camp) => {
                    const openRate =
                      (camp.sentCount ?? 0) > 0
                        ? (((camp.openedCount ?? 0) / (camp.sentCount ?? 1)) * 100).toFixed(1)
                        : null;

                    const isPartiallySent =
                      (camp.status === "SENT" || camp.status === "FAILED") &&
                      (camp.sentCount ?? 0) > 0 &&
                      (camp.recipientCount ?? 0) > (camp.sentCount ?? 0);

                    const displayStatus = isPartiallySent ? "partially_sent" : camp.status;
                    const displayLabel = isPartiallySent
                      ? `Partially sent (${camp.sentCount} of ${camp.recipientCount} sent)`
                      : undefined;

                    return (
                      <tr
                        key={camp.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setDetailsCampaign(camp)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{camp.name}</div>
                          <div className="text-xs text-slate-500 truncate max-w-xs">{camp.subject}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={displayStatus} label={displayLabel} />
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          <span className="font-medium">
                            {(camp.recipientCount ?? 0).toLocaleString()}
                          </span>{" "}
                          recipients
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {camp.status === "SENT" || (camp.sentCount ?? 0) > 0 ? (
                            <div className="space-y-0.5">
                              <span className="font-medium text-slate-800">
                                {(camp.sentCount ?? 0).toLocaleString()} sent
                              </span>
                              {openRate && (
                                <span className="ml-2 font-semibold text-emerald-600">
                                  {openRate}% open
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {camp.scheduledAt
                            ? `Scheduled: ${new Date(camp.scheduledAt).toLocaleDateString()}`
                            : new Date(camp.updatedAt || camp.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {/* Send if draft, failed, or cancelled */}
                            {(camp.status === "DRAFT" || camp.status === "FAILED" || camp.status === "CANCELLED") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCampaignToSend(camp)}
                                className="h-8 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                                title={camp.status === "FAILED" || camp.status === "CANCELLED" ? "Retry Campaign" : "Send Campaign"}
                              >
                                <Play className="h-3.5 w-3.5 mr-1" />
                                {camp.status === "DRAFT" ? "Send" : "Retry"}
                              </Button>
                            )}

                            {/* Cancel if scheduled or queued */}
                            {(camp.status === "SCHEDULED" || camp.status === "QUEUED") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCampaignToCancel(camp)}
                                className="h-8 px-2 text-xs text-amber-600 hover:bg-amber-50"
                                title={camp.status === "QUEUED" ? "Cancel Queue" : "Cancel Schedule"}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Cancel
                              </Button>
                            )}

                            {/* Duplicate */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicateCampaignMutation.mutate(camp.id)}
                              disabled={duplicateCampaignMutation.isPending}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                              title="Duplicate"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCampaignToDelete(camp)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
            <span>
              Showing page {page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 text-xs border-slate-200"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="h-7 text-xs border-slate-200"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4-STEP CAMPAIGN CREATION WIZARD MODAL */}
      {/* ============================================================ */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl flex flex-col bg-white sm:rounded-2xl rounded-none shadow-2xl border-0 sm:border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {wizardStep === 1 && "Step 1: Who should receive this email?"}
                  {wizardStep === 2 && "Step 2: What do you want to send?"}
                  {wizardStep === 3 && "Step 3: When should it be sent?"}
                  {wizardStep === 4 && "Step 4: Review and send"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Step {wizardStep} of 4 • Draft progress is preserved automatically
                </p>
              </div>

              {/* Step Indicator Pills */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-full transition-all ${
                      step === wizardStep
                        ? "w-6 bg-indigo-600"
                        : step < wizardStep
                        ? "w-2 bg-emerald-500"
                        : "w-2 bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* STEP 1: Audience Selection */}
              {wizardStep === 1 && (
                <div className="space-y-5 max-w-2xl mx-auto">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Select your target audience
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose which contacts will receive this campaign broadcast.
                    </p>
                  </div>

                  {/* Audience Type Radio Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setFormAudienceType("all")}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        formAudienceType === "all"
                          ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">All Active Contacts</span>
                        <Users className="h-4 w-4 text-indigo-600" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Send to every subscribed subscriber in your workspace.
                      </p>
                      <div className="mt-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {contactStatsQuery.data?.active ?? 0} eligible contacts
                      </div>
                    </div>

                    <div
                      onClick={() => setFormAudienceType("segmented")}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        formAudienceType === "segmented"
                          ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Specific Lists & Tags</span>
                        <TagIcon className="h-4 w-4 text-slate-500" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Filter recipients by assigned lists or interest tags.
                      </p>
                      <div className="mt-3 text-[10px] font-medium text-slate-500">
                        {formSelectedListIds.length} lists, {formSelectedTagIds.length} tags chosen
                      </div>
                    </div>
                  </div>

                  {/* Segmented Selection Checklist */}
                  {formAudienceType === "segmented" && (
                    <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Filter by Contact Lists
                        </label>
                        {listsQuery.data?.lists && listsQuery.data.lists.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {listsQuery.data.lists.map((list) => (
                              <label
                                key={list.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={formSelectedListIds.includes(list.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormSelectedListIds([...formSelectedListIds, list.id]);
                                    } else {
                                      setFormSelectedListIds(
                                        formSelectedListIds.filter((id) => id !== list.id)
                                      );
                                    }
                                  }}
                                  className="rounded text-indigo-600"
                                />
                                <span className="truncate">{list.name}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">No contact lists created yet.</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Filter by Tags
                        </label>
                        {tagsQuery.data?.tags && tagsQuery.data.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {tagsQuery.data.tags.map((tag) => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                  if (formSelectedTagIds.includes(tag.id)) {
                                    setFormSelectedTagIds(
                                      formSelectedTagIds.filter((id) => id !== tag.id)
                                    );
                                  } else {
                                    setFormSelectedTagIds([...formSelectedTagIds, tag.id]);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                  formSelectedTagIds.includes(tag.id)
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">No tags found.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Safety & Exclusion Notice */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Deliverability protection:</strong> Unsubscribed and previously bounced contacts are automatically excluded to protect your sender reputation.
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 2: Content & Templates */}
              {wizardStep === 2 && (
                <div className="space-y-6">
                  {/* Campaign Name & Subject Header */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Campaign Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. November Product Update"
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-indigo-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Subject Line <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formSubject}
                        onChange={(e) => setFormSubject(e.target.value)}
                        placeholder="What subscribers will see in their inbox"
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-indigo-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Preheader (Preview Text)
                      </label>
                      <input
                        type="text"
                        value={formPreheader}
                        onChange={(e) => setFormPreheader(e.target.value)}
                        placeholder="Short summary displayed after subject"
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Sender Name
                      </label>
                      <input
                        type="text"
                        value={formFromName}
                        onChange={(e) => setFormFromName(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Sender Email
                      </label>
                      <input
                        type="email"
                        value={formFromEmail}
                        onChange={(e) => setFormFromEmail(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Ready-made Starter Templates Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-900">
                        Choose a Ready-Made Template or Edit Content
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAICopilotOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-medium hover:underline"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Generate with AI
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                      {STARTER_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => {
                            setFormHtmlContent(getStarterHTML(tpl));
                            setFormSubject(tpl.subject);
                            setFormPreheader(tpl.preheader);
                          }}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 text-left transition-all"
                        >
                          <div className="text-[11px] font-semibold text-slate-900 line-clamp-1">
                            {tpl.name}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase mt-0.5">
                            {tpl.category}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Desktop / Mobile Preview & HTML editing */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setContentDesignMode("templates")}
                          className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                            contentDesignMode === "templates"
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Visual Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => setContentDesignMode("html")}
                          className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                            contentDesignMode === "html"
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Edit HTML
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewMode("desktop")}
                          className={`p-1.5 rounded-md ${
                            previewMode === "desktop"
                              ? "bg-slate-100 text-indigo-600"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                          title="Desktop preview"
                        >
                          <Monitor className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewMode("mobile")}
                          className={`p-1.5 rounded-md ${
                            previewMode === "mobile"
                              ? "bg-slate-100 text-indigo-600"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                          title="Mobile preview"
                        >
                          <Smartphone className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {contentDesignMode === "html" ? (
                      <div className="p-3">
                        <textarea
                          rows={10}
                          value={formHtmlContent}
                          onChange={(e) => setFormHtmlContent(e.target.value)}
                          className="w-full font-mono text-xs rounded-lg border border-slate-200 p-3 bg-white text-slate-800 focus:outline-none focus:border-indigo-600"
                          placeholder="HTML content here..."
                        />
                      </div>
                    ) : (
                      <div className="p-4 flex justify-center">
                        <div
                          className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 ${
                            previewMode === "desktop" ? "w-[580px]" : "w-[340px]"
                          }`}
                        >
                          <iframe
                            srcDoc={formHtmlContent
                              .replace(/{{first_name}}/g, "Alex")
                              .replace(/{{company}}/g, "Acme Corp")
                              .replace(/{{email}}/g, "alex@example.com")
                              .replace(/{{unsubscribe_url}}/g, "#")}
                            title="Email Preview"
                            className="w-full h-72 border-0"
                            sandbox="allow-same-origin"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Timing (Send Now vs Schedule) */}
              {wizardStep === 3 && (
                <div className="space-y-6 max-w-xl mx-auto">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      When should this campaign be sent?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dispatch immediately or pick a scheduled future date.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setSendTimingMode("now")}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        sendTimingMode === "now"
                          ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Send Now</span>
                        <Send className="h-4 w-4 text-indigo-600" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Dispatches immediately to your audience after review.
                      </p>
                    </div>

                    <div
                      onClick={() => setSendTimingMode("schedule")}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        sendTimingMode === "schedule"
                          ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Schedule for Later</span>
                        <Calendar className="h-4 w-4 text-indigo-600" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Set a specific date and time for automated dispatch.
                      </p>
                    </div>
                  </div>

                  {sendTimingMode === "schedule" && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        Select Send Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:border-indigo-600"
                      />
                      <p className="text-[11px] text-slate-500">
                        Will be automatically queued and synced with Google Calendar if connected.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Review and Send */}
              {wizardStep === 4 && (
                <div className="space-y-6 max-w-2xl mx-auto">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Review Campaign Details
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Verify your campaign details and send a test email before launching.
                    </p>
                  </div>

                  {/* Summary Checklist Cards */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-500">Campaign Name</span>
                      <div className="font-semibold text-slate-900">{formName || "Untitled"}</div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-500">Subject Line</span>
                      <div className="font-semibold text-slate-900">{formSubject}</div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-500">Audience</span>
                      <div className="font-semibold text-slate-900">
                        {formAudienceType === "all"
                          ? `All Contacts (${contactStatsQuery.data?.active ?? 0} active)`
                          : `Selected segments`}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-500">Send Timing</span>
                      <div className="font-semibold text-indigo-700">
                        {sendTimingMode === "now"
                          ? "Send immediately"
                          : `Scheduled: ${new Date(scheduledDateTime).toLocaleString()}`}
                      </div>
                    </div>
                  </div>

                  {/* Email Preview with Real Contact Data */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-700">Email Preview</span>
                      <span className="text-[11px] text-slate-500">
                        Filled in for contact:{" "}
                        <strong className="text-slate-800">
                          {sampleData.firstName} {sampleData.lastName}
                        </strong>{" "}
                        ({sampleData.company || "No company"})
                      </span>
                    </div>

                    <div className="p-4 space-y-3 text-xs">
                      <div className="space-y-1 pb-3 border-b border-slate-100">
                        <div className="text-slate-800 font-medium">
                          <span className="text-slate-400 font-normal">Subject: </span>
                          {interpolatePreview(formSubject || "Untitled Subject", sampleData)}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          <span>From: </span>
                          <strong className="text-slate-700">{formFromName || "MailPilot"}</strong>
                          {" • "}
                          <span>To: </span>
                          <span className="text-slate-700 font-mono text-[10px]">
                            {sampleData.firstName} &lt;{sampleData.email}&gt;
                          </span>
                        </div>
                      </div>

                      {/* Rendered HTML content with personalized data */}
                      <div
                        className="prose prose-xs max-w-none text-slate-800 min-h-[140px] max-h-[300px] overflow-y-auto bg-slate-50/50 p-4 rounded-lg border border-slate-100"
                        dangerouslySetInnerHTML={{
                          __html: interpolatePreview(
                            formHtmlContent || "<p>Email content goes here...</p>",
                            sampleData
                          ),
                        }}
                      />

                      {/* Compliant Unsubscribe Link Preview */}
                      <div className="text-[11px] text-slate-400 text-center pt-2 border-t border-slate-100">
                        <span className="underline cursor-default">Unsubscribe</span> • Sent with MailPilot
                      </div>
                    </div>
                  </div>

                  {/* Send Test Email to Logged-in User */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Send test email</h4>
                        <p className="text-[11px] text-slate-500">
                          Sends a real test email to your account (
                          <strong className="text-slate-700">
                            {user?.email || profile?.email || "your email"}
                          </strong>
                          ).
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSendTestEmail}
                        disabled={isSendingTest}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium shrink-0"
                      >
                        {isSendingTest ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Mail className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Send test email
                      </Button>
                    </div>

                    {testEmailFeedback && (
                      <div
                        className={`text-xs p-2.5 rounded-lg font-medium ${
                          testEmailFeedback.success
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {testEmailFeedback.text}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/75">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (wizardStep > 1) {
                    setWizardStep((s) => (s - 1) as any);
                  } else {
                    setIsWizardOpen(false);
                  }
                }}
                className="text-xs border-slate-200"
              >
                {wizardStep === 1 ? "Cancel" : "Back"}
              </Button>

              <div className="flex items-center gap-2">
                {wizardStep < 4 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (wizardStep === 2 && (!formName.trim() || !formSubject.trim())) {
                        setToastMessage({
                          type: "error",
                          text: "Please provide both a Campaign Name and Email Subject Line.",
                        });
                        return;
                      }
                      setWizardStep((s) => (s + 1) as any);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4"
                  >
                    Continue &rarr;
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setShowWizardConfirmSend(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4"
                  >
                    {sendTimingMode === "now" ? "Confirm & Send Campaign" : "Confirm & Schedule"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Dialog before sending */}
      {showWizardConfirmSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              {sendTimingMode === "now" ? "Send Campaign" : "Schedule Campaign"}
            </h3>
            <p className="text-xs text-slate-600">
              {sendTimingMode === "now"
                ? `You are about to send "${formName || "Untitled Campaign"}" to ${
                    formAudienceType === "all"
                      ? `${(contactStatsQuery.data?.active ?? 0)} ${(contactStatsQuery.data?.active ?? 0) === 1 ? "contact" : "contacts"}`
                      : "the selected contacts"
                  }. Send now?`
                : `You are about to schedule "${formName || "Untitled Campaign"}" for ${new Date(scheduledDateTime).toLocaleString()}.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWizardConfirmSend(false)}
                className="text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmedSend}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {sendTimingMode === "now" ? "Send now" : "Confirm Schedule"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Send Immediately Confirmation Modal from table action */}
      {campaignToSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Send Campaign</h3>
            <p className="text-xs text-slate-600">
              You are about to send "{campaignToSend.name}" to {campaignToSend.recipientCount ?? 0} {(campaignToSend.recipientCount ?? 0) === 1 ? "contact" : "contacts"}. Send now?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignToSend(null)}
                className="text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => sendCampaignMutation.mutate(campaignToSend.id)}
                disabled={sendCampaignMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {sendCampaignMutation.isPending ? "Sending..." : "Send now"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Scheduled Campaign Modal from table action */}
      {campaignToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              {campaignToCancel.status === "QUEUED" ? "Cancel Campaign" : "Cancel Schedule"}
            </h3>
            <p className="text-xs text-slate-600">
              {campaignToCancel.status === "QUEUED"
                ? `Cancel sending "${campaignToCancel.name}"? It will revert back to a draft.`
                : `Cancel the scheduled send for "${campaignToCancel.name}"? It will revert back to a draft.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignToCancel(null)}
                className="text-xs border-slate-200"
              >
                Keep Scheduled
              </Button>
              <Button
                size="sm"
                onClick={() => cancelCampaignMutation.mutate(campaignToCancel.id)}
                disabled={cancelCampaignMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                {cancelCampaignMutation.isPending ? "Cancelling..." : "Cancel Schedule"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Details Drawer */}
      {detailsCampaign && (() => {
        const detailsIsPartiallySent =
          (detailsCampaign.status === "SENT" || detailsCampaign.status === "FAILED") &&
          (detailsCampaign.sentCount ?? 0) > 0 &&
          (detailsCampaign.recipientCount ?? 0) > (detailsCampaign.sentCount ?? 0);

        const detailsDisplayStatus = detailsIsPartiallySent ? "partially_sent" : detailsCampaign.status;
        const detailsDisplayLabel = detailsIsPartiallySent
          ? `Partially sent (${detailsCampaign.sentCount} of ${detailsCampaign.recipientCount} sent)`
          : undefined;

        return (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setDetailsCampaign(null)}
          >
            <div
              className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col p-5 sm:p-6 space-y-5 animate-in slide-in-from-right duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{detailsCampaign.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{detailsCampaign.subject}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsCampaign(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Close details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  <StatusBadge status={detailsDisplayStatus} label={detailsDisplayLabel} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Audience</span>
                  <span className="font-semibold text-slate-800">
                    {(detailsCampaign.recipientCount ?? 0).toLocaleString()} recipients
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Sent Count</span>
                  <span className="font-semibold text-slate-800">
                    {(detailsCampaign.sentCount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Unique Opens</span>
                  <span className="font-semibold text-emerald-600">
                    {(detailsCampaign.openedCount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Link Clicks</span>
                  <span className="font-semibold text-indigo-600">
                    {(detailsCampaign.clickedCount ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Recipient Delivery Breakdown & Failure Details */}
              <div className="pt-3 border-t border-slate-100 flex-1 min-h-0 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Recipients & Delivery Status</span>
                  <span className="text-[11px] text-slate-400">
                    {campaignRecipientsQuery.data?.pagination?.total ?? 0} total
                  </span>
                </div>

                {campaignRecipientsQuery.isLoading ? (
                  <div className="text-xs text-slate-400 py-4 text-center">Loading recipient logs...</div>
                ) : (campaignRecipientsQuery.data?.items?.length ?? 0) === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">No recipient logs recorded yet.</div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 max-h-56">
                    {campaignRecipientsQuery.data?.items.map((r) => (
                      <div key={r.id} className="pt-2 flex items-start justify-between text-xs gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-800 truncate">{r.email}</div>
                          {r.errorMessage ? (
                            <div className="text-rose-600 text-[11px] mt-0.5 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 break-words">
                              {r.errorMessage.includes("smtp.gmail.com") || r.errorMessage.includes("SMTP host")
                                ? "Could not connect to Gmail. Cloud free hosting (like Render Free) blocks outbound email ports."
                                : r.errorMessage}
                            </div>
                          ) : r.status === "SENT" ? (
                            <div className="text-slate-400 text-[10px] mt-0.5">
                              Delivered successfully
                            </div>
                          ) : null}
                        </div>
                        <StatusBadge status={r.status} className="shrink-0 text-[10px]" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await api.sendCampaignTestEmail({
                        campaignId: detailsCampaign.id,
                        targetEmail: user?.email,
                      });
                      setToastMessage({
                        type: "success",
                        text: `Test email sent to ${user?.email}`,
                      });
                    } catch (err: any) {
                      setToastMessage({
                        type: "error",
                        text: err.message || "Could not send test email.",
                      });
                    }
                  }}
                  className="text-xs border-slate-200"
                >
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  Send test email
                </Button>
                {detailsCampaign.status === "FAILED" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const toSend = detailsCampaign;
                      setDetailsCampaign(null);
                      setCampaignToSend(toSend);
                    }}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Retry Campaign
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailsCampaign(null)}
                  className="text-xs border-slate-200"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Templates Drawer / Modal */}
      {isTemplatesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => setIsTemplatesModalOpen(false)}
        >
          <div
            className="w-full max-w-5xl h-full sm:h-[85vh] flex flex-col bg-white sm:rounded-2xl rounded-none shadow-2xl border-0 sm:border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Email Templates</h3>
                <p className="text-xs text-slate-500">Browse ready-made email layouts or create your own.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplatesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close templates"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <TemplatesPage
                hideHeader={true}
                onUseInCampaign={(tpl) => {
                  setIsTemplatesModalOpen(false);
                  openCreateWizard();
                  setFormHtmlContent(tpl.htmlContent);
                  if (tpl.subject) setFormSubject(tpl.subject);
                  if (tpl.preheader) setFormPreheader(tpl.preheader);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation Modal */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Delete Campaign</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete "{campaignToDelete.name}"? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignToDelete(null)}
                className="text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => deleteCampaignMutation.mutate(campaignToDelete.id)}
                disabled={deleteCampaignMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
              >
                {deleteCampaignMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Copilot Modal */}
      <AICopilotModal
        isOpen={isAICopilotOpen}
        onClose={() => setIsAICopilotOpen(false)}
        currentSubject={formSubject}
        currentPreheader={formPreheader}
        currentHtmlContent={formHtmlContent}
        onApplySubject={(subj: string) => setFormSubject(subj)}
        onApplyPreheader={(pre: string) => setFormPreheader(pre)}
        onApplyHtmlContent={(html: string) => setFormHtmlContent(html)}
      />
    </div>
  );
}
