import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Globe,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  CalendarClock,
  Folder,
  Users,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, EmptyState, SearchInput } from "@/components/common";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { api } from "@/lib/api-client";
import {
  POPULAR_TIMEZONES,
  getBrowserTimezone,
  formatInTimezone,
  formatTimeInTimezone,
  parseLocalToUtcDate,
  getCountdown,
} from "@/lib/date-utils";
import type {
  Campaign,
  ScheduleDetails,
  CalendarScheduleItem,
} from "@/types";

export function ScheduleCenterPage() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuthStore();

  // Active Timezone selection (auto-detects browser timezone)
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => getBrowserTimezone());
  const [viewMode, setViewMode] = useState<"timeline" | "calendar">("timeline");
  const [statusFilter, setStatusFilter] = useState<"all" | "SCHEDULED" | "SENT" | "DRAFT">("all");
  const [timelineSearch, setTimelineSearch] = useState("");
  const [page, setPage] = useState(1);

  // Calendar Month Navigation
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Campaign | null>(null);
  const [unscheduleTarget, setUnscheduleTarget] = useState<Campaign | null>(null);
  const [detailsTargetId, setDetailsTargetId] = useState<string | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Calculate calendar month start and end dates
  const calendarRange = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    // 7 days before month start to cover padding days
    const start = new Date(Date.UTC(year, month - 1, 20)).toISOString();
    // 7 days after month end to cover trailing days
    const end = new Date(Date.UTC(year, month + 1, 10)).toISOString();
    return { start, end, year, month };
  }, [calendarDate]);

  // 1. Fetch Schedule List (for Timeline view & metrics)
  const schedulesQuery = useQuery({
    queryKey: ["schedules", activeWorkspace?.id, statusFilter, page],
    queryFn: () =>
      api.getSchedules({
        page,
        limit: 20,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    enabled: !!activeWorkspace?.id,
    refetchInterval: 30000,
  });

  // 2. Fetch Calendar items
  const calendarQuery = useQuery({
    queryKey: [
      "calendar-schedules",
      activeWorkspace?.id,
      calendarRange.start,
      calendarRange.end,
      selectedTimezone,
    ],
    queryFn: () =>
      api.getCalendarSchedules(
        calendarRange.start,
        calendarRange.end,
        selectedTimezone
      ),
    enabled: !!activeWorkspace?.id,
  });

  // 3. Fetch Draft campaigns for scheduling modal
  const draftCampaignsQuery = useQuery({
    queryKey: ["draft-campaigns", activeWorkspace?.id],
    queryFn: () => api.getCampaigns({ status: "DRAFT", limit: 50 }),
    enabled: scheduleModalOpen && !!activeWorkspace?.id,
  });

  // 4. Fetch Schedule Details
  const detailsQuery = useQuery({
    queryKey: ["schedule-details", detailsTargetId, selectedTimezone],
    queryFn: () => api.getScheduleDetails(detailsTargetId!, selectedTimezone),
    enabled: !!detailsTargetId,
  });

  // Invalidate queries helper
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-schedules"] });
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    if (detailsTargetId) {
      queryClient.invalidateQueries({ queryKey: ["schedule-details", detailsTargetId] });
    }
  };

  // Unschedule mutation
  const unscheduleMutation = useMutation({
    mutationFn: (campaignId: string) => api.unscheduleCampaign(campaignId),
    onSuccess: (data) => {
      setToastMessage({
        type: "success",
        text: `Campaign "${data.name}" unscheduled and returned to Draft. Delayed queue job removed.`,
      });
      setUnscheduleTarget(null);
      if (detailsTargetId === data.id) setDetailsTargetId(null);
      refreshAll();
    },
    onError: (err: any) => {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to unschedule campaign.",
      });
    },
  });

  // Filtered timeline items
  const timelineItems = useMemo(() => {
    const rawItems = schedulesQuery.data?.items || [];
    if (!timelineSearch.trim()) return rawItems;
    const lower = timelineSearch.toLowerCase();
    return rawItems.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.subject.toLowerCase().includes(lower)
    );
  }, [schedulesQuery.data?.items, timelineSearch]);

  const upcomingCount = useMemo(() => {
    return (schedulesQuery.data?.items || []).filter(
      (c) => c.status === "SCHEDULED"
    ).length;
  }, [schedulesQuery.data?.items]);

  // Calendar helpers
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarGrid = useMemo(() => {
    const { year, month } = calendarRange;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: {
      dayNumber: number;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // Today in selected timezone
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: selectedTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    // Padding previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
      days.push({
        dayNumber: dNum,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
      });
    }

    // Trailing next month padding to reach 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
      days.push({
        dayNumber: j,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
      });
    }

    return days;
  }, [calendarRange, selectedTimezone]);

  // Group calendar items by local date key in selected timezone
  const calendarItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarScheduleItem[]>();
    const items = calendarQuery.data?.items || [];

    for (const item of items) {
      try {
        const d = new Date(item.scheduledAt);
        const dateKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: selectedTimezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(d);

        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(item);
      } catch {
        // Fallback
        const fallbackKey = item.scheduledAt.slice(0, 10);
        if (!map.has(fallbackKey)) map.set(fallbackKey, []);
        map.get(fallbackKey)!.push(item);
      }
    }
    return map;
  }, [calendarQuery.data?.items, selectedTimezone]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-xs sm:text-sm font-medium shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Schedule"
        description="Plan and view your upcoming email broadcasts."
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {upcomingCount} Upcoming
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              className="h-9 px-3 gap-1.5 text-xs text-slate-600 hover:text-slate-900 border-slate-200 shadow-2xs"
              title="Refresh Schedule"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  schedulesQuery.isFetching || calendarQuery.isFetching
                    ? "animate-spin text-indigo-600"
                    : ""
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={() => setScheduleModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs gap-1.5 text-xs sm:text-sm font-medium h-9 px-4"
            >
              <Plus className="h-4 w-4" />
              Schedule Campaign
            </Button>
          </div>
        }
      />

      {/* View Switcher & Timezone Toolbar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* View Mode Toggle */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
              viewMode === "timeline"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Timeline View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
              viewMode === "calendar"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar Month
          </button>
        </div>

        {/* Timezone Selector */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1 text-xs">
          <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 font-medium">Timezone:</span>
          <select
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(e.target.value)}
            className="bg-transparent border-none text-slate-900 font-semibold text-xs focus:ring-0 cursor-pointer pr-4"
          >
            {POPULAR_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "timeline" ? (
        /* ========================================================================= */
        /* TIMELINE VIEW                                                             */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Controls Bar: Filter tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Status Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-2xs">
              {[
                { id: "all", label: "All Items" },
                { id: "SCHEDULED", label: "Upcoming Scheduled" },
                { id: "SENT", label: "Sent / Executed" },
                { id: "DRAFT", label: "Drafts" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id as any);
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    statusFilter === tab.id
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="w-full sm:w-64">
              <SearchInput
                value={timelineSearch}
                onChange={(e) => setTimelineSearch(e.target.value)}
                onClear={() => setTimelineSearch("")}
                placeholder="Search schedule..."
              />
            </div>
          </div>

          {/* Timeline Cards Container */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            {schedulesQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <span className="text-sm">Loading scheduled campaigns...</span>
              </div>
            ) : timelineItems.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title={
                  timelineSearch
                    ? "No matching scheduled campaigns"
                    : statusFilter === "SCHEDULED"
                    ? "No upcoming scheduled broadcasts"
                    : "No scheduled campaigns yet"
                }
                description={
                  timelineSearch
                    ? "Try adjusting your search criteria or filter."
                    : "Plan and calendarize your email marketing releases in advance."
                }
                actionLabel="Schedule a Campaign"
                onAction={() => setScheduleModalOpen(true)}
              />
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {timelineItems.map((item) => {
                  const countdown = item.scheduledAt
                    ? getCountdown(item.scheduledAt)
                    : null;
                  const isScheduled = item.status === "SCHEDULED";

                  return (
                    <div key={item.id} className="relative group">
                      {/* Timeline Dot */}
                      <div
                        className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-2xs ${
                          isScheduled
                            ? "bg-indigo-600 ring-2 ring-indigo-100"
                            : item.status === "SENT"
                            ? "bg-emerald-500"
                            : item.status === "SENDING" || item.status === "QUEUED"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-slate-400"
                        }`}
                      />

                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            {/* Title & Template Badge */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-slate-900">
                                {item.name}
                              </span>
                              {item.template && (
                                <span className="rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                                  {item.template.name}
                                </span>
                              )}
                              {isScheduled && countdown && (
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border flex items-center gap-1 ${
                                    countdown.isOverdue
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : countdown.isImminent
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  <Clock className="h-3 w-3" />
                                  {countdown.label}
                                </span>
                              )}
                              {item.googleCalendarEventId && (
                                <span
                                  className="rounded-full px-2.5 py-0.5 text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1"
                                  title="Synchronized with Google Calendar"
                                >
                                  <CalendarIcon className="h-3 w-3 text-blue-600" />
                                  Google Calendar
                                </span>
                              )}
                            </div>

                            {/* Subject preview */}
                            <div className="text-xs text-slate-500 truncate max-w-xl">
                              Subject: <span className="text-slate-700">{item.subject}</span>
                            </div>

                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                              {/* Scheduled Time in Selected Timezone */}
                              {item.scheduledAt ? (
                                <span className="flex items-center gap-1 font-medium text-indigo-600">
                                  <CalendarClock className="h-3.5 w-3.5" />
                                  {formatInTimezone(item.scheduledAt, selectedTimezone)}
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ({new Date(item.scheduledAt).toISOString().replace("T", " ").slice(0, 16)} UTC)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400">No scheduled time set</span>
                              )}

                              <span>&bull;</span>

                              {/* Target Audience / Lists */}
                              <span className="flex items-center gap-1 text-slate-600">
                                <Folder className="h-3 w-3 text-slate-400" />
                                {item.targetListIds && item.targetListIds.length > 0
                                  ? `${item.targetListIds.length} Lists`
                                  : "All Workspace"}
                              </span>

                              <span>&bull;</span>

                              {/* Recipient Count */}
                              <span className="flex items-center gap-1 font-mono text-slate-700">
                                <Users className="h-3 w-3 text-slate-400" />
                                {item.recipientCount.toLocaleString()} recipients
                              </span>

                              {/* BullMQ Job ID Tag */}
                              {item.scheduledJobId && (
                                <>
                                  <span>&bull;</span>
                                  <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    job:{item.scheduledJobId}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={item.status} />

                            {isScheduled ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 px-2.5 border-slate-200 text-slate-700 hover:text-slate-900"
                                  onClick={() => setRescheduleTarget(item)}
                                >
                                  Reschedule
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 px-2.5 border-rose-200 text-rose-600 hover:bg-rose-50"
                                  onClick={() => setUnscheduleTarget(item)}
                                >
                                  Unschedule
                                </Button>
                              </>
                            ) : null}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2 text-slate-500 hover:text-slate-800"
                              onClick={() => setDetailsTargetId(item.id)}
                              title="View Details"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* CALENDAR VIEW                                                             */
        /* ========================================================================= */
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-4">
          {/* Calendar Header with Month Navigation */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-base text-slate-900">
                {monthNames[calendarRange.month]} {calendarRange.year}
              </h2>
              <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(
                      new Date(calendarRange.year, calendarRange.month - 1, 1)
                    )
                  }
                  className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-white"
                  title="Previous Month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date())}
                  className="px-2 py-0.5 text-xs font-medium text-slate-700 hover:text-slate-900 rounded hover:bg-white"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(
                      new Date(calendarRange.year, calendarRange.month + 1, 1)
                    )
                  }
                  className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-white"
                  title="Next Month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                <Globe className="h-3 w-3 text-slate-400" />
                {selectedTimezone}
              </span>
            </div>
          </div>

          {/* 7-Day Column Grid */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {dayLabels.map((day) => (
              <div
                key={day}
                className="font-semibold text-slate-500 py-1 border-b border-slate-100 uppercase tracking-wider text-[11px]"
              >
                {day}
              </div>
            ))}

            {calendarGrid.map((cell) => {
              const dayItems = calendarItemsByDate.get(cell.dateKey) || [];

              return (
                <div
                  key={cell.dateKey}
                  className={`min-h-[96px] rounded-lg border p-1.5 text-left flex flex-col justify-between transition-colors ${
                    cell.isToday
                      ? "border-indigo-300 bg-indigo-50/20 ring-1 ring-indigo-200"
                      : cell.isCurrentMonth
                      ? "border-slate-150 bg-white hover:border-slate-300"
                      : "border-slate-100 bg-slate-50/40 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-semibold ${
                        cell.isToday
                          ? "h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]"
                          : cell.isCurrentMonth
                          ? "text-slate-700"
                          : "text-slate-400"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {dayItems.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  {/* Scheduled items chips */}
                  <div className="space-y-1 mt-1 overflow-y-auto max-h-[72px]">
                    {dayItems.map((item) => {
                      const timeStr = formatTimeInTimezone(
                        item.scheduledAt,
                        selectedTimezone
                      );
                      const isScheduled = item.status === "SCHEDULED";

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDetailsTargetId(item.id)}
                          className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate block border transition-all ${
                            isScheduled
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                              : item.status === "SENT"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                          }`}
                          title={`${item.name} (${timeStr})`}
                        >
                          <span className="font-semibold">{timeStr}</span> {item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SCHEDULE CAMPAIGN MODAL                                          */}
      {/* ========================================================================= */}
      {scheduleModalOpen && (
        <ScheduleCampaignModal
          defaultTimezone={selectedTimezone}
          drafts={draftCampaignsQuery.data?.items || []}
          isLoadingDrafts={draftCampaignsQuery.isLoading}
          onClose={() => setScheduleModalOpen(false)}
          onSuccess={(camp) => {
            setToastMessage({
              type: "success",
              text: `Campaign "${camp.name}" successfully scheduled for delivery via BullMQ!`,
            });
            setScheduleModalOpen(false);
            refreshAll();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RESCHEDULE MODAL                                                 */}
      {/* ========================================================================= */}
      {rescheduleTarget && (
        <RescheduleModal
          campaign={rescheduleTarget}
          defaultTimezone={selectedTimezone}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={(camp) => {
            setToastMessage({
              type: "success",
              text: `Campaign "${camp.name}" rescheduled. BullMQ delayed job updated.`,
            });
            setRescheduleTarget(null);
            refreshAll();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: UNSCHEDULE CONFIRMATION MODAL                                    */}
      {/* ========================================================================= */}
      {unscheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100 shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Unschedule Campaign?
                </h3>
                <p className="text-xs text-slate-500">
                  This will cancel the scheduled broadcast for this campaign.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              Campaign <strong className="text-slate-900">{unscheduleTarget.name}</strong> will
              revert to <strong>DRAFT</strong> status. You can edit or reschedule it at any time.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUnscheduleTarget(null)}
                disabled={unscheduleMutation.isPending}
              >
                Keep Scheduled
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() => unscheduleMutation.mutate(unscheduleTarget.id)}
                disabled={unscheduleMutation.isPending}
              >
                {unscheduleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Yes, Unschedule"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: SCHEDULE DETAILS MODAL                                           */}
      {/* ========================================================================= */}
      {detailsTargetId && (
        <ScheduleDetailsModal
          detailsQuery={detailsQuery}
          selectedTimezone={selectedTimezone}
          onClose={() => setDetailsTargetId(null)}
          onReschedule={(camp) => {
            setDetailsTargetId(null);
            setRescheduleTarget(camp);
          }}
          onUnschedule={(camp) => {
            setDetailsTargetId(null);
            setUnscheduleTarget(camp);
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal for scheduling a campaign
 */
function ScheduleCampaignModal({
  defaultTimezone,
  drafts,
  isLoadingDrafts,
  onClose,
  onSuccess,
}: {
  defaultTimezone: string;
  drafts: Campaign[];
  isLoadingDrafts: boolean;
  onClose: () => void;
  onSuccess: (campaign: Campaign) => void;
}) {
  const [selectedCampaignId, setSelectedCampaignId] = useState(drafts[0]?.id || "");
  const [timezone, setTimezone] = useState(defaultTimezone);

  // Default to tomorrow 10:00 AM
  const tomorrow = new Date(Date.now() + 86400000);
  const defaultDateStr = tomorrow.toISOString().slice(0, 10);
  const [dateStr, setDateStr] = useState(defaultDateStr);
  const [timeStr, setTimeStr] = useState("10:00");

  const [formError, setFormError] = useState<string | null>(null);

  // Synchronize first draft if available
  useEffect(() => {
    if (!selectedCampaignId && drafts.length > 0) {
      setSelectedCampaignId(drafts[0].id);
    }
  }, [drafts, selectedCampaignId]);

  // Compute live UTC conversion & validation
  const previewCalculation = useMemo(() => {
    if (!dateStr || !timeStr || !timezone) return null;
    try {
      const localCombined = `${dateStr}T${timeStr}:00`;
      const utcDate = parseLocalToUtcDate(localCombined, timezone);
      const isPast = utcDate.getTime() <= Date.now();
      const countdown = getCountdown(utcDate);

      return {
        utcIso: utcDate.toISOString(),
        utcFormatted: utcDate.toUTCString(),
        isPast,
        countdownLabel: countdown.label,
      };
    } catch {
      return null;
    }
  }, [dateStr, timeStr, timezone]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaignId) throw new Error("Please select a campaign to schedule.");
      if (!previewCalculation) throw new Error("Invalid date or time selected.");
      if (previewCalculation.isPast) throw new Error("Scheduled time must be in the future.");

      return api.scheduleCampaign(selectedCampaignId, {
        scheduledAt: previewCalculation.utcIso,
        timezone,
      });
    },
    onSuccess: (res) => {
      onSuccess(res);
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to schedule campaign.");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-base">Schedule Campaign Broadcast</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {formError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* 1. Select Campaign */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Select Campaign (Drafts)</label>
          {isLoadingDrafts ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              Loading drafts...
            </div>
          ) : drafts.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-medium">No Draft campaigns found in workspace.</p>
              <p className="text-amber-700">
                Create a campaign in Campaign Manager first before scheduling.
              </p>
            </div>
          ) : (
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — ({d.recipientCount || 0} eligible recipients)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 2. Date & Time Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Date</label>
            <input
              type="date"
              value={dateStr}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Time</label>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* 3. Timezone Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {POPULAR_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Live Preview Box */}
        {previewCalculation && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-indigo-950 font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-indigo-600" />
                Schedule Execution Preview
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-medium border ${
                  previewCalculation.isPast
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200"
                }`}
              >
                {previewCalculation.isPast ? "Error: In the past" : `Fires ${previewCalculation.countdownLabel}`}
              </span>
            </div>

            <div className="space-y-1 text-slate-600 text-[11px]">
              <div>
                <strong>Local:</strong> {dateStr} at {timeStr} ({timezone})
              </div>
              <div className="font-mono text-slate-800">
                <strong>UTC Stored:</strong> {previewCalculation.utcIso}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => scheduleMutation.mutate()}
            disabled={
              drafts.length === 0 ||
              scheduleMutation.isPending ||
              previewCalculation?.isPast
            }
          >
            {scheduleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirm & Schedule"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal for rescheduling an existing scheduled campaign
 */
function RescheduleModal({
  campaign,
  defaultTimezone,
  onClose,
  onSuccess,
}: {
  campaign: Campaign;
  defaultTimezone: string;
  onClose: () => void;
  onSuccess: (campaign: Campaign) => void;
}) {
  const [timezone, setTimezone] = useState(campaign.scheduledTimezone || defaultTimezone);
  const tomorrow = new Date(Date.now() + 86400000);
  const [dateStr, setDateStr] = useState(
    campaign.scheduledAt
      ? new Date(campaign.scheduledAt).toISOString().slice(0, 10)
      : tomorrow.toISOString().slice(0, 10)
  );
  const [timeStr, setTimeStr] = useState("10:00");
  const [formError, setFormError] = useState<string | null>(null);

  const previewCalculation = useMemo(() => {
    if (!dateStr || !timeStr || !timezone) return null;
    try {
      const localCombined = `${dateStr}T${timeStr}:00`;
      const utcDate = parseLocalToUtcDate(localCombined, timezone);
      const isPast = utcDate.getTime() <= Date.now();
      const countdown = getCountdown(utcDate);

      return {
        utcIso: utcDate.toISOString(),
        utcFormatted: utcDate.toUTCString(),
        isPast,
        countdownLabel: countdown.label,
      };
    } catch {
      return null;
    }
  }, [dateStr, timeStr, timezone]);

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!previewCalculation) throw new Error("Invalid date or time selected.");
      if (previewCalculation.isPast) throw new Error("Scheduled time must be in the future.");

      return api.rescheduleCampaign(campaign.id, {
        scheduledAt: previewCalculation.utcIso,
        timezone,
      });
    },
    onSuccess: (res) => {
      onSuccess(res);
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to reschedule campaign.");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-base">Reschedule Campaign</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {formError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
          <div>
            Campaign: <strong className="text-slate-900">{campaign.name}</strong>
          </div>
          <div className="text-slate-500">
            Currently scheduled for:{" "}
            {campaign.scheduledAt
              ? formatInTimezone(campaign.scheduledAt, timezone)
              : "None"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">New Date</label>
            <input
              type="date"
              value={dateStr}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">New Time</label>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {POPULAR_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {previewCalculation && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-indigo-950 font-semibold">
              <span>Updated Delivery Time</span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-medium border ${
                  previewCalculation.isPast
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200"
                }`}
              >
                {previewCalculation.isPast ? "Error: In past" : `Fires ${previewCalculation.countdownLabel}`}
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-700 truncate">
              UTC: {previewCalculation.utcIso}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => rescheduleMutation.mutate()}
            disabled={rescheduleMutation.isPending || previewCalculation?.isPast}
          >
            {rescheduleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirm Reschedule"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Schedule Details Modal / Drawer
 */
function ScheduleDetailsModal({
  detailsQuery,
  selectedTimezone,
  onClose,
  onReschedule,
  onUnschedule,
}: {
  detailsQuery: any;
  selectedTimezone: string;
  onClose: () => void;
  onReschedule: (camp: Campaign) => void;
  onUnschedule: (camp: Campaign) => void;
}) {
  const details = detailsQuery.data as ScheduleDetails | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-base">Schedule Details</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {detailsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span className="text-xs">Loading schedule details...</span>
          </div>
        ) : !details ? (
          <div className="text-xs text-rose-600 p-4">Could not load schedule details.</div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div>
              <h4 className="text-sm font-bold text-slate-900">{details.campaign.name}</h4>
              <p className="text-slate-500 mt-0.5">{details.campaign.subject}</p>
            </div>

            {/* Status & Timing Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div>
                <span className="text-slate-400 text-[11px] block">Status</span>
                <div className="mt-1">
                  <StatusBadge status={details.campaign.status} />
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Queue Engine Job</span>
                <span className="font-mono font-medium text-slate-800 text-[11px] block mt-1 truncate">
                  {details.queueStatus.jobId ? `#${details.queueStatus.jobId}` : "None"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 text-[11px] block">Scheduled Time</span>
                <span className="font-semibold text-indigo-700 text-xs block mt-0.5">
                  {formatInTimezone(details.campaign.scheduledAt, selectedTimezone)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  UTC: {details.campaign.scheduledAt}
                </span>
              </div>
            </div>

            {/* Audience Summary */}
            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-600" />
                Audience & Deliverability Breakdown
              </span>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-emerald-50 rounded p-2 border border-emerald-100">
                  <span className="text-emerald-700 font-bold text-sm block">
                    {details.audienceSummary.totalEligibleActive}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-medium">Eligible Active</span>
                </div>
                <div className="bg-slate-50 rounded p-2 border border-slate-200">
                  <span className="text-slate-700 font-bold text-sm block">
                    {details.audienceSummary.excludedUnsubscribed}
                  </span>
                  <span className="text-[10px] text-slate-500">Unsubscribed</span>
                </div>
                <div className="bg-slate-50 rounded p-2 border border-slate-200">
                  <span className="text-slate-700 font-bold text-sm block">
                    {details.audienceSummary.excludedBounced}
                  </span>
                  <span className="text-[10px] text-slate-500">Bounced</span>
                </div>
              </div>
            </div>

            {/* Sender info */}
            <div className="text-slate-600 text-[11px] space-y-1">
              <div>
                <strong>Sender:</strong> {details.campaign.fromName} &lt;{details.campaign.fromEmail}&gt;
              </div>
              {details.campaign.template && (
                <div>
                  <strong>Template:</strong> {details.campaign.template.name} ({details.campaign.template.category})
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {details.campaign.status === "SCHEDULED" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReschedule(details.campaign)}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => onUnschedule(details.campaign)}
                  >
                    Unschedule
                  </Button>
                </>
              )}
              <Button size="sm" variant="default" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
