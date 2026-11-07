import { useState, useRef, useEffect } from "react";
import { useHealth } from "@/hooks/use-health";
import { Activity, RefreshCw, Server, Database, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

export function HealthStatusPill() {
  const { data: health, isLoading, isError, refetch, isFetching } = useHealth();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const isHealthy =
    !isError &&
    health &&
    (health.status === "healthy" ||
      (health.dependencies?.database === "connected" &&
        health.dependencies?.redis === "connected"));

  const dbStatus =
    health?.dependencies?.database || health?.services?.database?.status || (isError ? "disconnected" : "unknown");
  const redisStatus =
    health?.dependencies?.redis || health?.services?.redis?.status || (isError ? "disconnected" : "unknown");

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
          isLoading
            ? "bg-slate-50 text-slate-500 border-slate-200"
            : isHealthy
            ? "bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60"
            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/60"
        )}
        title="View live backend infrastructure status"
        aria-label="View system health status"
      >
        <span className="relative flex h-2 w-2">
          {isHealthy && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              isLoading
                ? "bg-slate-400"
                : isHealthy
                ? "bg-emerald-500"
                : "bg-rose-500"
            )}
          />
        </span>
        <span className="hidden sm:inline font-mono text-[11px]">
          {isLoading ? "Checking API..." : isHealthy ? "API Live" : "API Degraded"}
        </span>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-50 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-900">
                Backend Services Status
              </span>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              title="Refresh"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isFetching && "animate-spin text-indigo-600")}
              />
            </button>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {/* Express API */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-700 font-medium">Express API</span>
              </div>
              <span
                className={cn(
                  "font-medium text-[11px]",
                  isError ? "text-rose-600" : "text-emerald-600"
                )}
              >
                {isError ? "Offline" : "Healthy (Port 4000)"}
              </span>
            </div>

            {/* Supabase PostgreSQL */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-700 font-medium">PostgreSQL (Prisma)</span>
              </div>
              <span
                className={cn(
                  "font-medium text-[11px] capitalize",
                  dbStatus === "connected" ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {dbStatus}
              </span>
            </div>

            {/* Redis & BullMQ */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-700 font-medium">Redis & BullMQ</span>
              </div>
              <span
                className={cn(
                  "font-medium text-[11px] capitalize",
                  redisStatus === "connected" ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {redisStatus}
              </span>
            </div>
          </div>

          {health?.timestamp && (
            <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between font-mono">
              <span>Updated: {new Date(health.timestamp).toLocaleTimeString()}</span>
              {health.metrics?.uptimeSeconds && (
                <span>Uptime: {health.metrics.uptimeSeconds}s</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
