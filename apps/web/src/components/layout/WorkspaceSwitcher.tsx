import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { api } from "@/lib/api-client";
import type { Workspace } from "@/types";

export function WorkspaceSwitcher() {
  const { activeWorkspace, workspaces, setActiveWorkspace, setWorkspaces } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSwitchWorkspace = async (ws: Workspace) => {
    if (ws.id === activeWorkspace?.id) {
      setIsOpen(false);
      return;
    }

    try {
      setLoading(true);
      await api.switchWorkspace(ws.id);
      setActiveWorkspace(ws);
      setIsOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to switch workspace.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      setLoading(true);
      const res = await api.createWorkspace(newWsName.trim());
      const newWs = res.workspace;

      setWorkspaces([...workspaces, newWs]);
      setActiveWorkspace(newWs);
      setNewWsName("");
      setIsCreating(false);
      setIsOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to create workspace.");
    } finally {
      setLoading(false);
    }
  };

  const currentWorkspaceName = activeWorkspace?.name || "Default Workspace";
  const initials = currentWorkspaceName.substring(0, 2).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left transition-colors hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white text-xs font-bold shadow-xs">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900 leading-tight">
              {currentWorkspaceName}
            </p>
            <p className="truncate text-[10px] text-slate-500 font-medium leading-tight capitalize">
              {activeWorkspace?.role || "Owner"}
            </p>
          </div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Workspaces
          </div>

          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                disabled={loading}
                onClick={() => handleSwitchWorkspace(ws)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors",
                  ws.id === activeWorkspace?.id
                    ? "bg-indigo-50/70 text-indigo-900 font-medium"
                    : "text-slate-700 hover:bg-slate-100/70"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-600 text-white text-[10px] font-bold">
                    {ws.name.substring(0, 1).toUpperCase()}
                  </div>
                  <span className="truncate">{ws.name}</span>
                </div>
                {ws.id === activeWorkspace?.id && (
                  <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="my-1.5 border-t border-slate-100" />

          {isCreating ? (
            <form onSubmit={handleCreateWorkspace} className="p-1 space-y-2">
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="Workspace name..."
                autoFocus
                disabled={loading}
                className="w-full h-7 rounded border border-slate-200 px-2 text-xs focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={loading}
                  className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newWsName.trim()}
                  className="px-2 py-0.5 text-[11px] bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-slate-400" />
              <span>Create Workspace</span>
            </button>
          )}

          <div className="mt-1 pt-1.5 border-t border-slate-100">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-500">
              <Sparkles className="h-3 w-3 text-indigo-500" />
              <span className="capitalize">{activeWorkspace?.role || "Member"} Access</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
