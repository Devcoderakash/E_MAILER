import { useState } from "react";
import {
  BarChart2,
  Download,
  TrendingUp,
  MailCheck,
  MousePointerClick,
  ShieldCheck,
  Smartphone,
  Monitor,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, DashboardChart, EmptyState } from "@/components/common";

const domainDeliverability = [
  { domain: "Gmail (Google Workspace)", count: "48,200 emails", rate: 99.8, status: "Optimal" },
  { domain: "Microsoft 365 / Outlook", count: "21,400 emails", rate: 99.4, status: "Optimal" },
  { domain: "Apple Mail / iCloud", count: "9,600 emails", rate: 99.6, status: "Optimal" },
  { domain: "Yahoo / AOL", count: "5,720 emails", rate: 98.9, status: "Good" },
];

const topCampaigns = [
  { name: "Summer Product Launch 2026", sent: 4850, openRate: 51.4, clickRate: 18.4 },
  { name: "Weekly Engineering Digest #42", sent: 3120, openRate: 45.6, clickRate: 13.1 },
  { name: "Customer Onboarding Sequence — Step 1", sent: 650, openRate: 64.2, clickRate: 24.8 },
  { name: "Flash Sale 24-Hour Notice", sent: 1200, openRate: 38.9, clickRate: 12.0 },
];

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [showEmptyState, setShowEmptyState] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Performance"
        description="Deep dive into delivery rates, open rates, click-through rates, and recipient engagement."
        badge={
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            99.5% Deliverability Rate
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="text-xs text-slate-500 hover:text-indigo-600 underline underline-offset-2 px-2"
            >
              {showEmptyState ? "Show Analytics" : "View Empty State"}
            </button>

            {/* Time range picker */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              {(["7d", "30d", "90d"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`rounded-md px-2.5 py-1 font-medium uppercase transition-colors ${
                    timeRange === r
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => alert("Exporting CSV report...")}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 text-xs h-9 px-3"
            >
              <Download className="h-3.5 w-3.5" />
              Export Report
            </Button>
          </div>
        }
      />

      {!showEmptyState ? (
        <>
          {/* High-level KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Delivered Rate"
              value="99.5%"
              change="+0.3% vs benchmark"
              trend="up"
              description="84,495 of 84,920 sent"
              icon={ShieldCheck}
              isDemo={true}
            />
            <StatCard
              title="Unique Open Rate"
              value="48.2%"
              change="+4.1% vs industry"
              trend="up"
              description="40,726 unique opens"
              icon={MailCheck}
              isDemo={true}
            />
            <StatCard
              title="Click-to-Open (CTOR)"
              value="30.3%"
              change="+1.8% vs benchmark"
              trend="up"
              description="12,340 link clicks"
              icon={MousePointerClick}
              isDemo={true}
            />
            <StatCard
              title="Unsubscribe Rate"
              value="0.18%"
              change="-0.04% decrease"
              trend="up"
              description="Well below 0.5% threshold"
              icon={TrendingUp}
              isDemo={true}
            />
          </div>

          {/* Interactive Chart */}
          <DashboardChart />

          {/* Deliverability by Domain & Client Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Domain Deliverability */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-semibold text-sm text-slate-900">
                    Deliverability by Mail Provider
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">DKIM / SPF Validated</span>
              </div>

              <div className="space-y-3.5">
                {domainDeliverability.map((item) => (
                  <div key={item.domain} className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{item.domain}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {item.count}
                        </span>
                        <span className="font-semibold text-emerald-600 font-mono">
                          {item.rate}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Client & Device Breakdown */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-semibold text-sm text-slate-900">
                    Recipient Device Distribution
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-center space-y-1">
                  <Smartphone className="h-5 w-5 text-indigo-600 mx-auto" />
                  <div className="text-lg font-bold text-slate-900">58%</div>
                  <div className="text-[11px] text-slate-500">Mobile Devices</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-center space-y-1">
                  <Monitor className="h-5 w-5 text-blue-600 mx-auto" />
                  <div className="text-lg font-bold text-slate-900">36%</div>
                  <div className="text-[11px] text-slate-500">Desktop Clients</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-center space-y-1">
                  <Globe className="h-5 w-5 text-purple-600 mx-auto" />
                  <div className="text-lg font-bold text-slate-900">6%</div>
                  <div className="text-[11px] text-slate-500">Webmail & Other</div>
                </div>
              </div>

              {/* Top Performing Campaigns mini-table */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                  Top Converting Campaigns
                </h4>
                <div className="space-y-2 text-xs">
                  {topCampaigns.map((camp) => (
                    <div
                      key={camp.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70"
                    >
                      <span className="font-medium text-slate-800 truncate max-w-[200px]">
                        {camp.name}
                      </span>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-emerald-600 font-semibold">
                          {camp.openRate}% open
                        </span>
                        <span className="text-indigo-600 font-semibold">
                          {camp.clickRate}% click
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={BarChart2}
          title="No analytics recorded"
          description="Send your first broadcast campaign or trigger an automation sequence to generate performance analytics."
          actionLabel="Send First Campaign"
          onAction={() => setShowEmptyState(false)}
        />
      )}
    </div>
  );
}
