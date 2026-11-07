import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  showShortcut?: boolean;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, showShortcut = true, placeholder = "Search...", ...props }, ref) => {
    const hasValue = Boolean(value);

    return (
      <div className="relative flex items-center w-full">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-14 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {hasValue && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {showShortcut && !hasValue && (
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400">
              <span className="text-xs">⌘</span>K
            </kbd>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

