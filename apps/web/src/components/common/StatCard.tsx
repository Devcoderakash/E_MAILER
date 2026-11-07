import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  isDemo?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  trend = "neutral",
  description,
  icon: Icon,
  isDemo = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:border-slate-300 hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {title}
            </span>
            {isDemo && (
              <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200/60">
                Preview
              </span>
            )}
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50/80 text-indigo-600 border border-indigo-100/60">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {(change || description) && (
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {change && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                trend === "up" && "text-emerald-600",
                trend === "down" && "text-rose-600",
                trend === "neutral" && "text-slate-500"
              )}
            >
              {trend === "up" && <TrendingUp className="h-3.5 w-3.5" />}
              {trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
              {trend === "neutral" && <Minus className="h-3.5 w-3.5" />}
              {change}
            </span>
          )}
          {description && (
            <span className="text-slate-500 truncate">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}

