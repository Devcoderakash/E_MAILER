import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Plus,
  Eye,
  Copy,
  Trash2,
  RefreshCw,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  ChevronRight,
  ChevronLeft,
  Users,
  Tag as TagIcon,
  Folder,
  Loader2,
  AlertTriangle,
  Play,
  RotateCcw,
  Calendar,
  Sparkles,
} from "lucide-react";
import { AICopilotModal } from "@/features/campaigns/ai-copilot-modal";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  SearchInput,
} from "@/components/common";
import type {
  Campaign,
  CampaignRecipient,
  CampaignStats,
  CampaignValidationResponse,
} from "@/types";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/features/auth/use-auth-store";

export function CampaignsPage() {
  const queryClient = useQueryClient();
  const { activeWorkspace, profile } = useAuthStore();

  // Filter & Search State
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

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
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [detailsCampaign, setDetailsCampaign] = useState<Campaign | null>(null);
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<string>("all");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientPage, setRecipientPage] = useState(1);

  // Form State for Campaign Creation
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
  const [formProvider, setFormProvider] = useState<"BREVO" | "RESEND">("BREVO");

  // Validation result for wizard
  const [wizardValidation, setWizardValidation] = useState<CampaignValidationResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Confirmation modals
  const [campaignToSend, setCampaignToSend] = useState<Campaign | null>(null);
  const [campaignToCancel, setCampaignToCancel] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  // 1. Fetch campaigns with auto-polling if any are sending or queued
  const campaignsQuery = useQuery({
    queryKey: [
      "campaigns",
      activeWorkspace?.id,
      page,
      selectedFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      api.getCampaigns({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: selectedFilter !== "all" ? selectedFilter : undefined,
      }),
    enabled: !!activeWorkspace?.id,
    refetchInterval: (query) => {
      const hasActiveJobs = query.state.data?.items?.some(
        (c) => c.status === "SENDING" || c.status === "QUEUED"
      );
      return hasActiveJobs ? 3000 : false;
    },
  });

  const campaigns = campaignsQuery.data?.items || [];
  const pagination = campaignsQuery.data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  // 2. Fetch Templates for Picker
  const templatesQuery = useQuery({
    queryKey: ["templates", activeWorkspace?.id],
    queryFn: () => api.getTemplates({ limit: 100 }),
    enabled: isWizardOpen && !!activeWorkspace?.id,
  });

  // 3. Fetch Contact Lists & Tags for Audience Selector
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

  // 4. Fetch Stats & Recipients for Selected Details Campaign
  const campaignStatsQuery = useQuery<CampaignStats>({
    queryKey: ["campaign-stats", activeWorkspace?.id, detailsCampaign?.id],
    queryFn: () => api.getCampaignStats(detailsCampaign!.id),
    enabled: !!detailsCampaign?.id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "SENDING" || status === "QUEUED" ? 2500 : false;
    },
  });

  const recipientsQuery = useQuery({
    queryKey: [
      "campaign-recipients",
      activeWorkspace?.id,
      detailsCampaign?.id,
      recipientPage,
      recipientStatusFilter,
      recipientSearch,
    ],
    queryFn: () =>
      api.getCampaignRecipients(detailsCampaign!.id, {
        page: recipientPage,
        limit: 15,
        status: recipientStatusFilter !== "all" ? recipientStatusFilter : undefined,
        search: recipientSearch || undefined,
      }),
    enabled: !!detailsCampaign?.id,
    refetchInterval: () => {
      const status = campaignStatsQuery.data?.status;
      return status === "SENDING" || status === "QUEUED" ? 3000 : false;
    },
  });

  // Initialize wizard defaults when opening
  const openCreateWizard = () => {
    setWizardStep(1);
    setFormName("");
    setFormSubject("");
    setFormPreheader("");
    setFormFromName(profile?.name || activeWorkspace?.name || "MailPilot Team");
    setFormFromEmail(profile?.email || "notifications@mailpilot.io");
    setFormReplyTo("");
    setFormTemplateId(null);
    setFormHtmlContent(
      `<div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
        <h1 style="color: #4f46e5;">Hello {{first_name}}!</h1>
        <p>We are delighted to share our latest updates from {{company}}.</p>
        <p>Explore your dashboard to see what is new today.</p>
      </div>`
    );
    setFormAudienceType("all");
    setFormSelectedListIds([]);
    setFormSelectedTagIds([]);
    const defaultProv = activeWorkspace?.defaultEmailProvider?.toUpperCase() === "RESEND" ? "RESEND" : "BREVO";
    setFormProvider(defaultProv);
    setWizardValidation(null);
    setIsWizardOpen(true);
  };

  // Mutations
  const createCampaignMutation = useMutation({
    mutationFn: (data: {
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
    }) => api.createCampaign(data),
    onSuccess: (newCamp) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setIsWizardOpen(false);
      setToastMessage({
        type: "success",
        text: `Campaign "${newCamp.name}" saved as draft!`,
      });
    },
    onError: (err: any) => {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to create campaign",
      });
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => api.sendCampaign(campaignId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-stats", activeWorkspace?.id, updated.id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-recipients", activeWorkspace?.id, updated.id] });
      setCampaignToSend(null);
      if (detailsCampaign?.id === updated.id) {
        setDetailsCampaign(updated);
      }
      setToastMessage({
        type: "success",
        text: `Campaign "${updated.name}" enqueued for sending!`,
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
      queryClient.invalidateQueries({ queryKey: ["campaign-stats", activeWorkspace?.id, updated.id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-recipients", activeWorkspace?.id, updated.id] });
      setCampaignToCancel(null);
      if (detailsCampaign?.id === updated.id) {
        setDetailsCampaign(updated);
      }
      setToastMessage({
        type: "success",
        text: `Campaign "${updated.name}" cancelled successfully.`,
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
        text: `Duplicated into "${duplicated.name}".`,
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
      if (detailsCampaign) setDetailsCampaign(null);
      setToastMessage({
        type: "success",
        text: "Campaign deleted successfully.",
      });
    },
    onError: (err: any) => {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to delete campaign",
      });
    },
  });

  // Handle Step 4 Validation check
  const handleRunValidation = async () => {
    setIsValidating(true);
    try {
      // First save draft if not saved or validate temporary draft
      const tempCamp = await api.createCampaign({
        name: formName || "Campaign In Validation",
        subject: formSubject || "Draft Subject",
        preheader: formPreheader || null,
        fromName: formFromName || "MailPilot",
        fromEmail: formFromEmail || "sender@mailpilot.io",
        replyTo: formReplyTo || null,
        templateId: formTemplateId || null,
        htmlContent: formHtmlContent,
        targetListIds: formAudienceType === "segmented" ? formSelectedListIds : [],
        targetTagIds: formAudienceType === "segmented" ? formSelectedTagIds : [],
        provider: formProvider,
      });

      const validationRes = await api.validateCampaign(tempCamp.id);
      setWizardValidation(validationRes);

      // Clean up temporary draft after validation check
      await api.deleteCampaign(tempCamp.id);
    } catch (err: any) {
      setWizardValidation({
        canSend: false,
        errors: [err.message || "Failed to complete validation"],
        checklist: {
          hasSubject: !!formSubject.trim(),
          hasFromEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formFromEmail),
          hasFromName: !!formFromName.trim(),
          hasContent: !!formHtmlContent.trim(),
          hasAudience: false,
        },
        audienceSummary: {
          totalEligibleActive: 0,
          excludedUnsubscribed: 0,
          excludedBounced: 0,
        },
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Complete Wizard and Send Immediately
  const handleWizardSendImmediately = async () => {
    try {
      const created = await api.createCampaign({
        name: formName,
        subject: formSubject,
        preheader: formPreheader || null,
        fromName: formFromName,
        fromEmail: formFromEmail,
        replyTo: formReplyTo || null,
        templateId: formTemplateId || null,
        htmlContent: formHtmlContent,
        targetListIds: formAudienceType === "segmented" ? formSelectedListIds : [],
        targetTagIds: formAudienceType === "segmented" ? formSelectedTagIds : [],
        provider: formProvider,
      });

      await api.sendCampaign(created.id);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setIsWizardOpen(false);
      setToastMessage({
        type: "success",
        text: `Campaign "${created.name}" queued and dispatching!`,
      });
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to dispatch campaign",
      });
    }
  };

  // Metrics summary
  const totalCampaigns = campaigns.length;
  const totalSentEmails = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const totalDeliveredEmails = campaigns.reduce((acc, c) => acc + (c.deliveredCount || 0), 0);
  const activeInFlight = campaigns.filter(
    (c) => c.status === "SENDING" || c.status === "QUEUED"
  ).length;
  const averageDeliveryRate =
    totalSentEmails > 0
      ? Math.round((totalDeliveredEmails / totalSentEmails) * 100)
      : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm font-medium shadow-md transition-all ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Campaign Manager"
        description="Design, target, validate, and dispatch high-deliverability broadcast campaigns via Resend & BullMQ."
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {totalCampaigns} Campaigns
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["campaigns"] })}
              className="h-9 px-3 gap-1.5 text-xs text-slate-600 hover:text-slate-900 border-slate-200 shadow-2xs"
              title="Refresh Campaigns"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  campaignsQuery.isFetching ? "animate-spin text-indigo-600" : ""
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAICopilotOpen(true)}
              className="h-9 px-3 gap-1.5 text-xs text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 border-indigo-200/80 shadow-2xs font-medium"
              title="Launch AI Campaign Copilot"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>AI Copilot</span>
            </Button>
            <Button
              onClick={openCreateWizard}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs gap-1.5 text-xs sm:text-sm font-medium h-9 px-4"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </div>
        }
      />

      {/* Top Aggregate Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Broadcasts</span>
            <Mail className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {totalCampaigns}
          </div>
          <div className="mt-1 text-xs text-slate-400">All campaigns in workspace</div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Delivered</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">
            {totalDeliveredEmails.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Confirmed via webhooks ({totalSentEmails.toLocaleString()} sent)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active In-Flight</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-700 flex items-center gap-2">
            <span>{activeInFlight}</span>
            {activeInFlight > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-400">Queued or actively dispatching</div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Delivery Rate</span>
            <Check className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {averageDeliveryRate}%
          </div>
          <div className="mt-1 text-xs text-slate-400">Confirmed deliveries / total sent</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-2xs overflow-x-auto">
          {[
            { id: "all", label: "All" },
            { id: "draft", label: "Draft" },
            { id: "queued", label: "Queued" },
            { id: "sending", label: "Sending" },
            { id: "sent", label: "Sent" },
            { id: "scheduled", label: "Scheduled" },
            { id: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedFilter(tab.id);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1 font-medium transition-colors whitespace-nowrap ${
                selectedFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Search campaigns..."
          />
        </div>
      </div>

      {/* Campaigns Table / List */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {campaignsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="text-sm">Loading campaigns...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={debouncedSearch || selectedFilter !== "all" ? "No matching campaigns" : "No campaigns yet"}
            description={
              debouncedSearch || selectedFilter !== "all"
                ? "Try adjusting your search criteria or filter to locate campaigns."
                : "Create your first email campaign to begin engaging your audience subscribers."
            }
            actionLabel="Create Campaign"
            onAction={openCreateWizard}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Audience</th>
                  <th className="py-3 px-4">Recipients</th>
                  <th className="py-3 px-4">Progress / Sent</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((camp) => {
                  const progress =
                    camp.recipientCount > 0
                      ? Math.round(
                          (((camp.sentCount || 0) + (camp.failedCount || 0)) /
                            camp.recipientCount) *
                            100
                        )
                      : 0;

                  return (
                    <tr
                      key={camp.id}
                      className="hover:bg-slate-50/75 transition-colors cursor-pointer group"
                      onClick={() => setDetailsCampaign(camp)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-xs sm:max-w-md">
                          <div className="font-semibold text-slate-900 truncate flex items-center gap-2">
                            <span>{camp.name}</span>
                            {camp.provider && (
                              <span
                                className={`text-[10px] font-medium rounded px-1.5 py-0.2 border ${
                                  camp.provider === "BREVO"
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : "text-amber-700 bg-amber-50 border-amber-200"
                                }`}
                              >
                                {camp.provider}
                              </span>
                            )}
                            {camp.template && (
                              <span className="text-[10px] font-normal text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.2">
                                {camp.template.name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{camp.subject}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={camp.status} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {camp.targetListIds && camp.targetListIds.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <Folder className="h-3 w-3 text-slate-400" />
                            {camp.targetListIds.length} {camp.targetListIds.length === 1 ? "List" : "Lists"}
                          </span>
                        ) : camp.targetTagIds && camp.targetTagIds.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <TagIcon className="h-3 w-3 text-slate-400" />
                            {camp.targetTagIds.length} {camp.targetTagIds.length === 1 ? "Tag" : "Tags"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            All Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-700">
                        {camp.recipientCount > 0 ? camp.recipientCount.toLocaleString() : "—"}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {camp.status === "SENT" ? (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                              <span className="text-emerald-600 font-semibold">{camp.deliveredCount || 0} delivered</span>
                              <span className="text-slate-400 text-[11px]">({camp.sentCount || 0} sent)</span>
                            </div>
                            <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${
                                    (camp.sentCount || 0) > 0
                                      ? Math.min(100, Math.round(((camp.deliveredCount || 0) / (camp.sentCount || 1)) * 100))
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : camp.status === "SENDING" || camp.status === "QUEUED" ? (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-indigo-600 flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>{progress}% ({camp.sentCount}/{camp.recipientCount})</span>
                            </div>
                            <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(camp.createdAt).toLocaleDateString()}
                      </td>
                      <td
                        className="py-3.5 px-4 whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailsCampaign(camp)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                            title="View delivery details & recipient logs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {camp.status === "DRAFT" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCampaignToSend(camp)}
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title="Send campaign now"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {(camp.status === "QUEUED" || camp.status === "SENDING") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCampaignToCancel(camp)}
                              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Cancel campaign"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {camp.status === "SCHEDULED" && (
                            <a
                              href="/schedule"
                              className="h-8 w-8 inline-flex items-center justify-center rounded p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              title="Manage in Schedule Center"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                            </a>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateCampaignMutation.mutate(camp.id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                            title="Duplicate"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>

                          {(camp.status === "DRAFT" || camp.status === "CANCELLED" || camp.status === "FAILED") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCampaignToDelete(camp)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              Showing <span className="font-medium">{campaigns.length}</span> of{" "}
              <span className="font-medium">{pagination.total}</span> campaigns
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <span className="text-xs text-slate-600 px-2">
                Page {page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="h-7 px-2 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 5-STEP CAMPAIGN CREATION WIZARD MODAL */}
      {/* ============================================================ */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden my-8">
            {/* Wizard Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Create New Campaign</h3>
                <p className="text-xs text-slate-500">
                  Step {wizardStep} of 5:{" "}
                  {wizardStep === 1 && "Campaign Details & Sender"}
                  {wizardStep === 2 && "Email Template & Content"}
                  {wizardStep === 3 && "Audience Targeting & Safety"}
                  {wizardStep === 4 && "Pre-Flight Validation"}
                  {wizardStep === 5 && "Review & Dispatch"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-5 border-b border-slate-100 text-center text-xs">
              {[
                { step: 1, title: "1. Details" },
                { step: 2, title: "2. Content" },
                { step: 3, title: "3. Audience" },
                { step: 4, title: "4. Validate" },
                { step: 5, title: "5. Send" },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`py-2.5 font-medium border-b-2 transition-all ${
                    wizardStep === s.step
                      ? "border-indigo-600 text-indigo-600 bg-indigo-50/30 font-semibold"
                      : wizardStep > s.step
                      ? "border-emerald-500 text-emerald-700 bg-emerald-50/30"
                      : "border-transparent text-slate-400"
                  }`}
                >
                  {s.title}
                </div>
              ))}
            </div>

            {/* Wizard Body */}
            <div className="p-6 max-h-[65vh] overflow-y-auto">
              {/* STEP 1: Details */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Campaign Internal Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. June Product Launch 2026"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Internal reference only. Not visible to email recipients.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-700">
                        Subject Line <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAICopilotOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        <Sparkles className="h-3 w-3 text-indigo-500" />
                        AI Copilot Suggestions
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      placeholder="e.g. Exclusive product announcement for {{first_name}}"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Supports merge variables:{" "}
                      <code className="text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">
                        {"{{first_name}}"}
                      </code>
                      ,{" "}
                      <code className="text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">
                        {"{{company}}"}
                      </code>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Preheader Text (Optional)
                    </label>
                    <input
                      type="text"
                      value={formPreheader}
                      onChange={(e) => setFormPreheader(e.target.value)}
                      placeholder="Preview snippet shown next to the subject in inbox..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        From Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formFromName}
                        onChange={(e) => setFormFromName(e.target.value)}
                        placeholder="e.g. MailPilot Team"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        From Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formFromEmail}
                        onChange={(e) => setFormFromEmail(e.target.value)}
                        placeholder="e.g. team@mailpilot.io"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Delivery Provider Selection */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Email Delivery Provider <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => setFormProvider("BREVO")}
                        className={`cursor-pointer rounded-lg border p-3 transition-all ${
                          formProvider === "BREVO"
                            ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-slate-900">Brevo (Recommended)</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium">
                            Personal Email OK
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Supports sending from verified @gmail.com or business addresses without custom DNS setup.
                        </p>
                      </div>

                      <div
                        onClick={() => setFormProvider("RESEND")}
                        className={`cursor-pointer rounded-lg border p-3 transition-all ${
                          formProvider === "RESEND"
                            ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-slate-900">Resend</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium">
                            Domain Required
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Requires a verified custom company domain. Rejects personal webmail (@gmail.com).
                        </p>
                      </div>
                    </div>

                    {/* Resend Personal Email Warning */}
                    {formProvider === "RESEND" && /@(gmail|yahoo|hotmail|outlook|icloud)\.com$/i.test(formFromEmail.trim()) && (
                      <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Warning: Resend requires a custom domain.</strong> Sending with a personal email address ({formFromEmail}) will be rejected by Resend. Switch provider to <strong>Brevo</strong> or configure your verified custom domain.
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Reply-To Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={formReplyTo}
                      onChange={(e) => setFormReplyTo(e.target.value)}
                      placeholder="e.g. support@mailpilot.io"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Content & Templates */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Choose an Email Template (or use custom HTML)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {templatesQuery.data?.templates?.map((tpl) => (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            setFormTemplateId(tpl.id);
                            setFormHtmlContent(tpl.htmlContent);
                            if (tpl.subject && !formSubject) setFormSubject(tpl.subject);
                            if (tpl.preheader && !formPreheader) setFormPreheader(tpl.preheader);
                          }}
                          className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                            formTemplateId === tpl.id
                              ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="font-medium text-xs text-slate-900 truncate">
                            {tpl.name}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                            {tpl.category}
                          </div>
                          <div className="mt-2 text-[11px] text-slate-600 line-clamp-2">
                            {tpl.description || "Saved template"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Campaign HTML Snapshot
                    </label>
                    <textarea
                      rows={8}
                      value={formHtmlContent}
                      onChange={(e) => setFormHtmlContent(e.target.value)}
                      className="w-full font-mono text-xs rounded-lg border border-slate-200 p-3 text-slate-800 bg-slate-50 focus:border-indigo-500 focus:outline-hidden focus:bg-white"
                      placeholder="<html>...</html>"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Snapshotted HTML will be delivered to recipients with merge tags interpolated.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3: Audience */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Target Audience
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setFormAudienceType("all")}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          formAudienceType === "all"
                            ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-indigo-600" />
                          <span>All Active Contacts</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Dispatches to all active contacts in this workspace.
                        </p>
                      </div>

                      <div
                        onClick={() => setFormAudienceType("segmented")}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          formAudienceType === "segmented"
                            ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                          <TagIcon className="h-4 w-4 text-indigo-600" />
                          <span>Specific Lists & Tags</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Target subscribers in specific contact lists or tags.
                        </p>
                      </div>
                    </div>
                  </div>

                  {formAudienceType === "segmented" && (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      {/* Contact Lists Selection */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-2">
                          Select Contact Lists ({listsQuery.data?.lists?.length || 0} available)
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                          {listsQuery.data?.lists?.map((list) => {
                            const isSelected = formSelectedListIds.includes(list.id);
                            return (
                              <div
                                key={list.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setFormSelectedListIds(
                                      formSelectedListIds.filter((id) => id !== list.id)
                                    );
                                  } else {
                                    setFormSelectedListIds([...formSelectedListIds, list.id]);
                                  }
                                }}
                                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer ${
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-50/50 font-medium text-indigo-900"
                                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{list.name}</span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {list.memberCount ?? 0}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Contact Tags Selection */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-2">
                          Select Contact Tags ({tagsQuery.data?.tags?.length || 0} available)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {tagsQuery.data?.tags?.map((tag) => {
                            const isSelected = formSelectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setFormSelectedTagIds(
                                      formSelectedTagIds.filter((id) => id !== tag.id)
                                    );
                                  } else {
                                    setFormSelectedTagIds([...formSelectedTagIds, tag.id]);
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors ${
                                  isSelected
                                    ? "bg-indigo-600 text-white font-medium shadow-2xs"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                <TagIcon className="h-3 w-3" />
                                <span>{tag.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Safety Invariant Notice */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">Audience Safety Guarantee</div>
                        <p className="mt-1 text-amber-800 leading-relaxed">
                          MailPilot strictly isolates your audience. Only contacts with{" "}
                          <span className="font-semibold underline">ACTIVE</span> status are
                          eligible for broadcast. Any contact marked{" "}
                          <span className="font-semibold">UNSUBSCRIBED</span> or{" "}
                          <span className="font-semibold">BOUNCED</span> is permanently excluded by
                          the dispatch engine.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Pre-Flight Validation */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-slate-900">
                        Pre-Flight Readiness Check
                      </h4>
                      <p className="text-xs text-slate-500">
                        Verifies campaign attributes, audience sizing, and unsubscribed contact exclusions.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunValidation}
                      disabled={isValidating}
                      className="h-8 text-xs gap-1.5"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Run Check</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {wizardValidation ? (
                    <div className="space-y-3">
                      {/* Overall Status Banner */}
                      <div
                        className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
                          wizardValidation.canSend
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {wizardValidation.canSend ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-rose-600" />
                          )}
                          <span className="font-semibold">
                            {wizardValidation.canSend
                              ? "Ready to Send: All validation criteria passed!"
                              : "Validation Issues Found"}
                          </span>
                        </div>
                        {wizardValidation.canSend && (
                          <span className="font-mono text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                            {wizardValidation.audienceSummary.totalEligibleActive} Active Recipients
                          </span>
                        )}
                      </div>

                      {/* Error Messages List if invalid */}
                      {!wizardValidation.canSend && wizardValidation.errors.length > 0 && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3.5 space-y-1.5 text-xs text-rose-800">
                          <div className="font-semibold text-rose-900 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                            <span>Action Required Before Sending:</span>
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-700">
                            {wizardValidation.errors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Checklist Breakdown */}
                      <div className="rounded-lg border border-slate-200 p-4 space-y-2 bg-slate-50/50 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Subject line defined</span>
                          {wizardValidation.checklist.hasSubject ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                              <Check className="h-3.5 w-3.5" /> OK
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1 font-medium">
                              <X className="h-3.5 w-3.5" /> Missing
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Valid Sender Email</span>
                          {wizardValidation.checklist.hasFromEmail ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                              <Check className="h-3.5 w-3.5" /> OK
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1 font-medium">
                              <X className="h-3.5 w-3.5" /> Invalid
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Sender Domain Authorization</span>
                          {wizardValidation.checklist.hasValidSenderDomain !== false ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                              <Check className="h-3.5 w-3.5" /> Verified Domain / Resend Dev
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1 font-medium">
                              <X className="h-3.5 w-3.5" /> Restricted (Personal Webmail)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Email Delivery Provider</span>
                          {wizardValidation.checklist.hasValidProvider !== false ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                              <Check className="h-3.5 w-3.5" /> Configured (Resend)
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1 font-medium">
                              <X className="h-3.5 w-3.5" /> Missing RESEND_API_KEY (.env)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Sender Name provided</span>
                          {wizardValidation.checklist.hasFromName ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                              <Check className="h-3.5 w-3.5" /> OK
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1 font-medium">
                              <X className="h-3.5 w-3.5" /> Missing
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Email HTML Content</span>
                          {wizardValidation.checklist.hasContent ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                              <Check className="h-3.5 w-3.5" /> OK
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1 font-medium">
                              <X className="h-3.5 w-3.5" /> Missing
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Active Audience Recipients</span>
                          {wizardValidation.checklist.hasAudience ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                              <Check className="h-3.5 w-3.5" />{" "}
                              {wizardValidation.audienceSummary.totalEligibleActive} Contacts
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1 font-medium">
                              <X className="h-3.5 w-3.5" /> 0 Active Contacts
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Excluded Breakdown */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg border border-slate-200 bg-white">
                          <span className="text-slate-500">Excluded Unsubscribed:</span>
                          <div className="font-semibold text-slate-800 text-sm mt-0.5">
                            {wizardValidation.audienceSummary.excludedUnsubscribed} contacts
                          </div>
                        </div>
                        <div className="p-3 rounded-lg border border-slate-200 bg-white">
                          <span className="text-slate-500">Excluded Bounced:</span>
                          <div className="font-semibold text-slate-800 text-sm mt-0.5">
                            {wizardValidation.audienceSummary.excludedBounced} contacts
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
                      <Button
                        onClick={handleRunValidation}
                        disabled={isValidating}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs"
                      >
                        {isValidating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Run Pre-Flight Validation
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: Review & Send */}
              {wizardStep === 5 && (
                <div className="space-y-4 text-xs">
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400">Campaign:</span>
                        <div className="font-semibold text-slate-900">{formName}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Subject:</span>
                        <div className="font-semibold text-slate-900">{formSubject}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">From:</span>
                        <div className="font-semibold text-slate-900">
                          {formFromName} &lt;{formFromEmail}&gt;
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Audience:</span>
                        <div className="font-semibold text-slate-900">
                          {formAudienceType === "all" ? "All Active Contacts" : "Segmented"}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Delivery Provider:</span>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{formProvider}</span>
                          <span className={`text-[10px] font-normal px-1.5 py-0.2 rounded ${
                            formProvider === "BREVO"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {formProvider === "BREVO" ? "Verified Personal OK" : "Custom Domain"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/60 text-indigo-900">
                    <p className="leading-relaxed">
                      Dispatching will snapshot the target audience into recipient records and enqueue
                      asynchronous batch processing jobs on Redis with BullMQ.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/50">
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
                className="text-xs h-9"
              >
                {wizardStep === 1 ? "Cancel" : "Back"}
              </Button>

              <div className="flex items-center gap-2">
                {wizardStep < 5 ? (
                  <Button
                    onClick={() => {
                      if (wizardStep === 1 && (!formName.trim() || !formSubject.trim() || !formFromEmail.trim())) {
                        setToastMessage({ type: "error", text: "Please complete required fields." });
                        return;
                      }
                      if (wizardStep === 3) {
                        handleRunValidation();
                      }
                      setWizardStep((s) => (s + 1) as any);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        createCampaignMutation.mutate({
                          name: formName,
                          subject: formSubject,
                          preheader: formPreheader || null,
                          fromName: formFromName,
                          fromEmail: formFromEmail,
                          replyTo: formReplyTo || null,
                          templateId: formTemplateId || null,
                          htmlContent: formHtmlContent,
                          targetListIds: formAudienceType === "segmented" ? formSelectedListIds : [],
                          targetTagIds: formAudienceType === "segmented" ? formSelectedTagIds : [],
                          provider: formProvider,
                        })
                      }
                      disabled={createCampaignMutation.isPending}
                      className="text-xs h-9"
                    >
                      Save as Draft
                    </Button>
                    <Button
                      onClick={handleWizardSendImmediately}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5 font-medium shadow-2xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send Immediately
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CAMPAIGN DETAILS & DELIVERY LOGS DRAWER */}
      {/* ============================================================ */}
      {detailsCampaign && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs">
          <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900 truncate max-w-md">
                    {detailsCampaign.name}
                  </h3>
                  <StatusBadge status={campaignStatsQuery.data?.status || detailsCampaign.status} />
                </div>
                <p className="text-xs text-slate-500 truncate">{detailsCampaign.subject}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsCampaign(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {/* Progress Bar & Status */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-slate-700">Dispatch Progress</span>
                  <span className="text-indigo-600 font-semibold font-mono">
                    {campaignStatsQuery.data?.progressPercent ?? 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${campaignStatsQuery.data?.progressPercent ?? 0}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2 text-center">
                  <div className="p-2 rounded bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase">Recipients</div>
                    <div className="text-sm font-semibold text-slate-900 mt-0.5">
                      {campaignStatsQuery.data?.recipientCount ?? detailsCampaign.recipientCount}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-emerald-50 border border-emerald-100">
                    <div className="text-[10px] text-emerald-600 uppercase">Sent</div>
                    <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                      {campaignStatsQuery.data?.sentCount ?? detailsCampaign.sentCount}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-rose-50 border border-rose-100">
                    <div className="text-[10px] text-rose-600 uppercase">Failed</div>
                    <div className="text-sm font-semibold text-rose-700 mt-0.5">
                      {campaignStatsQuery.data?.failedCount ?? detailsCampaign.failedCount}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-amber-50 border border-amber-100">
                    <div className="text-[10px] text-amber-600 uppercase">In Queue</div>
                    <div className="text-sm font-semibold text-amber-700 mt-0.5">
                      {campaignStatsQuery.data?.pendingCount ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Webhook Engagement Stats */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                    Webhook Engagement & Deliverability
                  </span>
                  <a
                    href="/analytics"
                    className="text-indigo-600 hover:text-indigo-700 font-medium text-[11px] flex items-center gap-1"
                  >
                    View in Analytics
                    <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded bg-indigo-50 border border-indigo-100">
                    <div className="text-[10px] text-indigo-600 uppercase font-medium">Delivered</div>
                    <div className="text-sm font-semibold text-indigo-700 mt-0.5">
                      {detailsCampaign.deliveredCount ?? 0}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-emerald-50 border border-emerald-100">
                    <div className="text-[10px] text-emerald-600 uppercase font-medium">Unique Opens</div>
                    <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                      {detailsCampaign.openedCount ?? 0}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-amber-50 border border-amber-100">
                    <div className="text-[10px] text-amber-600 uppercase font-medium">Unique Clicks</div>
                    <div className="text-sm font-semibold text-amber-700 mt-0.5">
                      {detailsCampaign.clickedCount ?? 0}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-rose-50 border border-rose-100">
                    <div className="text-[10px] text-rose-600 uppercase font-medium">Bounces</div>
                    <div className="text-sm font-semibold text-rose-700 mt-0.5">
                      {detailsCampaign.bouncedCount ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Metadata */}
              <div className="grid grid-cols-3 gap-3 text-slate-600">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <span className="text-slate-400 text-[11px]">Delivery Provider</span>
                  <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <span>{detailsCampaign.provider || "RESEND"}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded font-normal ${
                        (detailsCampaign.provider || "RESEND") === "BREVO"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {(detailsCampaign.provider || "RESEND") === "BREVO" ? "Personal OK" : "Domain"}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <span className="text-slate-400 text-[11px]">Started At</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {campaignStatsQuery.data?.startedAt
                      ? new Date(campaignStatsQuery.data.startedAt).toLocaleString()
                      : "Not started"}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <span className="text-slate-400 text-[11px]">Completed At</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {campaignStatsQuery.data?.completedAt
                      ? new Date(campaignStatsQuery.data.completedAt).toLocaleString()
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Recipient Delivery Logs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900">Recipient Delivery Logs</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={(e) => {
                        setRecipientSearch(e.target.value);
                        setRecipientPage(1);
                      }}
                      placeholder="Filter email..."
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-hidden w-36"
                    />
                    <select
                      value={recipientStatusFilter}
                      onChange={(e) => {
                        setRecipientStatusFilter(e.target.value);
                        setRecipientPage(1);
                      }}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-hidden"
                    >
                      <option value="all">All Statuses</option>
                      <option value="SENT">Sent</option>
                      <option value="FAILED">Failed</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="PENDING">Pending</option>
                      <option value="SKIPPED">Skipped</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                  {recipientsQuery.isLoading ? (
                    <div className="p-8 text-center text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
                      <span>Loading logs...</span>
                    </div>
                  ) : recipientsQuery.data?.items?.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      No recipients recorded yet. Recipients will be snapshotted when the campaign is queued.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Recipient</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Provider ID / Error</th>
                          <th className="py-2.5 px-3 text-right">Sent Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recipientsQuery.data?.items?.map((r: CampaignRecipient) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-800">{r.email}</div>
                              {r.firstName && (
                                <div className="text-[10px] text-slate-400">
                                  {r.firstName} {r.lastName || ""}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge status={r.status} />
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] truncate max-w-xs">
                              {r.errorMessage ? (
                                <span className="text-rose-600" title={r.errorMessage}>
                                  {r.errorMessage}
                                </span>
                              ) : r.providerMessageId ? (
                                <span className="text-slate-500" title={r.providerMessageId}>
                                  {r.providerMessageId}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500 text-[11px] whitespace-nowrap">
                              {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Recipient Pagination */}
                {recipientsQuery.data?.pagination &&
                  recipientsQuery.data.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500">
                        Page {recipientPage} of {recipientsQuery.data.pagination.totalPages}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRecipientPage((p) => Math.max(1, p - 1))}
                          disabled={recipientPage <= 1}
                          className="h-6 px-2 text-[10px]"
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRecipientPage((p) =>
                              Math.min(recipientsQuery.data.pagination.totalPages, p + 1)
                            )
                          }
                          disabled={recipientPage >= recipientsQuery.data.pagination.totalPages}
                          className="h-6 px-2 text-[10px]"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailsCampaign(null)}
                className="text-xs h-9"
              >
                Close
              </Button>

              <div className="flex items-center gap-2">
                {detailsCampaign.status === "DRAFT" && (
                  <Button
                    onClick={() => {
                      setCampaignToSend(detailsCampaign);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send Campaign Now
                  </Button>
                )}

                {(detailsCampaign.status === "QUEUED" || detailsCampaign.status === "SENDING") && (
                  <Button
                    onClick={() => setCampaignToCancel(detailsCampaign)}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Cancel Dispatch
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SEND CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {campaignToSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <Send className="h-5 w-5" />
              <h3 className="text-base font-semibold text-slate-900">Send Campaign?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to send{" "}
              <span className="font-semibold text-slate-900">"{campaignToSend.name}"</span>?
              Eligible active recipients will be snapshotted and sent asynchronously via BullMQ and
              the Resend provider.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignToSend(null)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={() => sendCampaignMutation.mutate(campaignToSend.id)}
                disabled={sendCampaignMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 gap-1.5 font-medium"
              >
                {sendCampaignMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Confirm & Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CANCEL CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {campaignToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <RotateCcw className="h-5 w-5" />
              <h3 className="text-base font-semibold text-slate-900">Cancel Campaign?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel{" "}
              <span className="font-semibold text-slate-900">"{campaignToCancel.name}"</span>?
              Any remaining pending recipients will be skipped.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignToCancel(null)}
                className="text-xs h-9"
              >
                Back
              </Button>
              <Button
                onClick={() => cancelCampaignMutation.mutate(campaignToCancel.id)}
                disabled={cancelCampaignMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 gap-1.5 font-medium"
              >
                {cancelCampaignMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="h-5 w-5" />
              <h3 className="text-base font-semibold text-slate-900">Delete Campaign?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">"{campaignToDelete.name}"</span>? This
              action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignToDelete(null)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteCampaignMutation.mutate(campaignToDelete.id)}
                disabled={deleteCampaignMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 gap-1.5 font-medium"
              >
                {deleteCampaignMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete Campaign
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Campaign Copilot Modal */}
      <AICopilotModal
        isOpen={isAICopilotOpen}
        onClose={() => setIsAICopilotOpen(false)}
        currentSubject={formSubject}
        currentPreheader={formPreheader}
        currentHtmlContent={formHtmlContent}
        onApplySubject={(subj) => setFormSubject(subj)}
        onApplyPreheader={(pre) => setFormPreheader(pre)}
        onApplyHtmlContent={(html) => setFormHtmlContent(html)}
        onApplyAll={({ subject, preheader, htmlContent }) => {
          if (subject) setFormSubject(subject);
          if (preheader) setFormPreheader(preheader);
          if (htmlContent) setFormHtmlContent(htmlContent);
          setToastMessage({
            type: "success",
            text: "AI Draft successfully applied to campaign fields!",
          });
        }}
      />
    </div>
  );
}
