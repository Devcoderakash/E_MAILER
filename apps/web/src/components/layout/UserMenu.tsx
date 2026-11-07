import { useState, useRef, useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
import { User, Settings, Key, BookOpen, LogOut, ShieldCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/use-auth-store";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { user, profile, activeWorkspace, signOut } = useAuthStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  };

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || profile?.email || "";
  const role = activeWorkspace?.role ? `${activeWorkspace.role.toUpperCase()}` : (profile?.role || "Member");

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-indigo-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        aria-label="User account menu"
      >
        <Avatar
          fallback={initials || "U"}
          className="h-8 w-8 border border-slate-200 bg-indigo-600 text-white font-semibold text-xs shadow-xs"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
          {/* User Profile Header */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-900 leading-tight truncate">
              {displayName}
            </p>
            <p className="text-[11px] text-slate-500 leading-tight truncate mt-0.5">
              {email}
            </p>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              <ShieldCheck className="h-3 w-3 text-indigo-600" />
              <span>{role}</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/settings");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-700 hover:bg-slate-100/70 transition-colors"
            >
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>Account & Profile</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/settings");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-700 hover:bg-slate-100/70 transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Workspace Settings</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/settings");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-700 hover:bg-slate-100/70 transition-colors"
            >
              <Key className="h-3.5 w-3.5 text-slate-400" />
              <span>API Keys & Webhooks</span>
            </button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-700 hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                <span>Documentation</span>
              </div>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          </div>

          <div className="my-1 border-t border-slate-100" />

          {/* Sign Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-medium"
          >
            <LogOut className="h-3.5 w-3.5 text-rose-500" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
