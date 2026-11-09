import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu, HelpCircle, Search, Moon, Sun, Globe } from "lucide-react";
import { HealthStatusPill } from "./HealthStatusPill";
import { NotificationMenu } from "./NotificationMenu";
import { UserMenu } from "./UserMenu";
import { CommandPalette } from "../common/CommandPalette";
import { usePreferences, translations } from "@/lib/preferences";

interface AppHeaderProps {
  onToggleMobileSidebar: () => void;
}

const pageTitleMap: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/campaigns": "Campaign Studio",
  "/campaign-studio": "Campaign Studio",
  "/reports": "Reports",
  "/performance": "Reports",
  "/analytics": "Reports",
  "/contacts": "Contacts",
  "/templates": "Campaign Studio",
  "/schedule": "Schedule",
  "/schedule-center": "Schedule",
  "/automations": "Automations",
  "/settings": "Settings",
};

export function AppHeader({ onToggleMobileSidebar }: AppHeaderProps) {
  const location = useLocation();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  const { language, setLanguage, theme, toggleTheme } = usePreferences();
  const t = translations[language];

  // Determine current page title
  const path = location.pathname;
  const pageTitle = pageTitleMap[path] || "MailPilot";

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 backdrop-blur-md">
        {/* Left: Mobile Toggle & Clean Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>

          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
            {pageTitle}
          </h1>
        </div>

        {/* Right Controls: Quick Search Bar, Health Warning, Language, Dark Mode, Notifications, User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Mobile Icon-only Search */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex sm:hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors focus:outline-none"
            aria-label="Search"
            title="Search (⌘K)"
          >
            <Search className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {/* Tablet & Desktop Expanded Search with Cmd+K trigger */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 h-9 px-3 w-48 md:w-60 lg:w-64 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white transition-all text-xs text-left"
          >
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate flex-1">{t.searchPlaceholder}</span>
            <kbd className="inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              ⌘K
            </kbd>
          </button>

          {/* Genuine Service Notice (only visible if there is an error) */}
          <HealthStatusPill />

          {/* Language Selector (EN / HI) - visible on tablet and desktop */}
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            className="hidden md:flex h-8 px-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors text-xs font-medium items-center gap-1"
            title="Toggle Language: English / हिन्दी"
            aria-label="Toggle language"
          >
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] uppercase">{language}</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            aria-label="Toggle dark mode"
          >
            {theme === "light" ? (
              <Moon className="h-3.5 w-3.5" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-amber-500" />
            )}
          </button>

          {/* Notifications Popover */}
          <NotificationMenu />

          {/* Help & Support Popover - desktop only */}
          <div className="relative hidden sm:block" ref={helpRef}>
            <button
              type="button"
              onClick={() => setIsHelpOpen(!isHelpOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              aria-label="Help and resources"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {isHelpOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
                <div className="pb-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-900">
                    Help & Support
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tips and keyboard shortcuts.
                  </p>
                </div>

                <div className="py-2 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between py-1">
                    <span>Command Palette</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600">
                      ⌘K / Ctrl+K
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span>Close any modal</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600">
                      Esc
                    </kbd>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <a
                    href="mailto:support@mailpilot.io"
                    className="block text-center text-xs text-indigo-600 font-medium hover:underline py-1"
                  >
                    Contact Support
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* User Account Menu */}
          <UserMenu />
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </>
  );
}
