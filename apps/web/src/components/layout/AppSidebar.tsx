import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Mail,
  Users,
  Calendar,
  BarChart2,
  Workflow,
  Settings,
  Send,
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
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Campaign Studio", href: "/campaigns", icon: Mail },
  { title: "Reports", href: "/reports", icon: BarChart2 },
  { title: "Contacts", href: "/contacts", icon: Users },
  { title: "Schedule", href: "/schedule", icon: Calendar },
  { title: "Automations", href: "/automations", icon: Workflow },
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
        isCollapsed ? "w-16" : "w-60",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Send className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                MailPilot
              </span>
              <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                Email Platform
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
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? location.pathname === "/" || location.pathname === "/dashboard"
                : item.href === "/campaigns"
                ? location.pathname.startsWith("/campaigns") ||
                  location.pathname.startsWith("/campaign-studio") ||
                  location.pathname.startsWith("/templates")
                : item.href === "/reports"
                ? location.pathname.startsWith("/reports") ||
                  location.pathname.startsWith("/performance") ||
                  location.pathname.startsWith("/analytics")
                : location.pathname.startsWith(item.href);

            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50/80 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.title : undefined}
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
                  <span className="truncate flex-1">{item.title}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
