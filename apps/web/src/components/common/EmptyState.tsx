import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-14 text-center transition-all",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50/80 text-indigo-600 border border-indigo-100 shadow-sm mb-4">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel || children) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            <Button
              onClick={onAction}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 px-4 text-xs font-medium"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              className="h-9 px-4 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {secondaryActionLabel}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

