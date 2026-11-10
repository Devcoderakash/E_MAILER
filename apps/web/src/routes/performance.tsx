import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  MousePointerClick,
  RefreshCw,
  UserX,
  Eye,
  Send,
  ChevronDown,
  ChevronUp,
  BarChart2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatCard,
  StatusBadge,
  AppContentSkeleton,
} from "@/components/common";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { api } from "@/lib/api-client";
import type {
  CampaignAnalyticsItem,
  DomainDeliverabilityItem,
  TimelineBucket,
} from "@/types";

export function PerformancePage() {
  const { activeWorkspace } = useAuthStore();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignPage, setCampaignPage] = useState(1);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  // 1. Fetch Overview Metrics
  const overviewQuery = useQuery({
    queryKey: ["analytics-overview", activeWorkspace?.id, timeRange],
    queryFn: () => api.getAnalyticsOverview({ range: timeRange }),
    enabled: !!activeWorkspace?.id,
  });

  // 2. Fetch Timeline Series
  const timelineQuery = useQuery({
    queryKey: ["analytics-timeline", activeWorkspace?.id, timeRange],
    queryFn: () => api.getAnalyticsTimeline({ range: timeRange }),
    enabled: !!activeWorkspace?.id,
  });

  // 3. Fetch Domain Breakdown for advanced details
  const deliverabilityQuery = useQuery({
    queryKey: ["analytics-deliverability", activeWorkspace?.id, timeRange],
    queryFn: () => api.getAnalyticsDeliverability({ range: timeRange }),
    enabled: !!activeWorkspace?.id && showAdvancedDetails,
  });

  // 4. Fetch Campaign-Level Analytics Table
  const campaignsQuery = useQuery({
    queryKey: [
      "analytics-campaigns",
      activeWorkspace?.id,
      campaignPage,
      campaignSearch,
      timeRange,
    ],
    queryFn: () =>
      api.getAnalyticsCampaigns({
        range: timeRange,
        page: campaignPage,
        limit: 10,
        search: campaignSearch || undefined,
      }),
    enabled: !!activeWorkspace?.id,
  });

  // 5. Fetch Campaign Detail Modal if selected
  const detailQuery = useQuery({
    queryKey: ["analytics-campaign-detail", selectedCampaignId],
    queryFn: () => api.getAnalyticsCampaignDetail(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  const overview = overviewQuery.data;
  const timeline: TimelineBucket[] = timelineQuery.data?.items || [];
  const deliverability: DomainDeliverabilityItem[] = deliverabilityQuery.data?.items || [];
  const campaignsList: CampaignAnalyticsItem[] = campaignsQuery.data?.items || [];
  const pagination = campaignsQuery.data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  };

  const isRefreshing =
    overviewQuery.isFetching ||
    timelineQuery.isFetching ||
    campaignsQuery.isFetching;

  const handleRefresh = () => {
    overviewQuery.refetch();
    timelineQuery.refetch();
    campaignsQuery.refetch();
    if (showAdvancedDetails) deliverabilityQuery.refetch();
  };

  // Export CSV of Campaign Analytics
  const handleExportCSV = () => {
    if (!campaignsList || campaignsList.length === 0) return;
    const headers = [
      "Campaign Name",
      "Subject",
      "Status",
      "Recipients",
      "Sent",
      "Unique Opens",
      "Open Rate",
      "Unique Clicks",
      "Click Rate",
      "Unsubscribes",
    ];

    const rows = campaignsList.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.subject.replace(/"/g, '""')}"`,
      c.status,
      c.recipientCount,
      c.sentCount,
      c.uniqueOpens,
      `${c.openRate}%`,
      c.uniqueClicks,
      `${c.clickRate}%`,
      c.unsubscribedCount,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `mailpilot_reports_${timeRange}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasData = (overview?.sent ?? 0) > 0 || campaignsList.length > 0;

  if (overviewQuery.isLoading && !overview) {
    return <AppContentSkeleton layout="dashboard" />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Reports
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Understand how subscribers interact with your emails.
          </p>
        </div>

        {/* Controls: Date Range, Refresh, CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  timeRange === r
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {r === "7d" ? "Last 7 Days" : r === "30d" ? "Last 30 Days" : "Last 90 Days"}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 px-2.5 gap-1.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
            title="Refresh metrics"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 px-2.5 gap-1.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 font-medium"
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* 4 PRIMARY METRIC CARDS: Sent, Opened, Clicked, Unsubscribed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Sent */}
        <StatCard
          title="Sent"
          value={overview?.sent?.toLocaleString() ?? "0"}
          icon={Send}
          description="Total emails dispatched"
        />

        {/* Metric 2: Opened */}
        <StatCard
          title="Opened"
          value={
            overview && overview.openRate !== undefined
              ? `${overview.openRate}%`
              : "0.0%"
          }
          change={
            overview && overview.uniqueOpens > 0
              ? `${overview.uniqueOpens.toLocaleString()} unique opens`
              : undefined
          }
          trend={(overview?.uniqueOpens ?? 0) > 0 ? "up" : "neutral"}
          icon={Eye}
          description="Subscribers who opened"
        />

        {/* Metric 3: Clicked */}
        <StatCard
          title="Clicked"
          value={
            overview && overview.clickRate !== undefined
              ? `${overview.clickRate}%`
              : "0.0%"
          }
          change={
            overview && overview.uniqueClicks > 0
              ? `${overview.uniqueClicks.toLocaleString()} link clicks`
              : undefined
          }
          trend={(overview?.uniqueClicks ?? 0) > 0 ? "up" : "neutral"}
          icon={MousePointerClick}
          description="Subscribers who clicked links"
        />

        {/* Metric 4: Unsubscribed */}
        <StatCard
          title="Unsubscribed"
          value={overview?.unsubscribes?.toLocaleString() ?? "0"}
          change={
            overview && overview.unsubscribeRate !== undefined
              ? `${overview.unsubscribeRate}% rate`
              : undefined
          }
          trend={(overview?.unsubscribes ?? 0) > 0 ? "down" : "neutral"}
          icon={UserX}
          description="Subscribers who opted out"
        />
      </div>

      {/* Expandable Advanced Delivery Details Accordion */}
      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <span>Advanced Delivery Details</span>
          {showAdvancedDetails ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showAdvancedDetails && (
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-slate-500">SMTP Relay Accepted</span>
                <div className="text-sm font-semibold text-slate-900">
                  {overview?.delivered?.toLocaleString() ?? "0"}
                </div>
                <p className="text-[10px] text-slate-400">Accepted by destination mail servers</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-slate-500">Failed / Permanent Bounces</span>
                <div className="text-sm font-semibold text-rose-600">
                  {overview?.bounces?.toLocaleString() ?? "0"}
                </div>
                <p className="text-[10px] text-slate-400">Invalid addresses or hard bounces</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="text-slate-500">Total Campaigns</span>
                <div className="text-sm font-semibold text-slate-900">
                  {overview?.totalCampaigns ?? 0}
                </div>
                <p className="text-[10px] text-slate-400">Campaigns launched in selected period</p>
              </div>
            </div>

            {deliverability.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-2">
                  Recipient Domain Breakdown
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {deliverability.map((dom) => (
                    <div
                      key={dom.domain}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <div className="font-semibold text-slate-800 truncate">{dom.domain}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {dom.sent} sent • {dom.deliveryRate}% accepted
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Engagement Activity View / Chart */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          Engagement Activity
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Trends in email dispatch, opens, and clicks over time.
        </p>

        {!hasData ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <BarChart2 className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-slate-500 font-medium">
              No performance data yet. Send your first campaign to see results.
            </p>
          </div>
        ) : (
          <EngagementActivityChart data={timeline} />
        )}
      </div>

      {/* Campaign-Level Analytics Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Campaign Performance</h3>
            <p className="text-xs text-slate-500">Individual metrics for every broadcast.</p>
          </div>

          <input
            type="text"
            value={campaignSearch}
            onChange={(e) => {
              setCampaignSearch(e.target.value);
              setCampaignPage(1);
            }}
            placeholder="Search campaigns..."
            className="w-full sm:w-56 text-xs rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:border-indigo-600"
          />
        </div>

        {campaignsList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No campaign results found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent</th>
                  <th className="py-3 px-4">Open Rate</th>
                  <th className="py-3 px-4">Click Rate</th>
                  <th className="py-3 px-4">Unsubscribes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaignsList.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/75 transition-colors cursor-pointer"
                    onClick={() => setSelectedCampaignId(c.id)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{c.subject}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-800">
                      {(c.sentCount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {c.openRate > 0 ? (
                        <span className="font-semibold text-emerald-600">{c.openRate}%</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {c.clickRate > 0 ? (
                        <span className="font-semibold text-indigo-600">{c.clickRate}%</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {c.unsubscribedCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
            <span>
              Showing page {campaignPage} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignPage((p) => Math.max(1, p - 1))}
                disabled={campaignPage <= 1}
                className="h-7 text-xs border-slate-200"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={campaignPage >= pagination.totalPages}
                className="h-7 text-xs border-slate-200"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Campaign Detail Modal */}
      {selectedCampaignId && detailQuery.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {detailQuery.data.campaign.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detailQuery.data.campaign.subject}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCampaignId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500">Recipients</span>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {(detailQuery.data.campaign.recipientCount ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500">Sent</span>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {(detailQuery.data.campaign.sentCount ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500">Unique Opens</span>
                <div className="text-sm font-semibold text-emerald-600 mt-0.5">
                  {(detailQuery.data.campaign.uniqueOpens ?? 0).toLocaleString()} ({detailQuery.data.campaign.openRate ?? 0}%)
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500">Unique Clicks</span>
                <div className="text-sm font-semibold text-indigo-600 mt-0.5">
                  {(detailQuery.data.campaign.uniqueClicks ?? 0).toLocaleString()} ({detailQuery.data.campaign.clickRate ?? 0}%)
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCampaignId(null)}
                className="text-xs border-slate-200"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Responsive SVG chart replacing the plain text list for Engagement Activity
 */
function EngagementActivityChart({ data }: { data: TimelineBucket[] }) {
  const [activeMetric, setActiveMetric] = useState<"all" | "sent" | "opens" | "clicks">("all");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Take the last 7 to 14 days
  const recentData = data.slice(-14);

  if (!recentData || recentData.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-slate-400 space-y-2">
        <BarChart2 className="h-8 w-8 text-slate-300 mx-auto" />
        <p className="text-slate-500 font-medium">
          No performance data yet. Send your first campaign to see results.
        </p>
      </div>
    );
  }

  const width = 640;
  const height = 180;
  const paddingX = 36;
  const paddingY = 24;

  const maxVal = Math.max(
    ...recentData.map((d) => Math.max(d.sent, d.opens, d.clicks)),
    5
  );

  const slotWidth = (width - paddingX * 2) / Math.max(1, recentData.length);
  const barWidth = Math.max(4, Math.min(10, slotWidth / 4));

  const hoveredBucket = hoverIndex !== null ? recentData[hoverIndex] : null;

  return (
    <div className="space-y-4">
      {/* Chart Toolbar: Legend + Metric Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-indigo-600 inline-block" />
            <span className="text-slate-600 text-[11px] font-medium">Sent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span className="text-slate-600 text-[11px] font-medium">Opens</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-sky-500 inline-block" />
            <span className="text-slate-600 text-[11px] font-medium">Clicks</span>
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
          {(["all", "sent", "opens", "clicks"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMetric(m)}
              className={`rounded px-2.5 py-0.5 capitalize text-[11px] font-medium transition-colors ${
                activeMetric === m
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none"
          onMouseLeave={() => setHoverIndex(null)}
        >
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
                  x={paddingX - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px] font-mono"
                >
                  {Math.round(maxVal * ratio)}
                </text>
              </g>
            );
          })}

          {/* Bars per bucket */}
          {recentData.map((d, i) => {
            const centerX = paddingX + i * slotWidth + slotWidth / 2;
            const isHovered = hoverIndex === i;

            const sentH = (d.sent / maxVal) * (height - paddingY * 2);
            const opensH = (d.opens / maxVal) * (height - paddingY * 2);
            const clicksH = (d.clicks / maxVal) * (height - paddingY * 2);

            const baseY = height - paddingY;

            return (
              <g
                key={d.date}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              >
                {/* Background hover highlight column */}
                {isHovered && (
                  <rect
                    x={centerX - slotWidth / 2 + 2}
                    y={paddingY}
                    width={slotWidth - 4}
                    height={height - paddingY * 2}
                    fill="#f8fafc"
                    rx="4"
                  />
                )}

                {/* Sent bar */}
                {(activeMetric === "all" || activeMetric === "sent") && (
                  <rect
                    x={activeMetric === "all" ? centerX - barWidth * 1.6 : centerX - barWidth / 2}
                    y={baseY - sentH}
                    width={barWidth}
                    height={Math.max(sentH, d.sent > 0 ? 2 : 0)}
                    fill="#6366f1"
                    rx="2"
                    className="transition-all"
                    opacity={isHovered ? 1 : 0.85}
                  />
                )}

                {/* Opens bar */}
                {(activeMetric === "all" || activeMetric === "opens") && (
                  <rect
                    x={activeMetric === "all" ? centerX - barWidth * 0.5 : centerX - barWidth / 2}
                    y={baseY - opensH}
                    width={barWidth}
                    height={Math.max(opensH, d.opens > 0 ? 2 : 0)}
                    fill="#10b981"
                    rx="2"
                    className="transition-all"
                    opacity={isHovered ? 1 : 0.85}
                  />
                )}

                {/* Clicks bar */}
                {(activeMetric === "all" || activeMetric === "clicks") && (
                  <rect
                    x={activeMetric === "all" ? centerX + barWidth * 0.6 : centerX - barWidth / 2}
                    y={baseY - clicksH}
                    width={barWidth}
                    height={Math.max(clicksH, d.clicks > 0 ? 2 : 0)}
                    fill="#0284c7"
                    rx="2"
                    className="transition-all"
                    opacity={isHovered ? 1 : 0.85}
                  />
                )}

                {/* X-axis date label */}
                <text
                  x={centerX}
                  y={height - 6}
                  textAnchor="middle"
                  className={`text-[9px] font-mono ${
                    isHovered ? "fill-slate-900 font-semibold" : "fill-slate-400"
                  }`}
                >
                  {d.date.length > 5 ? d.date.slice(5) : d.date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip floating box */}
        {hoveredBucket && (
          <div
            className="absolute top-1 pointer-events-none rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-2xs space-y-1 z-10"
            style={{
              left: `${Math.min(
                Math.max(
                  ((paddingX + (hoverIndex ?? 0) * slotWidth + slotWidth / 2) / width) * 100,
                  18
                ),
                82
              )}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1">
              {hoveredBucket.date}
            </div>
            <div className="flex items-center gap-3 text-[11px] pt-0.5">
              <span className="text-indigo-600 font-medium">
                Sent: <strong>{hoveredBucket.sent}</strong>
              </span>
              <span className="text-emerald-600 font-medium">
                Opens: <strong>{hoveredBucket.opens}</strong>
              </span>
              <span className="text-sky-600 font-medium">
                Clicks: <strong>{hoveredBucket.clicks}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
