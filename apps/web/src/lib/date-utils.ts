/**
 * Timezone and Date Utility Functions for Frontend
 */

export const POPULAR_TIMEZONES = [
  { label: "UTC (Coordinated Universal Time)", value: "UTC" },
  { label: "India Standard Time (IST - Asia/Kolkata)", value: "Asia/Kolkata" },
  { label: "Eastern Time (US & Canada - America/New_York)", value: "America/New_York" },
  { label: "Central Time (US & Canada - America/Chicago)", value: "America/Chicago" },
  { label: "Mountain Time (US & Canada - America/Denver)", value: "America/Denver" },
  { label: "Pacific Time (US & Canada - America/Los_Angeles)", value: "America/Los_Angeles" },
  { label: "London (GMT / BST - Europe/London)", value: "Europe/London" },
  { label: "Paris / Berlin / Rome (CET - Europe/Paris)", value: "Europe/Paris" },
  { label: "Dubai (GST - Asia/Dubai)", value: "Asia/Dubai" },
  { label: "Singapore (SGT - Asia/Singapore)", value: "Asia/Singapore" },
  { label: "Tokyo (JST - Asia/Tokyo)", value: "Asia/Tokyo" },
  { label: "Sydney / Melbourne (AEST - Australia/Sydney)", value: "Australia/Sydney" },
  { label: "Auckland (NZST - Pacific/Auckland)", value: "Pacific/Auckland" },
  { label: "Sao Paulo (BRT - America/Sao_Paulo)", value: "America/Sao_Paulo" },
];

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats a UTC date or ISO string in a specified IANA timezone
 */
export function formatInTimezone(
  dateInput: string | Date | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";

  const safeTz = isValidTimezone(timeZone) ? timeZone : "UTC";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
      ...options,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Formats time only in a specified IANA timezone
 */
export function formatTimeInTimezone(
  dateInput: string | Date | null | undefined,
  timeZone: string
): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";

  const safeTz = isValidTimezone(timeZone) ? timeZone : "UTC";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

/**
 * Converts local date + time picker string in an arbitrary IANA timezone into a UTC Date object.
 */
export function parseLocalToUtcDate(datetimeStr: string, timeZone: string): Date {
  const safeTz = isValidTimezone(timeZone) ? timeZone : "UTC";
  const cleanStr = datetimeStr.trim();

  // If already explicit ISO string
  if (/Z|[+-]\d{2}(:?\d{2})?$/i.test(cleanStr)) {
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) throw new Error(`Invalid date format: "${datetimeStr}"`);
    return d;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/.exec(cleanStr);
  if (!match) {
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) throw new Error(`Invalid date format: "${datetimeStr}"`);
    return d;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const min = Number(match[5]);
  const sec = match[6] ? Number(match[6]) : 0;

  const tempUtc = new Date(Date.UTC(year, month - 1, day, hour, min, sec));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(tempUtc);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value;

  const tzYear = Number(getPart("year"));
  const tzMonth = Number(getPart("month"));
  const tzDay = Number(getPart("day"));
  let tzHour = Number(getPart("hour"));
  if (tzHour === 24) tzHour = 0;
  const tzMin = Number(getPart("minute"));
  const tzSec = Number(getPart("second"));

  const tzDateAsUtc = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, tzSec));
  const diffMs = tempUtc.getTime() - tzDateAsUtc.getTime();

  return new Date(tempUtc.getTime() + diffMs);
}

/**
 * Calculates human readable countdown string
 */
export function getCountdown(scheduledAtUtc: string | Date): {
  label: string;
  isOverdue: boolean;
  isImminent: boolean;
  totalMs: number;
} {
  const target = new Date(scheduledAtUtc).getTime();
  const now = Date.now();
  const diffMs = target - now;

  if (diffMs <= 0) {
    return {
      label: "Due now / Pending dispatch",
      isOverdue: true,
      isImminent: true,
      totalMs: diffMs,
    };
  }

  const diffSec = Math.floor(diffMs / 1000);
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);

  if (days > 0) {
    return {
      label: `in ${days}d ${hours}h`,
      isOverdue: false,
      isImminent: false,
      totalMs: diffMs,
    };
  }
  if (hours > 0) {
    return {
      label: `in ${hours}h ${minutes}m`,
      isOverdue: false,
      isImminent: hours < 2,
      totalMs: diffMs,
    };
  }
  return {
    label: `in ${Math.max(1, minutes)}m`,
    isOverdue: false,
    isImminent: true,
    totalMs: diffMs,
  };
}

