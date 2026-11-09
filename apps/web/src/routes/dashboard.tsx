import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/features/auth/use-auth-store";
import {
  Users,
  Send,
  MailCheck,
  MousePointerClick,
  Plus,
  Upload,
  Calendar,
  ArrowRight,
  Clock,
  CheckCircle2,
  Circle,
  X,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatCard,
  DataTable,
  StatusBadge,
  AppContentSkeleton,
  type Column,
} from "@/components/common";
import type { Campaign } from "@/types";

export function DashboardOverviewPage() {
  const navigate = useNavigate();
  const { activeWorkspace, profile, user } = useAuthStore();

  // Onboarding dismiss state
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(() => {
    return localStorage.getItem("mailpilot_onboarding_dismissed") === "true";
  });

  // 1. Audience Stats
  const { data: contactStats } = useQuery({
    queryKey: ["contact-stats", activeWorkspace?.id],
    queryFn: () => api.getContactStats(),
    enabled: !!activeWorkspace?.id,
  });

  // 2. Performance Overview
  const { data: analyticsOverview } = useQuery({
    queryKey: ["analytics-overview", activeWorkspace?.id],
    queryFn: () => api.getAnalyticsOverview(),
    enabled: !!activeWorkspace?.id,
  });

  // 3. Recent Campaigns
  const { data: campaignsData } = useQuery({
    queryKey: ["recent-campaigns", activeWorkspace?.id],
    queryFn: () => api.getCampaigns({ page: 1, limit: 5 }),
    enabled: !!activeWorkspace?.id,
  });

  // 4. Upcoming Schedules
  const { data: schedulesData } = useQuery({
    queryKey: ["upcoming-schedules", activeWorkspace?.id],
    queryFn: () => api.getSchedules(),
    enabled: !!activeWorkspace?.id,
  });

  const recentCampaigns = campaignsData?.items || [];
  const upcomingSchedules = schedulesData?.items || [];

  // Determine user first name
  const rawName = profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const firstName = rawName.split(" ")[0];

  // Calculate actual onboarding progress
  const hasContacts = (contactStats?.total ?? 0) > 0;
  const hasCampaigns = (campaignsData?.pagination?.total ?? 0) > 0 || recentCampaigns.length > 0;
  const hasSentEmail = (analyticsOverview?.sent ?? 0) > 0 || recentCampaigns.some((c) => c.status === "SENT");

  const completedStepsCount = [hasContacts, hasCampaigns, hasSentEmail].filter(Boolean).length;
  const isAllCompleted = completedStepsCount === 3;

  const handleDismissOnboarding = () => {
    localStorage.setItem("mailpilot_onboarding_dismissed", "true");
    setIsOnboardingDismissed(true);
  };

  // Table columns definition
  const campaignColumns: Column<Campaign>[] = [
    {
      header: "Campaign",
      cell: (row) => (
        <div className="space-y-0.5 max-w-xs sm:max-w-md">
          <div className="font-semibold text-slate-900 truncate">{row.name}</div>
          <div className="text-xs text-slate-500 truncate">{row.subject}</div>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Recipients",
      headerClassName: "hidden md:table-cell",
      className: "hidden md:table-cell",
      cell: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {(row.recipientCount ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Sent",
      headerClassName: "hidden sm:table-cell",
      className: "hidden sm:table-cell",
      cell: (row) => (
        <span className="text-xs text-slate-700">
          {(row.sentCount ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Opens",
      cell: (row) => {
        const rate =
          (row.sentCount ?? 0) > 0
            ? (((row.openedCount ?? 0) / (row.sentCount ?? 1)) * 100).toFixed(1)
            : null;
        return rate ? (
          <span className="font-semibold text-emerald-600">{rate}%</span>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
    {
      header: "Clicks",
      headerClassName: "hidden lg:table-cell",
      className: "hidden lg:table-cell",
      cell: (row) => {
        const rate =
          (row.sentCount ?? 0) > 0
            ? (((row.clickedCount ?? 0) / (row.sentCount ?? 1)) * 100).toFixed(1)
            : null;
        return rate ? (
          <span className="font-semibold text-indigo-600">{rate}%</span>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
  ];

  // If initial dashboard metrics haven't loaded yet, show skeleton screen
  if (!contactStats && !analyticsOverview && !campaignsData) {
    return <AppContentSkeleton layout="dashboard" />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {firstName}.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create email campaigns, reach your audience, and track real engagement.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Button
            onClick={() => navigate("/campaigns?action=create")}
            className="flex-1 sm:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs font-semibold h-9 px-4 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Create Campaign
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/contacts")}
            className="flex-1 sm:flex-none justify-center border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 text-xs font-medium h-9 px-4"
          >
            <Upload className="h-4 w-4" />
            Add Contacts
          </Button>
        </div>
      </div>

      {/* Getting Started Checklist (Dismissible & Real Progress) */}
      {!isOnboardingDismissed && !isAllCompleted && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-indigo-950">
                Getting Started Checklist
              </h2>
              <p className="text-xs text-indigo-700 mt-0.5">
                Complete these 3 steps to send your first campaign ({completedStepsCount} of 3 completed).
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismissOnboarding}
              className="text-indigo-400 hover:text-indigo-600 p-1 rounded-lg"
              title="Dismiss checklist"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Step 1: Add contacts */}
            <div
              onClick={() => !hasContacts && navigate("/contacts")}
              className={`p-3.5 rounded-lg border bg-white flex items-start gap-3 transition-colors ${
                hasContacts
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-slate-200 hover:border-indigo-300 cursor-pointer"
              }`}
            >
              {hasContacts ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className={`text-xs font-semibold ${hasContacts ? "text-emerald-900 line-through" : "text-slate-900"}`}>
                  1. Add your contacts
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {hasContacts ? `${contactStats?.total} contacts added` : "Import a CSV or add contacts"}
                </p>
              </div>
            </div>

            {/* Step 2: Create campaign */}
            <div
              onClick={() => !hasCampaigns && navigate("/campaigns?action=create")}
              className={`p-3.5 rounded-lg border bg-white flex items-start gap-3 transition-colors ${
                hasCampaigns
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-slate-200 hover:border-indigo-300 cursor-pointer"
              }`}
            >
              {hasCampaigns ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className={`text-xs font-semibold ${hasCampaigns ? "text-emerald-900 line-through" : "text-slate-900"}`}>
                  2. Create your first campaign
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {hasCampaigns ? "Campaign drafted" : "Pick a template and write an email"}
                </p>
              </div>
            </div>

            {/* Step 3: Send email */}
            <div
              onClick={() => !hasSentEmail && navigate("/campaigns")}
              className={`p-3.5 rounded-lg border bg-white flex items-start gap-3 transition-colors ${
                hasSentEmail
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-slate-200 hover:border-indigo-300 cursor-pointer"
              }`}
            >
              {hasSentEmail ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className={`text-xs font-semibold ${hasSentEmail ? "text-emerald-900 line-through" : "text-slate-900"}`}>
                  3. Send your first email
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {hasSentEmail ? "Emails dispatched" : "Send or schedule your campaign"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Audience"
          value={contactStats ? contactStats.total.toLocaleString() : "0"}
          change={contactStats ? `${contactStats.active} active` : undefined}
          trend={(contactStats?.total ?? 0) > 0 ? "up" : "neutral"}
          description="Total subscribed contacts"
          icon={Users}
        />
        <StatCard
          title="Sent Emails"
          value={analyticsOverview ? analyticsOverview.sent.toLocaleString() : "0"}
          change={
            analyticsOverview && analyticsOverview.sent > 0
              ? `${analyticsOverview.sent} delivered`
              : undefined
          }
          trend={(analyticsOverview?.sent ?? 0) > 0 ? "up" : "neutral"}
          description="Campaign emails dispatched"
          icon={Send}
        />
        <StatCard
          title="Average Open Rate"
          value={
            analyticsOverview && analyticsOverview.openRate !== undefined
              ? `${analyticsOverview.openRate}%`
              : "0.0%"
          }
          change={
            analyticsOverview && analyticsOverview.uniqueOpens > 0
              ? `${analyticsOverview.uniqueOpens} opens`
              : undefined
          }
          trend={(analyticsOverview?.uniqueOpens ?? 0) > 0 ? "up" : "neutral"}
          description="Subscribers who viewed email"
          icon={MailCheck}
        />
        <StatCard
          title="Average Click Rate"
          value={
            analyticsOverview && analyticsOverview.clickRate !== undefined
              ? `${analyticsOverview.clickRate}%`
              : "0.0%"
          }
          change={
            analyticsOverview && analyticsOverview.uniqueClicks > 0
              ? `${analyticsOverview.uniqueClicks} clicks`
              : undefined
          }
          trend={(analyticsOverview?.uniqueClicks ?? 0) > 0 ? "up" : "neutral"}
          description="Subscribers who clicked links"
          icon={MousePointerClick}
        />
      </div>

      {/* Split Section: Recent Campaigns Table + Right Side (Upcoming Schedules & Quick Launch) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Campaigns Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Recent Campaigns
              </h3>
              <p className="text-xs text-slate-500">
                Latest email broadcasts from your workspace.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/campaigns")}
              className="text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <DataTable<Campaign>
            columns={campaignColumns}
            data={recentCampaigns}
            keyExtractor={(row) => row.id}
            emptyMessage="No campaigns created yet. Start with your first campaign."
            emptyAction={
              <Button
                size="sm"
                onClick={() => navigate("/campaigns?action=create")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs mt-2"
              >
                Create Campaign
              </Button>
            }
          />
        </div>

        {/* Right 1 Col: Upcoming Schedules & Quick Launch */}
        <div className="space-y-6">
          {/* Upcoming Schedules */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-semibold text-slate-900">
                  Upcoming Scheduled
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/schedule")}
                className="text-[11px] h-6 px-2 text-indigo-600 hover:text-indigo-700"
              >
                Schedule &rarr;
              </Button>
            </div>

            {upcomingSchedules.length > 0 ? (
              <div className="space-y-2">
                {upcomingSchedules.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.name}
                      </span>
                      <StatusBadge status="scheduled" showDot={false} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {item.scheduledAt
                          ? new Date(item.scheduledAt).toLocaleDateString()
                          : "Scheduled"}
                      </span>
                      <span className="text-slate-600 font-medium">
                        {item.recipientCount} recipients
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 space-y-2">
                <Clock className="h-6 w-6 text-slate-300 mx-auto" />
                <p>No upcoming scheduled campaigns.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/schedule")}
                  className="text-xs h-7 border-slate-200"
                >
                  Schedule an Email
                </Button>
              </div>
            )}
          </div>

          {/* Quick Launch Cards */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Quick Actions
            </h4>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate("/campaigns?action=create")}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left"
              >
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Create Campaign</div>
                  <div className="text-[11px] text-slate-500">Design and send an email</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate("/contacts")}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left"
              >
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Manage Contacts</div>
                  <div className="text-[11px] text-slate-500">Import and organize subscribers</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate("/reports")}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left"
              >
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <BarChart2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">View Reports</div>
                  <div className="text-[11px] text-slate-500">Track opens and clicks</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
