import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Mail,
  Users,
  FileText,
  Calendar,
  BarChart2,
  Workflow,
  Settings,
  Send,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useState } from "react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Campaigns", href: "/campaigns", icon: Mail, badge: "New" },
  { title: "Contacts", href: "/contacts", icon: Users },
  { title: "Templates", href: "/templates", icon: FileText },
  { title: "Schedule Center", href: "/schedule", icon: Calendar },
  { title: "Analytics", href: "/analytics", icon: BarChart2 },
  { title: "Automation Builder", href: "/automations", icon: Workflow },
  { title: "Settings", href: "/settings", icon: Settings },
];

interface AppSidebarProps {
  className?: string;
  onCloseMobile?: () => void;
}

export function AppSidebar({ className, onCloseMobile }: AppSidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-slate-200/80 bg-white transition-all duration-200 ease-in-out select-none",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Send className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold tracking-tight text-slate-900 leading-none">
                MailPilot
              </span>
              <span className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">
                Email SaaS
              </span>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Workspace Switcher */}
      {!isCollapsed && (
        <div className="p-3 border-b border-slate-100">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {!isCollapsed && (
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Platform
          </div>
        )}

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? location.pathname === "/" || location.pathname === "/dashboard"
                : location.pathname.startsWith(item.href);

            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onCloseMobile}
                title={isCollapsed ? item.title : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150",
                  isActive
                    ? "bg-indigo-50/80 text-indigo-700 font-semibold shadow-xs"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-indigo-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                {!isCollapsed && (
                  <div className="flex flex-1 items-center justify-between">
                    <span>{item.title}</span>
                    {item.badge && !isActive && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Area */}
      <div className="p-3 border-t border-slate-200/80 space-y-1">
        {!isCollapsed ? (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700">
                Phase 2 Dashboard
              </span>
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              Backend PostgreSQL, Redis & Express API integration verified.
            </p>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <HelpCircle className="h-4 w-4 text-slate-400" />
          </div>
        )}
      </div>
    </aside>
  );
}
