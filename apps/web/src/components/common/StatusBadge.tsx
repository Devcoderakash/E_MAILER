import { cn } from "@/lib/utils";

export type StatusVariant =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "failed"
  | "active"
  | "unsubscribed"
  | "bounced"
  | "pending"
  | "connected"
  | "disconnected"
  | "healthy"
  | "unhealthy";

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  className?: string;
  showDot?: boolean;
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  sent: {
    label: "Sent",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  healthy: {
    label: "Healthy",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  connected: {
    label: "Connected",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  active: {
    label: "Active",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  scheduled: {
    label: "Scheduled",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200/80",
    dot: "bg-blue-500",
  },
  sending: {
    label: "Sending",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200/80",
    dot: "bg-indigo-500 animate-pulse",
  },
  draft: {
    label: "Draft",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  paused: {
    label: "Paused",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200/80",
    dot: "bg-amber-500",
  },
  pending: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200/80",
    dot: "bg-amber-500",
  },
  failed: {
    label: "Failed",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/80",
    dot: "bg-rose-500",
  },
  unhealthy: {
    label: "Unhealthy",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/80",
    dot: "bg-rose-500",
  },
  disconnected: {
    label: "Disconnected",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/80",
    dot: "bg-rose-500",
  },
  bounced: {
    label: "Bounced",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/80",
    dot: "bg-rose-500",
  },
  unsubscribed: {
    label: "Unsubscribed",
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

export function StatusBadge({
  status,
  label,
  className,
  showDot = true,
}: StatusBadgeProps) {
  const normalizedKey = status.toLowerCase();
  const config = statusConfig[normalizedKey] || {
    label: status,
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {showDot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)}
          aria-hidden="true"
        />
      )}
      <span>{label || config.label}</span>
    </span>
  );
}

