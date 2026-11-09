import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  Mail,
  BarChart2,
  Users,
  Calendar,
  Workflow,
  Settings,
  Plus,
  Upload,
  FileText,
  X,
} from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: "Navigation" | "Quick Actions";
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    {
      id: "create-campaign",
      title: "Create Campaign",
      description: "Start drafting a new email campaign",
      icon: Plus,
      category: "Quick Actions",
      action: () => {
        navigate("/campaigns?action=create");
        onClose();
      },
    },
    {
      id: "import-contacts",
      title: "Import Contacts",
      description: "Upload a CSV of subscribers",
      icon: Upload,
      category: "Quick Actions",
      action: () => {
        navigate("/contacts?action=import");
        onClose();
      },
    },
    {
      id: "browse-templates",
      title: "Email Templates",
      description: "Browse and customize starter email templates",
      icon: FileText,
      category: "Quick Actions",
      action: () => {
        navigate("/campaigns?tab=templates");
        onClose();
      },
    },
    {
      id: "nav-dashboard",
      title: "Dashboard",
      description: "Overview of your workspace performance",
      icon: LayoutDashboard,
      category: "Navigation",
      action: () => {
        navigate("/");
        onClose();
      },
    },
    {
      id: "nav-campaigns",
      title: "Campaign Studio",
      description: "View and manage all email campaigns",
      icon: Mail,
      category: "Navigation",
      action: () => {
        navigate("/campaigns");
        onClose();
      },
    },
    {
      id: "nav-reports",
      title: "Reports & Analytics",
      description: "Review open, click, and unsubscribe metrics",
      icon: BarChart2,
      category: "Navigation",
      action: () => {
        navigate("/reports");
        onClose();
      },
    },
    {
      id: "nav-contacts",
      title: "Contacts & Audience",
      description: "Manage subscriber lists, tags, and contacts",
      icon: Users,
      category: "Navigation",
      action: () => {
        navigate("/contacts");
        onClose();
      },
    },
    {
      id: "nav-schedule",
      title: "Schedule",
      description: "Timeline and calendar of planned dispatches",
      icon: Calendar,
      category: "Navigation",
      action: () => {
        navigate("/schedule");
        onClose();
      },
    },
    {
      id: "nav-automations",
      title: "Automations",
      description: "Automated trigger-action email workflows",
      icon: Workflow,
      category: "Navigation",
      action: () => {
        navigate("/automations");
        onClose();
      },
    },
    {
      id: "nav-settings",
      title: "Settings",
      description: "Workspace profile, SMTP, and integrations",
      icon: Settings,
      category: "Navigation",
      action: () => {
        navigate("/settings");
        onClose();
      },
    },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filtered, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center px-4 py-3 border-b border-slate-100">
          <Search className="h-4 w-4 text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length > 0 ? (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected ? "bg-indigo-50 text-indigo-900" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">{cmd.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{cmd.description}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                    {cmd.category}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching commands found.
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span>Use <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↓</kbd> to navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">Enter</kbd> to select</span>
          </div>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
