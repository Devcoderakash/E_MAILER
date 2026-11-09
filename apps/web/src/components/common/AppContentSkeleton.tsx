import { useState, useEffect } from "react";
import { TopProgressBar } from "./TopProgressBar";

interface AppContentSkeletonProps {
  layout?: "dashboard" | "table" | "detail";
  customMessage?: string;
}

export function AppContentSkeleton({
  layout: _layout = "dashboard",
  customMessage,
}: AppContentSkeletonProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  // 1. Under 300ms: Render nothing to prevent jarring layout flash
  if (elapsedMs < 300) {
    return null;
  }

  // 2. Dynamic human-friendly message based on elapsed duration
  let progressiveNotice: string | null = null;
  let isServerWakeup = false;

  if (elapsedMs >= 10000) {
    progressiveNotice =
      "Server shuru ho raha hai, 30 sec tak lag sakte hain (Render sleep mode)";
    isServerWakeup = true;
  } else if (elapsedMs >= 3000) {
    progressiveNotice = customMessage || "Thoda time lag raha hai...";
  }

  return (
    <>
      {/* 2px Top Indigo Progress Bar */}
      <TopProgressBar />

      <div className="space-y-6 animate-in fade-in duration-200" aria-busy="true">
        {/* Progressive Human Status Notice */}
        {progressiveNotice && (
          <div
            className={`flex items-center justify-between px-3.5 py-2 rounded-lg text-xs transition-all ${
              isServerWakeup
                ? "bg-amber-50/80 border border-amber-200/80 text-amber-800"
                : "bg-slate-100/70 text-slate-500"
            }`}
          >
            <span>{progressiveNotice}</span>
            <span className="font-mono text-[10px] opacity-75">
              {Math.floor(elapsedMs / 1000)}s
            </span>
          </div>
        )}

        {/* 1. Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-2">
            <div className="h-6 w-44 rounded-lg bg-slate-200/80 animate-pulse" />
            <div className="h-3.5 w-64 rounded-md bg-slate-200/60 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-lg bg-slate-200/60 animate-pulse" />
            <div className="h-8 w-32 rounded-lg bg-slate-200/80 animate-pulse" />
          </div>
        </div>

        {/* 2. Four KPI Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200/70 bg-white p-5 space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-20 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-7 w-7 rounded-lg bg-slate-200/60 animate-pulse" />
              </div>
              <div className="h-7 w-28 rounded-md bg-slate-200/80 animate-pulse" />
              <div className="h-3 w-36 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>

        {/* 3. Main Content / Data Table Skeleton */}
        <div className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="h-4 w-32 rounded bg-slate-200/70 animate-pulse" />
            <div className="h-7 w-48 rounded-lg bg-slate-200/50 animate-pulse" />
          </div>

          {/* Table Row Placeholders */}
          <div className="space-y-3 pt-1">
            {[1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50/60 space-x-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div
                    className="h-3.5 rounded bg-slate-200/70 animate-pulse"
                    style={{ width: `${60 - row * 6}%` }}
                  />
                  <div
                    className="h-2.5 rounded bg-slate-200/40 animate-pulse"
                    style={{ width: `${80 - row * 8}%` }}
                  />
                </div>
                <div className="h-5 w-16 rounded-full bg-slate-200/60 animate-pulse shrink-0" />
                <div className="h-4 w-12 rounded bg-slate-200/50 animate-pulse shrink-0 hidden sm:block" />
                <div className="h-6 w-16 rounded-md bg-slate-200/40 animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
