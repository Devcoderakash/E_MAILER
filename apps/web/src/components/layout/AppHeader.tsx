import { useState, useEffect } from "react";
import { Menu, Search } from "lucide-react";
import { NotificationMenu } from "./NotificationMenu";
import { UserMenu } from "./UserMenu";
import { CommandPalette } from "../common/CommandPalette";
import { usePreferences, translations } from "@/lib/preferences";

interface AppHeaderProps {
  onToggleMobileSidebar: () => void;
}

export function AppHeader({ onToggleMobileSidebar }: AppHeaderProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { language } = usePreferences();
  const t = translations[language];

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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 backdrop-blur-md">
        {/* Left: Mobile Sidebar Toggle only (Page title kept only on page heading) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Right Controls: Top bar keeps only Search, Notifications, and Avatar Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
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

          {/* Notifications Popover */}
          <NotificationMenu />

          {/* User Account Menu (Includes Appearance & Language) */}
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
