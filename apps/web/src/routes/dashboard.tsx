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
  Sparkles,
  ArrowRight,
  Clock,
  Activity,
  FileText,
  Workflow,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatCard,
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/common";
import type { Campaign } from "@/types";

export function DashboardOverviewPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useAuthStore();

  // 1. Real Contact Statistics
  const { data: contactStats } = useQuery({
    queryKey: ["contact-stats", activeWorkspace?.id],
    queryFn: () => api.getContactStats(),
    enabled: !!activeWorkspace?.id,
  });

  // 2. Real Analytics Overview
  const { data: analyticsOverview } = useQuery({
    queryKey: ["analytics-overview", activeWorkspace?.id],
    queryFn: () => api.getAnalyticsOverview(),
    enabled: !!activeWorkspace?.id,
  });

  // 3. Real Recent Broadcast Campaigns
  const { data: campaignsData } = useQuery({
    queryKey: ["recent-campaigns", activeWorkspace?.id],
    queryFn: () => api.getCampaigns({ page: 1, limit: 5 }),
    enabled: !!activeWorkspace?.id,
  });

  // 4. Real Upcoming Scheduled Campaigns
  const { data: schedulesData } = useQuery({
    queryKey: ["upcoming-schedules", activeWorkspace?.id],
    queryFn: () => api.getSchedules(),
    enabled: !!activeWorkspace?.id,
  });

  const recentCampaigns = campaignsData?.items || [];
  const upcomingSchedules = schedulesData?.items || [];

  // Table columns definition
  const campaignColumns: Column<Campaign>[] = [
    {
      header: "Campaign Name",
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
      header: "Audience",
      cell: (row) => (
        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
          {row.recipientCount} recipients
        </span>
      ),
    },
    {
      header: "Dispatched",
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {(row.sentCount ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Open Rate",
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
      header: "Click Rate",
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

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              Google Ecosystem Email & AI Platform
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back to MailPilot
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dispatch targeted campaigns via Gmail SMTP, automate behavioral drip workflows,
              and sync campaign schedules seamlessly with Google Calendar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              onClick={() => navigate("/campaigns")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2 text-xs sm:text-sm font-medium h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/contacts")}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 text-xs sm:text-sm font-medium h-10 px-4"
            >
              <Upload className="h-4 w-4" />
              Import Contacts
            </Button>
          </div>
        </div>

        {/* Subtle decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-50/60 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards Header */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
          Live Workspace Metrics
        </h2>
        <p className="text-xs text-slate-500">
          Real-time delivery and engagement data powered by Supabase PostgreSQL and Gmail SMTP.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Audience"
          value={contactStats ? contactStats.total.toLocaleString() : "0"}
          change={contactStats ? `${contactStats.active} active subscribers` : undefined}
          trend={(contactStats?.total ?? 0) > 0 ? "up" : "neutral"}
          description={
            contactStats
              ? `${contactStats.unsubscribed} unsubscribed, ${contactStats.bounced} bounced`
              : "No contacts in active workspace"
          }
          icon={Users}
        />
        <StatCard
          title="Emails Dispatched"
          value={analyticsOverview ? analyticsOverview.sent.toLocaleString() : "0"}
          change={
            analyticsOverview && analyticsOverview.sent > 0
              ? `${analyticsOverview.deliveryRate}% delivered`
              : undefined
          }
          trend={(analyticsOverview?.sent ?? 0) > 0 ? "up" : "neutral"}
          description={
            analyticsOverview && analyticsOverview.sent > 0
              ? `${analyticsOverview.delivered} confirmed deliveries`
              : "Awaiting first campaign dispatch"
          }
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
              ? `${analyticsOverview.uniqueOpens} unique opens`
              : undefined
          }
          trend={(analyticsOverview?.uniqueOpens ?? 0) > 0 ? "up" : "neutral"}
          description={
            analyticsOverview && analyticsOverview.uniqueOpens > 0
              ? "Tracked across broadcast campaigns"
              : "Awaiting recipient open events"
          }
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
              ? `${analyticsOverview.uniqueClicks} unique clicks`
              : undefined
          }
          trend={(analyticsOverview?.uniqueClicks ?? 0) > 0 ? "up" : "neutral"}
          description={
            analyticsOverview && analyticsOverview.uniqueClicks > 0
              ? "Tracked across campaign links"
              : "Awaiting recipient click events"
          }
          icon={MousePointerClick}
        />
      </div>

      {/* Split Section: Recent Campaigns Table + Right Side (Activity & Upcoming) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Campaigns Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Recent Broadcast Campaigns
              </h3>
              <p className="text-xs text-slate-500">
                Latest dispatches from your workspace.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/campaigns")}
              className="text-xs gap-1 border-slate-200 text-slate-700"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <DataTable<Campaign>
            columns={campaignColumns}
            data={recentCampaigns}
            keyExtractor={(row) => row.id}
            emptyMessage="No broadcast campaigns created yet. Start by crafting your first campaign."
            emptyAction={
              <Button
                size="sm"
                onClick={() => navigate("/campaigns")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs mt-2"
              >
                Create Campaign
              </Button>
            }
          />
        </div>

        {/* Right 1 Col: Upcoming Scheduled & Architecture Status */}
        <div className="space-y-6">
          {/* Upcoming Scheduled */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-semibold text-slate-900">
                  Upcoming Schedules
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/schedule")}
                className="text-[11px] h-6 px-2 text-indigo-600"
              >
                Schedule Center &rarr;
              </Button>
            </div>

            {upcomingSchedules.length > 0 ? (
              <div className="space-y-2.5">
                {upcomingSchedules.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 line-clamp-1">
                        {item.name}
                      </span>
                      <StatusBadge status="scheduled" showDot={false} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {item.scheduledAt
                          ? new Date(item.scheduledAt).toLocaleString()
                          : "Scheduled"}
                      </span>
                      <span className="font-mono text-slate-600 font-medium">
                        {item.recipientCount} rcpts
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
                  Schedule a Campaign
                </Button>
              </div>
            )}
          </div>

          {/* Google Ecosystem Status Summary */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-semibold text-slate-900">
                  Google Architecture Stack
                </h4>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Gmail SMTP Gateway
                </span>
                <span className="text-[11px] font-mono text-slate-700 font-medium">smtp.gmail.com:587</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> PostgreSQL + BullMQ
                </span>
                <span className="text-[11px] font-mono text-slate-700 font-medium">Delayed Queues</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" /> Google Gemini AI
                </span>
                <span className="text-[11px] font-mono text-slate-700 font-medium">gemini-2.0-flash</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launch Shortcuts Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
          Quick Launch Shortcuts
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => navigate("/campaigns")}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Create Campaign</div>
              <div className="text-[11px] text-slate-500">Gmail SMTP blast</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/contacts")}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Import Contacts</div>
              <div className="text-[11px] text-slate-500">CSV or API sync</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/templates")}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Design Template</div>
              <div className="text-[11px] text-slate-500">Responsive layouts</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/automations")}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Workflow className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Automation Builder</div>
              <div className="text-[11px] text-slate-500">Triggered drip sequences</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
