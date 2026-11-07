/**
 * Timezone and Date Utility for MailPilot Scheduling Engine
 * Fully compliant with IANA timezones and Daylight Saving Time.
 */

export const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

/**
 * Validates whether a given string is a valid IANA timezone identifier.
 */
export function isValidTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a date/time string in a specified IANA timezone to a UTC Date object.
 * 
 * Supports:
 * - Local ISO strings like "2026-05-15T14:30:00" or "2026-05-15T14:30"
 * - Full ISO strings with timezone offsets (e.g. "2026-05-15T14:30:00+05:30" or "2026-05-15T09:00:00.000Z")
 */
export function parseLocalToUtcDate(datetimeStr: string, timeZone: string): Date {
  if (!isValidTimezone(timeZone)) {
    throw new Error(`Invalid IANA timezone: "${timeZone}"`);
  }

  const cleanStr = datetimeStr.trim();

  // If already an explicit ISO string with UTC 'Z' or offset (+HH:MM / -HH:MM)
  if (/Z|[+-]\d{2}(:?\d{2})?$/i.test(cleanStr)) {
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date format: "${datetimeStr}"`);
    }
    return d;
  }

  // Parse local components "YYYY-MM-DDTHH:mm(:ss)?"
  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/.exec(cleanStr);
  if (!match) {
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date format: "${datetimeStr}". Expected YYYY-MM-DDTHH:mm`);
    }
    return d;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const min = Number(match[5]);
  const sec = match[6] ? Number(match[6]) : 0;

  // Initial candidate in UTC
  const tempUtc = new Date(Date.UTC(year, month - 1, day, hour, min, sec));

  // Determine how tempUtc is rendered in the specified target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
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
 * Formats a UTC Date object in a specific IANA timezone.
 */
export function formatInTimezone(
  date: Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isValidTimezone(timeZone)) {
    timeZone = "UTC";
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    ...options,
  };

  return new Intl.DateTimeFormat("en-US", defaultOptions).format(date);
}

