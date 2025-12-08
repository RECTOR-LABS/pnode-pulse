"use client";

/**
 * Timezone utilities for displaying dates/times in user's local timezone
 */

/**
 * Get the user's timezone from browser
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Format a date in the user's local timezone
 */
export function formatLocalDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = new Date(date);
  const timezone = getUserTimezone();

  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    ...options,
  }).format(d);
}

/**
 * Format time only (e.g., "3:45 PM")
 */
export function formatTime(date: Date | string | number): string {
  return formatLocalDate(date, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format date only (e.g., "Dec 8, 2024")
 */
export function formatDate(date: Date | string | number): string {
  return formatLocalDate(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format date and time (e.g., "Dec 8, 2024, 3:45 PM")
 */
export function formatDateTime(date: Date | string | number): string {
  return formatLocalDate(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffSec) < 60) {
    return rtf.format(-diffSec, "second");
  } else if (Math.abs(diffMin) < 60) {
    return rtf.format(-diffMin, "minute");
  } else if (Math.abs(diffHour) < 24) {
    return rtf.format(-diffHour, "hour");
  } else if (Math.abs(diffDay) < 30) {
    return rtf.format(-diffDay, "day");
  } else {
    return formatDate(date);
  }
}

/**
 * Format duration in human readable form (e.g., "2h 30m", "5d 12h")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Format uptime with appropriate units
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Get timezone offset string (e.g., "UTC-5", "UTC+8")
 */
export function getTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset();
  const hours = Math.abs(Math.floor(offset / 60));
  const sign = offset <= 0 ? "+" : "-";
  return `UTC${sign}${hours}`;
}

/**
 * Get readable timezone name (e.g., "Eastern Standard Time")
 */
export function getTimezoneName(): string {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "long",
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value ?? getUserTimezone();
  } catch {
    return getUserTimezone();
  }
}

/**
 * Format a timestamp for charts (short format)
 */
export function formatChartTime(date: Date | string | number, range: "1h" | "24h" | "7d" | "30d"): string {
  const d = new Date(date);

  switch (range) {
    case "1h":
      return formatLocalDate(d, { hour: "numeric", minute: "2-digit" });
    case "24h":
      return formatLocalDate(d, { hour: "numeric", minute: "2-digit" });
    case "7d":
      return formatLocalDate(d, { weekday: "short", hour: "numeric" });
    case "30d":
      return formatLocalDate(d, { month: "short", day: "numeric" });
    default:
      return formatLocalDate(d, { month: "short", day: "numeric" });
  }
}
