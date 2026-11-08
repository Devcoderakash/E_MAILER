import { useState, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  Download,
  TrendingUp,
  MailCheck,
  MousePointerClick,
  ShieldCheck,
  Globe,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Info,
  X,
  UserCheck,
  UserX,
  MailWarning,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  StatCard,
  EmptyState,
  SearchInput,
  StatusBadge,
} from "@/components/common";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { api } from "@/lib/api-client";
import type {
  CampaignDetailAnalytics,
  TimelineBucket,
} from "@/types";

export function AnalyticsPage() {
  const { activeWorkspace } = useAuthStore();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignPage, setCampaignPage] = useState(1);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // 1. Fetch Overview Metrics
  const overviewQuery = useQuery({
    queryKey: ["analytics-overview", activeWorkspace?.id, timeRange],
    queryFn: () => api.getAnalyticsOverview({ range: timeRange }),
    enabled: !!activeWorkspace?.id,
    refetchInterval: 30000,
  });

  // 2. Fetch Timeline Series
  const timelineQuery = useQuery({
    queryKey: ["analytics-timeline", activeWorkspace?.id, timeRange],
    queryFn: () => api.getAnalyticsTimeline({ range: timeRange }),
    enabled: !!activeWorkspace?.id,
  });

  // 3. Fetch Campaigns Performance Comparison
  const campaignsQuery = useQuery({
    queryKey: [
      "analytics-campaigns",
      activeWorkspace?.id,
      timeRange,
      campaignSearch,
      campaignPage,
    ],
    queryFn: () =>
      api.getAnalyticsCampaigns({
        range: timeRange,
        page: campaignPage,
        limit: 10,
        search: campaignSearch,
      }),
    enabled: !!activeWorkspace?.id,
  });

  // 4. Fetch Deliverability by Domain
  const deliverabilityQuery = useQuery({
    queryKey: ["analytics-deliverability", activeWorkspace?.id, timeRange],
    queryFn: () => api.getAnalyticsDeliverability({ range: timeRange }),
    enabled: !!activeWorkspace?.id,
  });

  // 5. Fetch Campaign Detail if selected
  const detailQuery = useQuery({
    queryKey: ["analytics-campaign-detail", selectedCampaignId],
    queryFn: () => api.getAnalyticsCampaignDetail(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  const overview = overviewQuery.data;
  const timeline = timelineQuery.data?.items || [];
  const campaigns = campaignsQuery.data?.items || [];
  const domainDeliverability = deliverabilityQuery.data?.items || [];

  const handleExportCsv = () => {
    if (!campaigns || campaigns.length === 0) {
      alert("No campaign analytics data to export for this time range.");
      return;
    }

    const headers = [
      "Campaign Name",
      "Subject",
      "Sent Date",
      "Status",
      "Sent Count",
      "Delivered Count",
      "Delivery Rate (%)",
      "Unique Opens",
      "Open Rate (%)",
      "Unique Clicks",
      "Click Rate (%)",
      "Bounces",
      "Bounce Rate (%)",
      "Unsubscribes",
    ];

    const rows = campaigns.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.subject.replace(/"/g, '""')}"`,
      new Date(c.sentAt).toISOString(),
      c.status,
      c.sentCount,
      c.deliveredCount,
      c.deliveryRate,
      c.uniqueOpens,
      c.openRate,
      c.uniqueClicks,
      c.clickRate,
      c.bouncedCount,
      c.bounceRate,
      c.unsubscribedCount,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mailpilot-analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isInitialLoading = overviewQuery.isLoading && !overview;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Analytics & Performance"
        description="Real-time deliverability rates, open tracking, recipient click engagement, and domain reputation."
        badge={
          overview ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              {overview.deliveryRate}% Deliverability
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Time range selector */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
              {(["7d", "30d", "90d"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setTimeRange(r);
                    setCampaignPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium uppercase transition-colors ${
                    timeRange === r
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                overviewQuery.refetch();
                timelineQuery.refetch();
                campaignsQuery.refetch();
                deliverabilityQuery.refetch();
              }}
              className="h-9 px-3 gap-1.5 text-xs text-slate-600 hover:text-slate-900 border-slate-200 shadow-2xs"
              title="Refresh Analytics"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  overviewQuery.isFetching ? "animate-spin text-indigo-600" : ""
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportCsv}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 text-xs h-9 px-3 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Gmail SMTP Dispatch Status Banner */}
      {overview && overview.sent > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-900 flex items-start gap-3">
          <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Gmail SMTP Email Dispatch Status</p>
            <p className="text-indigo-800 text-[11px]">
              Campaigns are submitted directly via Google SMTP (<code className="bg-indigo-100 text-indigo-900 px-1 py-0.5 rounded font-mono">smtp.gmail.com:587</code>). Dispatch metrics reflect confirmed SMTP server handshakes and tracked recipient engagement.
            </p>
          </div>
        </div>
      )}

      {isInitialLoading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Computing analytics across workspace...</span>
        </div>
      ) : overview && overview.sent === 0 && campaigns.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="No analytics recorded yet"
          description="Send your first broadcast campaign to track deliverability, recipient open rates, and click engagement."
          actionLabel="Create Campaign"
          onAction={() => (window.location.href = "/campaigns")}
        />
      ) : (
        <>
          {/* High-level KPIs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Delivered Rate"
              value={`${overview?.deliveryRate ?? 0}%`}
              change={`${overview?.delivered.toLocaleString() ?? 0} confirmed`}
              trend="up"
              description={`${overview?.delivered ?? 0} of ${overview?.sent ?? 0} emails`}
              icon={ShieldCheck}
            />
            <StatCard
              title="Unique Open Rate"
              value={`${overview?.openRate ?? 0}%`}
              change={`${overview?.uniqueOpens.toLocaleString() ?? 0} recipients`}
              trend="up"
              description={`${overview?.totalOpens ?? 0} total open events`}
              icon={MailCheck}
            />
            <StatCard
              title="Click-Through Rate"
              value={`${overview?.clickRate ?? 0}%`}
              change={`${overview?.uniqueClicks.toLocaleString() ?? 0} clicked`}
              trend="up"
              description={`${overview?.totalClicks ?? 0} total link clicks`}
              icon={MousePointerClick}
            />
            <StatCard
              title="Bounce Rate"
              value={`${overview?.bounceRate ?? 0}%`}
              change={`${overview?.bounces ?? 0} rejected`}
              trend={overview && overview.bounceRate > 2 ? "down" : "up"}
              description={`${overview?.unsubscribes ?? 0} unsubscribes`}
              icon={AlertTriangle}
            />
          </div>

          {/* Performance Trend Chart */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                  Email Performance Trends
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily delivery and engagement volume across all active campaigns in the selected window.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                  Delivered
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Opens
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Clicks
                </span>
              </div>
            </div>

            {/* Timeline SVG Chart */}
            <AnalyticsTimelineChart data={timeline} />
          </div>

          {/* Two-column Deliverability & Suppression Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Domain Deliverability Breakdown */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-indigo-600" />
                    Deliverability by Mail Provider
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Delivery and bounce health grouped by major inbox provider domains.
                  </p>
                </div>
              </div>

              {domainDeliverability.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No domain breakdown data available for this date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 text-slate-400 font-medium pb-2">
                      <tr>
                        <th className="py-2 px-3">Mail Provider / Domain</th>
                        <th className="py-2 px-3 text-right">Volume</th>
                        <th className="py-2 px-3 text-right">Delivery Rate</th>
                        <th className="py-2 px-3 text-right">Bounce Rate</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {domainDeliverability.map((item) => (
                        <tr key={item.domain} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {item.domain}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {item.sent.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-600">
                            {item.deliveryRate}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {item.bounceRate}%
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                                item.status === "Optimal"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : item.status === "Good"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Audience Health & Suppression Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  List Hygiene & Suppressions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated protections keeping your sender reputation high.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                    <div>
                      <span className="font-medium text-slate-900 block">Active Subscribers</span>
                      <span className="text-[11px] text-slate-500">Eligible for broadcasts</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {overview?.activeContacts.toLocaleString() ?? 0}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <UserX className="h-4 w-4 text-amber-600" />
                    <div>
                      <span className="font-medium text-slate-900 block">Unsubscribed</span>
                      <span className="text-[11px] text-slate-500">Suppressed from future sends</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {overview?.unsubscribes.toLocaleString() ?? 0}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <MailWarning className="h-4 w-4 text-rose-600" />
                    <div>
                      <span className="font-medium text-slate-900 block">Bounced / Complaints</span>
                      <span className="text-[11px] text-slate-500">Hard bounces auto-suppressed</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {((overview?.bounces || 0) + (overview?.complaints || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Privacy Notice Alert */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-slate-500" />
                  Privacy & Open Rate Measurement
                </div>
                <p>
                  Modern email clients (such as Apple Mail Privacy Protection and corporate proxy scanners) pre-fetch images and tracking pixels. Unique recipient opens provide the most accurate benchmark.
                </p>
              </div>
            </div>
          </div>

          {/* Campaign Comparison Table */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-indigo-600" />
                  Campaign Performance Comparison
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct comparison of delivery, open, and click rates across all sent broadcasts.
                </p>
              </div>

              <div className="w-full sm:w-64">
                <SearchInput
                  value={campaignSearch}
                  onChange={(e) => {
                    setCampaignSearch(e.target.value);
                    setCampaignPage(1);
                  }}
                  onClear={() => setCampaignSearch("")}
                  placeholder="Search campaigns..."
                />
              </div>
            </div>

            {campaignsQuery.isLoading ? (
              <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                <span className="text-xs">Loading campaign comparison...</span>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                {campaignSearch ? "No campaigns match your search." : "No sent campaigns found in this time range."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-slate-400 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Campaign</th>
                      <th className="py-2.5 px-3">Sent Date</th>
                      <th className="py-2.5 px-3 text-right">Sent</th>
                      <th className="py-2.5 px-3 text-right">Delivery Rate</th>
                      <th className="py-2.5 px-3 text-right">Open Rate</th>
                      <th className="py-2.5 px-3 text-right">Click Rate</th>
                      <th className="py-2.5 px-3 text-right">Bounce Rate</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaigns.map((camp) => (
                      <tr
                        key={camp.id}
                        className="hover:bg-slate-50/75 transition-colors cursor-pointer"
                        onClick={() => setSelectedCampaignId(camp.id)}
                      >
                        <td className="py-3 px-3">
                          <div className="max-w-xs sm:max-w-md space-y-0.5">
                            <span className="font-semibold text-slate-900 truncate block">
                              {camp.name}
                            </span>
                            <span className="text-slate-500 text-[11px] truncate block">
                              {camp.subject}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(camp.sentAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                          {camp.sentCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-600 font-semibold whitespace-nowrap">
                          {camp.deliveryRate}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-indigo-600 font-semibold whitespace-nowrap">
                          {camp.openRate}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-600 font-semibold whitespace-nowrap">
                          {camp.clickRate}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          {camp.bounceRate}%
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-slate-500 hover:text-indigo-600"
                            onClick={() => setSelectedCampaignId(camp.id)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Campaign Detail Analytics Modal */}
      {selectedCampaignId && (
        <CampaignDetailModal
          detailQuery={detailQuery}
          onClose={() => setSelectedCampaignId(null)}
        />
      )}
    </div>
  );
}

/**
 * Interactive SVG Timeline Performance Chart
 */
function AnalyticsTimelineChart({ data }: { data: TimelineBucket[] }) {
  const gradientId = useId();
  const [metric, setMetric] = useState<"delivered" | "opens" | "clicks">("delivered");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-slate-400">
        No performance timeline data available.
      </div>
    );
  }

  const width = 760;
  const height = 200;
  const paddingX = 40;
  const paddingY = 25;

  const values = data.map((d) => d[metric]);
  const maxValue = Math.max(...values, 5);

  const points = data.map((d, i) => {
    const x = paddingX + (i / Math.max(1, data.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - (d[metric] / maxValue) * (height - paddingY * 2);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="space-y-3">
      {/* Metric toggle pill */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Metric:</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
          {(["delivered", "opens", "clicks"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded px-2.5 py-0.5 capitalize font-medium transition-colors ${
                metric === m
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 select-none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = height - paddingY - ratio * (height - paddingY * 2);
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {Math.round(maxValue * ratio)}
                </text>
              </g>
            );
          })}

          {/* Filled Area */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Line Path */}
          <path
            d={pathD}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((p, i) => (
            <g
              key={p.date}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIndex(i)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={hoverIndex === i ? "5" : "3"}
                className={`${
                  hoverIndex === i
                    ? "fill-indigo-600 stroke-white stroke-2"
                    : "fill-white stroke-indigo-600 stroke-2"
                } transition-all`}
              />
            </g>
          ))}

          {/* X-axis date labels */}
          {points.map((p, i) => {
            // Show every few labels to prevent crowding
            const step = Math.ceil(points.length / 7);
            if (i % step !== 0 && i !== points.length - 1) return null;
            return (
              <text
                key={p.date}
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-mono"
              >
                {p.date.slice(5)}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredPoint && (
          <div
            className="absolute top-2 pointer-events-none rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-2xs space-y-0.5"
            style={{
              left: `${Math.min(
                Math.max((hoveredPoint.x / width) * 100, 15),
                85
              )}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold text-slate-800">{hoveredPoint.date}</div>
            <div className="text-slate-600 flex items-center gap-2">
              <span className="capitalize">{metric}:</span>
              <strong className="text-indigo-600 font-mono">
                {hoveredPoint[metric].toLocaleString()}
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Campaign Detail Analytics Modal
 */
function CampaignDetailModal({
  detailQuery,
  onClose,
}: {
  detailQuery: any;
  onClose: () => void;
}) {
  const detail = detailQuery.data as CampaignDetailAnalytics | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-base">Campaign Analytics</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {detailQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading campaign analytics & events...</span>
          </div>
        ) : !detail ? (
          <div className="text-xs text-rose-600 p-4">Could not load campaign analytics.</div>
        ) : (
          <div className="space-y-5 text-xs">
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-900">{detail.campaign.name}</h4>
                <StatusBadge status={detail.campaign.status} />
              </div>
              <p className="text-slate-500 mt-0.5">Subject: {detail.campaign.subject}</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                From: {detail.campaign.fromName} &lt;{detail.campaign.fromEmail}&gt; &bull; Sent on {new Date(detail.campaign.sentAt).toLocaleString()}
              </p>
            </div>

            {/* Performance KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <span className="text-[11px] text-slate-400 block">Delivered Rate</span>
                <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                  {detail.campaign.deliveryRate}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {detail.campaign.deliveredCount} / {detail.campaign.sentCount}
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <span className="text-[11px] text-slate-400 block">Unique Opens</span>
                <span className="text-lg font-bold text-indigo-600 font-mono mt-0.5 block">
                  {detail.campaign.openRate}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {detail.campaign.uniqueOpens} opened
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <span className="text-[11px] text-slate-400 block">Click Rate</span>
                <span className="text-lg font-bold text-amber-600 font-mono mt-0.5 block">
                  {detail.campaign.clickRate}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {detail.campaign.uniqueClicks} clicked
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <span className="text-[11px] text-slate-400 block">Bounces</span>
                <span className="text-lg font-bold text-slate-700 font-mono mt-0.5 block">
                  {detail.campaign.bounceRate}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {detail.campaign.bouncedCount} bounced
                </span>
              </div>
            </div>

            {/* Event Activity Stream */}
            <div className="space-y-3">
              <h5 className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-indigo-600" />
                Recent Delivery & Engagement Events Log
              </h5>

              {detail.recentEvents.length === 0 ? (
                <div className="text-slate-400 text-xs py-4 text-center border rounded-lg">
                  No webhook delivery events recorded yet for this broadcast.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {detail.recentEvents.map((evt) => (
                    <div key={evt.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            evt.eventType === "DELIVERED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : evt.eventType === "OPENED"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : evt.eventType === "CLICKED"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : evt.eventType === "BOUNCED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {evt.eventType}
                        </span>
                        <span className="font-medium text-slate-800">{evt.recipientEmail}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(evt.occurredAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <Button size="sm" variant="default" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
