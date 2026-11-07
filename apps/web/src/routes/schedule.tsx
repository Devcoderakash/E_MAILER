import { useState } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, EmptyState } from "@/components/common";
import { useHealth } from "@/hooks/use-health";
import type { ScheduledCampaign } from "@/types";

const sampleSchedule: ScheduledCampaign[] = [
  {
    id: "sch-1",
    name: "Customer Onboarding Sequence — Step 1",
    scheduledTime: "Tomorrow, May 8 at 09:00 AM",
    recipientCount: 650,
    targetAudience: "New Signups",
    queueStatus: "queued",
    channel: "Broadcast",
  },
  {
    id: "sch-2",
    name: "Global Security Bulletin & SPF/DKIM Update",
    scheduledTime: "Friday, May 9 at 11:30 AM",
    recipientCount: 5200,
    targetAudience: "All Subscribers",
    queueStatus: "delayed",
    channel: "System Alert",
  },
  {
    id: "sch-3",
    name: "Product Newsletter #43 (Weekly Tech Digest)",
    scheduledTime: "Monday, May 12 at 08:00 AM",
    recipientCount: 3120,
    targetAudience: "Tech Segment",
    queueStatus: "delayed",
    channel: "Newsletter",
  },
  {
    id: "sch-4",
    name: "VIP Early Bird Invitation (Special Event)",
    scheduledTime: "Wednesday, May 14 at 02:00 PM",
    recipientCount: 420,
    targetAudience: "VIP Customers",
    queueStatus: "delayed",
    channel: "Exclusive",
  },
];

export function ScheduleCenterPage() {
  const [scheduleItems] = useState<ScheduledCampaign[]>(sampleSchedule);
  const [viewMode, setViewMode] = useState<"timeline" | "calendar">("timeline");
  const [showEmptyState, setShowEmptyState] = useState(false);
  const { data: health } = useHealth();

  const isRedisConnected =
    health?.dependencies?.redis === "connected" ||
    health?.services?.redis?.status === "connected";

  const displayedList = showEmptyState ? [] : scheduleItems;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule Center"
        description="Calendar and timeline overview of all upcoming automated sends and scheduled broadcasts."
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {scheduleItems.length} Scheduled
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="text-xs text-slate-500 hover:text-indigo-600 underline underline-offset-2 px-2"
            >
              {showEmptyState ? "Show Schedule Items" : "View Empty State"}
            </button>
            <Button
              onClick={() =>
                alert("Campaign scheduler dialog ready for Phase 6 dispatch.")
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2 text-xs sm:text-sm font-medium h-9 px-4"
            >
              <Plus className="h-4 w-4" />
              Schedule Campaign
            </Button>
          </div>
        }
      />

      {/* BullMQ Engine & Queue Status Banner */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">
                BullMQ Delayed Job Engine
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                  isRedisConnected
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isRedisConnected ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                {isRedisConnected ? "Worker Synchronized" : "Standby"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Scheduled tasks run deterministically via BullMQ delayed queues with millisecond precision.
            </p>
          </div>
        </div>

        {/* View Switcher (Timeline / Calendar) */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              viewMode === "timeline"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Timeline View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              viewMode === "calendar"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* Schedule Items List */}
      {displayedList.length > 0 ? (
        viewMode === "timeline" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {displayedList.map((item) => (
                  <div key={item.id} className="relative group">
                    {/* Node Dot */}
                    <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-600 shadow-xs" />

                    <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 hover:bg-slate-50 hover:border-slate-300 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">
                              {item.name}
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                              {item.channel}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium text-indigo-600">
                              <Clock className="h-3.5 w-3.5" />
                              {item.scheduledTime}
                            </span>
                            <span>&bull;</span>
                            <span>
                              Target: <strong className="text-slate-700">{item.targetAudience}</strong>
                            </span>
                            <span>&bull;</span>
                            <span className="font-mono text-slate-700">
                              {item.recipientCount.toLocaleString()} recipients
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={item.queueStatus} />
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2.5 border-slate-200"
                            onClick={() => alert(`Rescheduling ${item.name}`)}
                          >
                            Reschedule
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Calendar Grid Mock */
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-sm text-slate-900">
                May 2026 Schedule
              </h3>
              <span className="text-xs text-slate-500">UTC / System Time</span>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="font-semibold text-slate-400 py-1">
                  {day}
                </div>
              ))}
              {Array.from({ length: 31 }).map((_, i) => {
                const dayNum = i + 1;
                const hasItem = dayNum === 8 || dayNum === 9 || dayNum === 12 || dayNum === 14;

                return (
                  <div
                    key={dayNum}
                    className={`h-20 rounded-lg border p-1.5 text-left flex flex-col justify-between transition-colors ${
                      hasItem
                        ? "border-indigo-200 bg-indigo-50/30"
                        : "border-slate-100 bg-slate-50/20"
                    }`}
                  >
                    <span className="font-mono text-[11px] font-semibold text-slate-600">
                      {dayNum}
                    </span>
                    {hasItem && (
                      <span className="rounded bg-indigo-600 text-white text-[9px] font-medium px-1 py-0.5 truncate block">
                        {dayNum === 8
                          ? "Onboarding (650)"
                          : dayNum === 9
                          ? "Security (5.2k)"
                          : dayNum === 12
                          ? "Digest (3.1k)"
                          : "VIP (420)"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <EmptyState
          icon={CalendarIcon}
          title="No scheduled campaigns"
          description={
            showEmptyState
              ? "There are no campaigns waiting in the queue. Plan your upcoming email releases ahead of time."
              : "No scheduled broadcasts found."
          }
          actionLabel="Schedule First Campaign"
          onAction={() => setShowEmptyState(false)}
        />
      )}
    </div>
  );
}
