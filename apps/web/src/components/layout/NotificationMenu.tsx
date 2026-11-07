import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, Mail, Database, Users, Cpu, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: "campaign" | "database" | "contacts" | "queue";
}

const initialNotifications: Notification[] = [
  {
    id: "notif-1",
    title: "Campaign Scheduled",
    description: "'Product Launch 2026' queued for broadcast at 09:00 AM.",
    time: "10m ago",
    read: false,
    type: "campaign",
  },
  {
    id: "notif-2",
    title: "PostgreSQL Database Pooler",
    description: "Supabase transaction pooler latency optimal (4ms).",
    time: "25m ago",
    read: false,
    type: "database",
  },
  {
    id: "notif-3",
    title: "Audience Import Complete",
    description: "Imported 340 contacts into 'Early Adopters' segment.",
    time: "2h ago",
    read: true,
    type: "contacts",
  },
  {
    id: "notif-4",
    title: "BullMQ Worker Synchronized",
    description: "Redis background worker processed test queue job successfully.",
    time: "5h ago",
    read: true,
    type: "queue",
  },
];

export function NotificationMenu() {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

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

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "campaign":
        return <Mail className="h-3.5 w-3.5 text-indigo-600" />;
      case "database":
        return <Database className="h-3.5 w-3.5 text-emerald-600" />;
      case "contacts":
        return <Users className="h-3.5 w-3.5 text-blue-600" />;
      case "queue":
        return <Cpu className="h-3.5 w-3.5 text-purple-600" />;
      default:
        return <Bell className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        aria-label="View notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                  title="Clear all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto divide-y divide-slate-100 space-y-1">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                    notif.read
                      ? "hover:bg-slate-50/70 opacity-75"
                      : "bg-indigo-50/30 hover:bg-indigo-50/60"
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 shadow-xs mt-0.5">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {notif.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                      {notif.description}
                    </p>
                  </div>
                  {!notif.read && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0 mt-2" />
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                <Check className="h-6 w-6 mx-auto mb-1.5 text-slate-300" />
                No notifications right now
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

