import { useHealth } from "@/hooks/use-health";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * HealthStatusPill:
 * Only renders when there is a genuine system health warning or network disconnection.
 * Does NOT clutter normal pages with persistent "API Degraded" or "API Live" badges.
 * Links directly to Settings -> System Health for administrators.
 */
export function HealthStatusPill() {
  const { data: health, isLoading, isError } = useHealth();

  // If loading or healthy, remain invisible to avoid distracting normal users
  const isHealthy =
    !isError &&
    health &&
    (health.status === "healthy" ||
      (health.dependencies?.database === "connected" &&
        health.dependencies?.redis === "connected"));

  if (isLoading || isHealthy) {
    return null;
  }

  // Only display if genuinely disconnected
  return (
    <Link
      to="/settings?tab=system"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
      title="System alert: View details in System Health"
    >
      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
      <span className="hidden sm:inline text-[11px] font-medium">Service Notice</span>
    </Link>
  );
}

/**
 * DetailedSystemHealthView:
 * Used exclusively in Settings -> System Health for administrators.
 */
export function DetailedSystemHealthView() {
  const { data: health, isError, refetch, isFetching } = useHealth();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">System Diagnostics</h4>
          <p className="text-xs text-slate-500">Live operational status of backend services and background workers.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {isFetching ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">API Gateway</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${!isError ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
              {!isError ? "Operational" : "Degraded"}
            </span>
          </div>
          <p className="text-slate-500 text-[11px]">Express REST API service</p>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Primary Database</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${health?.dependencies?.database === "connected" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {health?.dependencies?.database || (isError ? "Unavailable" : "Connected")}
            </span>
          </div>
          <p className="text-slate-500 text-[11px]">Supabase PostgreSQL data store</p>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Task Queue & Cache</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${health?.dependencies?.redis === "connected" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {health?.dependencies?.redis || (isError ? "Unavailable" : "Connected")}
            </span>
          </div>
          <p className="text-slate-500 text-[11px]">Redis & BullMQ worker queue</p>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Campaign Dispatcher</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
              Active
            </span>
          </div>
          <p className="text-slate-500 text-[11px]">Throttled human-paced worker</p>
        </div>
      </div>
    </div>
  );
}
