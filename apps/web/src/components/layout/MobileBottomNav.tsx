import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Mail,
  Users,
  Calendar,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const location = useLocation();

  const navItems = [
    {
      title: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      isActive: location.pathname === "/" || location.pathname === "/dashboard",
    },
    {
      title: "Campaigns",
      href: "/campaigns",
      icon: Mail,
      isActive:
        location.pathname.startsWith("/campaigns") ||
        location.pathname.startsWith("/campaign-studio") ||
        location.pathname.startsWith("/templates"),
    },
    {
      title: "Contacts",
      href: "/contacts",
      icon: Users,
      isActive: location.pathname.startsWith("/contacts"),
    },
    {
      title: "Schedule",
      href: "/schedule",
      icon: Calendar,
      isActive:
        location.pathname.startsWith("/schedule") ||
        location.pathname.startsWith("/schedule-center"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-slate-200/85 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-safe"
    >
      <div className="grid grid-cols-5 items-center h-14 px-1 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center h-full py-1 gap-1 text-[10px] font-medium transition-colors select-none",
                active
                  ? "text-indigo-600 font-semibold"
                  : "text-slate-500 hover:text-slate-900 active:scale-95"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-6 rounded-full transition-all",
                  active ? "bg-indigo-50 text-indigo-600 shadow-2xs" : "text-slate-500"
                )}
              >
                <Icon className={cn("h-4 w-4 transition-transform", active && "scale-110")} />
              </div>
              <span className="truncate leading-none">{item.title}</span>
            </NavLink>
          );
        })}

        {/* More / Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center h-full py-1 gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-900 active:scale-95 transition-colors select-none focus:outline-none"
          aria-label="Open more menu"
        >
          <div className="flex items-center justify-center w-8 h-6 rounded-full text-slate-500">
            <Menu className="h-4 w-4" />
          </div>
          <span className="truncate leading-none">More</span>
        </button>
      </div>
    </nav>
  );
}
