import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatCard,
  DashboardChart,
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/common";
import type { Campaign, ScheduledCampaign, ActivityEvent } from "@/types";

// Sample preview campaigns
const previewCampaigns: Campaign[] = [
  {
    id: "camp-1",
    name: "Summer Product Launch 2026",
    subject: "Announcing MailPilot 2.0: Smarter email automation",
    status: "sent",
    audience: "All Subscribers",
    recipientCount: 4850,
    sentAt: "May 5, 2026, 10:30 AM",
    createdAt: "2026-05-04T12:00:00Z",
    stats: {
      sent: 4850,
      delivered: 4820,
      opens: 2480,
      openRate: 51.4,
      clicks: 890,
      clickRate: 18.4,
    },
  },
  {
    id: "camp-2",
    name: "Weekly Engineering Digest #42",
    subject: "Scaling Redis & BullMQ to 10M events",
    status: "sent",
    audience: "Tech Segment",
    recipientCount: 3120,
    sentAt: "May 3, 2026, 02:00 PM",
    createdAt: "2026-05-02T10:00:00Z",
    stats: {
      sent: 3120,
      delivered: 3110,
      opens: 1420,
      openRate: 45.6,
      clicks: 410,
      clickRate: 13.1,
    },
  },
  {
    id: "camp-3",
    name: "Customer Onboarding Sequence — Step 1",
    subject: "Welcome to MailPilot! Here are your API keys",
    status: "scheduled",
    audience: "New Signups",
    recipientCount: 650,
    scheduledFor: "Tomorrow at 09:00 AM",
    createdAt: "2026-05-06T15:00:00Z",
  },
  {
    id: "camp-4",
    name: "Early Access Beta Invitation",
    subject: "You're invited to test our new AI email composer",
    status: "draft",
    audience: "VIP Waitlist",
    recipientCount: 200,
    createdAt: "2026-05-07T08:30:00Z",
  },
];

const previewScheduled: ScheduledCampaign[] = [
  {
    id: "sch-1",
    name: "Customer Onboarding Sequence — Step 1",
    scheduledTime: "Tomorrow at 09:00 AM",
    recipientCount: 650,
    targetAudience: "New Signups",
    queueStatus: "queued",
    channel: "Broadcast",
  },
  {
    id: "sch-2",
    name: "Global Security Bulletin & SPF/DKIM Update",
    scheduledTime: "Friday, May 9 at 11:30 AM",
    recipientCount: 5200,
    targetAudience: "All Subscribers",
    queueStatus: "delayed",
    channel: "Transactional",
  },
];

const previewActivities: ActivityEvent[] = [
  {
    id: "act-1",
    type: "campaign_sent",
    title: "Campaign Broadcast Dispatched",
    description: "'Summer Product Launch' delivered to 4,820 recipients.",
    timestamp: "2 hours ago",
    status: "success",
  },
  {
    id: "act-2",
    type: "contacts_imported",
    title: "CSV Audience Ingestion",
    description: "340 new contacts mapped to 'Tech Segment'.",
    timestamp: "5 hours ago",
    status: "info",
  },
  {
    id: "act-3",
    type: "system_worker",
    title: "BullMQ Job Engine Synchronized",
    description: "Redis background queue health checked (latency 2ms).",
    timestamp: "Yesterday",
    status: "success",
  },
  {
    id: "act-4",
    type: "domain_verified",
    title: "DKIM / SPF Verified",
    description: "mail.mailpilot.io DNS verification confirmed active.",
    timestamp: "2 days ago",
    status: "success",
  },
];

export function DashboardOverviewPage() {
  const navigate = useNavigate();
  const [isDemoData, setIsDemoData] = useState(true);

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
          {row.audience}
        </span>
      ),
    },
    {
      header: "Recipients",
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.recipientCount.toLocaleString()}
        </span>
      ),
    },
    {
      header: "Open Rate",
      cell: (row) =>
        row.stats?.openRate ? (
          <span className="font-semibold text-emerald-600">
            {row.stats.openRate}%
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      header: "Click Rate",
      cell: (row) =>
        row.stats?.clickRate ? (
          <span className="font-semibold text-indigo-600">
            {row.stats.clickRate}%
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  const displayedCampaigns = isDemoData ? previewCampaigns : [];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              Intelligent Email Marketing Platform
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back to MailPilot
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Design high-converting email campaigns, build automated behavioral sequences,
              and monitor real-time deliverability across all inbox providers.
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

      {/* KPI Cards Header & Demo Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Key Performance Metrics
          </h2>
          <p className="text-xs text-slate-500">
            Overview of audience reach and engagement rates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDemoData(!isDemoData)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 font-medium transition-colors"
          title="Toggle honest zero state versus demo preview values"
        >
          <span>Metrics mode:</span>
          <span className="font-semibold text-indigo-600">
            {isDemoData ? "Demo Preview" : "Zero / Empty State"}
          </span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Contacts"
          value={isDemoData ? "12,480" : "0"}
          change={isDemoData ? "+14.2% vs last month" : undefined}
          trend={isDemoData ? "up" : "neutral"}
          description={isDemoData ? "1,240 added this week" : "No contacts imported"}
          icon={Users}
          isDemo={isDemoData}
        />
        <StatCard
          title="Emails Sent"
          value={isDemoData ? "84,920" : "0"}
          change={isDemoData ? "+28.5% volume" : undefined}
          trend={isDemoData ? "up" : "neutral"}
          description={isDemoData ? "Across 14 campaigns" : "No campaigns sent yet"}
          icon={Send}
          isDemo={isDemoData}
        />
        <StatCard
          title="Average Open Rate"
          value={isDemoData ? "48.2%" : "0.0%"}
          change={isDemoData ? "+3.8% vs benchmark" : undefined}
          trend={isDemoData ? "up" : "neutral"}
          description={isDemoData ? "Industry avg: 21.5%" : "Awaiting first send"}
          icon={MailCheck}
          isDemo={isDemoData}
        />
        <StatCard
          title="Average Click Rate"
          value={isDemoData ? "14.6%" : "0.0%"}
          change={isDemoData ? "+1.4% vs benchmark" : undefined}
          trend={isDemoData ? "up" : "neutral"}
          description={isDemoData ? "Industry avg: 2.8%" : "Awaiting first send"}
          icon={MousePointerClick}
          isDemo={isDemoData}
        />
      </div>

      {/* Campaign Performance Chart */}
      <DashboardChart />

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
                Latest email deliveries and their performance.
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
            data={displayedCampaigns}
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

        {/* Right 1 Col: Upcoming Scheduled & Activity Feed */}
        <div className="space-y-6">
          {/* Upcoming Scheduled */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
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
                className="text-[11px] h-6 px-2 text-indigo-600"
              >
                Schedule &rarr;
              </Button>
            </div>

            <div className="space-y-2.5">
              {previewScheduled.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 line-clamp-1">
                      {item.name}
                    </span>
                    <StatusBadge status={item.queueStatus} showDot={false} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {item.scheduledTime}
                    </span>
                    <span className="font-mono text-slate-600 font-medium">
                      {item.recipientCount.toLocaleString()} rcpts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-semibold text-slate-900">
                  Recent System Activity
                </h4>
              </div>
            </div>

            <div className="space-y-3">
              {previewActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {act.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {act.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {act.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
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
              <div className="text-[11px] text-slate-500">Broadcast email blast</div>
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
