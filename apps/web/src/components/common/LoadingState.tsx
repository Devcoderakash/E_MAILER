import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  className?: string;
  rows?: number;
}

export function LoadingState({
  message = "Loading...",
  className,
  rows = 3,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-slate-200/80 bg-white/60",
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mb-3" />
      <p className="text-xs font-medium text-slate-500">{message}</p>
      {rows > 0 && (
        <div className="w-full max-w-md mt-6 space-y-2.5">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-slate-100 rounded-md animate-pulse"
              style={{ width: `${85 - i * 15}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

