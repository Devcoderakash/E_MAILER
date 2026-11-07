import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Menu, HelpCircle, ExternalLink, ChevronRight, BookOpen, Terminal, Sparkles } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { HealthStatusPill } from "./HealthStatusPill";
import { NotificationMenu } from "./NotificationMenu";
import { UserMenu } from "./UserMenu";

interface AppHeaderProps {
  onToggleMobileSidebar: () => void;
}

const pageTitleMap: Record<string, { title: string; breadcrumb: string }> = {
  "/": { title: "Overview", breadcrumb: "Dashboard" },
  "/dashboard": { title: "Overview", breadcrumb: "Dashboard" },
  "/campaigns": { title: "Campaigns", breadcrumb: "Broadcasts" },
  "/contacts": { title: "Contacts", breadcrumb: "Audience" },
  "/templates": { title: "Templates", breadcrumb: "Design" },
  "/schedule": { title: "Schedule Center", breadcrumb: "Timeline" },
  "/analytics": { title: "Analytics", breadcrumb: "Reports" },
  "/automations": { title: "Automation Builder", breadcrumb: "Workflows" },
  "/settings": { title: "Settings", breadcrumb: "Workspace" },
};

export function AppHeader({ onToggleMobileSidebar }: AppHeaderProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  // Determine current page info
  const path = location.pathname;
  const pageInfo =
    pageTitleMap[path] || {
      title: path.replace("/", "").replace("-", " "),
      breadcrumb: "MailPilot",
    };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(event.target as Node)) {
        setIsHelpOpen(false);
      }
    }
    if (isHelpOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isHelpOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Toggle & Page Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 text-xs">
          <Link
            to="/"
            className="text-slate-400 hover:text-slate-700 transition-colors hidden sm:inline"
          >
            MailPilot
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 hidden sm:inline" />
          <span className="text-slate-400 hidden sm:inline">{pageInfo.breadcrumb}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 hidden sm:inline" />
          <span className="font-semibold text-slate-900 truncate">
            {pageInfo.title}
          </span>
        </div>
      </div>

      {/* Right Controls: Search, Live Health, Notifications, Help, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search Bar */}
        <div className="w-36 sm:w-56 md:w-64">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Search campaigns, contacts..."
          />
        </div>

        {/* Live API / DB / Redis Status Pill */}
        <HealthStatusPill />

        {/* Notifications Popover */}
        <NotificationMenu />

        {/* Help & Resources Popover */}
        <div className="relative" ref={helpRef}>
          <button
            type="button"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Help and resources"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {isHelpOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
              <div className="pb-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">
                  Help & Documentation
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Guides, API references, and keyboard shortcuts.
                </p>
              </div>

              <div className="py-2 space-y-1">
                <a
                  href="#docs"
                  onClick={() => setIsHelpOpen(false)}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Getting Started Guide</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>

                <a
                  href="#api"
                  onClick={() => setIsHelpOpen(false)}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-indigo-600" />
                    <span>API Reference & Webhooks</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>

                <a
                  href="#features"
                  onClick={() => setIsHelpOpen(false)}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span>What's new in MailPilot</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                Need priority help? Reach out at support@mailpilot.io
              </div>
            </div>
          )}
        </div>

        {/* User Account Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
