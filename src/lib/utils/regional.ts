"use client";

/**
 * Regional Formatting Utilities
 *
 * Provides locale-aware formatting for numbers, currencies, storage units,
 * and other regional preferences using the Intl API.
 */

export type StorageUnit = "decimal" | "binary"; // GB vs GiB
export type CompactDisplay = "short" | "long";

export interface RegionalPreferences {
  locale: string;
  storageUnit: StorageUnit;
  compactNumbers: boolean;
  firstDayOfWeek: 0 | 1 | 6; // Sunday, Monday, Saturday
  currency: string;
}

const DEFAULT_PREFERENCES: RegionalPreferences = {
  locale: "en-US",
  storageUnit: "decimal",
  compactNumbers: true,
  firstDayOfWeek: 0,
  currency: "USD",
};

/**
 * Get user's regional preferences from localStorage or defaults
 */
export function getRegionalPreferences(): RegionalPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem("regionalPreferences");
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parsing errors
  }

  // Use browser locale as default
  const browserLocale = navigator.language || "en-US";
  return { ...DEFAULT_PREFERENCES, locale: browserLocale };
}

/**
 * Save regional preferences to localStorage
 */
export function saveRegionalPreferences(prefs: Partial<RegionalPreferences>): void {
  if (typeof window === "undefined") return;

  try {
    const current = getRegionalPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem("regionalPreferences", JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Format a number with locale-specific separators
 * e.g., 1234567.89 -> "1,234,567.89" (en-US) or "1.234.567,89" (de-DE)
 */
export function formatNumber(
  value: number,
  options?: {
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  const locale = options?.locale || getRegionalPreferences().locale;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}

/**
 * Format a number in compact notation
 * e.g., 1234 -> "1.2K", 1234567 -> "1.2M"
 */
export function formatCompactNumber(
  value: number,
  options?: {
    locale?: string;
    display?: CompactDisplay;
    maximumFractionDigits?: number;
  }
): string {
  const locale = options?.locale || getRegionalPreferences().locale;

  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: options?.display || "short",
    maximumFractionDigits: options?.maximumFractionDigits ?? 1,
  }).format(value);
}

/**
 * Format a percentage value
 * e.g., 0.1234 -> "12.34%" or 12.34 -> "12.34%"
 */
export function formatPercent(
  value: number,
  options?: {
    locale?: string;
    maximumFractionDigits?: number;
    isDecimal?: boolean; // true if value is already 0-1, false if 0-100
  }
): string {
  const locale = options?.locale || getRegionalPreferences().locale;
  const normalizedValue = options?.isDecimal !== false ? value : value / 100;

  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: options?.maximumFractionDigits ?? 1,
  }).format(normalizedValue);
}

/**
 * Format currency value
 */
export function formatCurrency(
  value: number,
  options?: {
    locale?: string;
    currency?: string;
    compact?: boolean;
  }
): string {
  const prefs = getRegionalPreferences();
  const locale = options?.locale || prefs.locale;
  const currency = options?.currency || prefs.currency;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: options?.compact ? "compact" : "standard",
    maximumFractionDigits: options?.compact ? 1 : 2,
  }).format(value);
}

/**
 * Format bytes into human-readable storage units
 * Supports both decimal (GB, MB) and binary (GiB, MiB) units
 */
export function formatStorage(
  bytes: number,
  options?: {
    locale?: string;
    unit?: StorageUnit;
    precision?: number;
  }
): string {
  const prefs = getRegionalPreferences();
  const locale = options?.locale || prefs.locale;
  const unit = options?.unit || prefs.storageUnit;
  const precision = options?.precision ?? 2;

  if (bytes === 0) return "0 B";

  const isDecimal = unit === "decimal";
  const k = isDecimal ? 1000 : 1024;
  const sizes = isDecimal
    ? ["B", "KB", "MB", "GB", "TB", "PB"]
    : ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  const formattedValue = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  }).format(value);

  return `${formattedValue} ${sizes[i]}`;
}

/**
 * Format bytes with compact notation for large values
 * e.g., 1500000000 -> "1.5 GB" or "1.4 GiB"
 */
export function formatStorageCompact(
  bytes: number,
  options?: {
    locale?: string;
    unit?: StorageUnit;
  }
): string {
  return formatStorage(bytes, { ...options, precision: 1 });
}

/**
 * Get ordinal suffix for a number
 * e.g., 1 -> "1st", 2 -> "2nd", 3 -> "3rd"
 */
export function formatOrdinal(value: number, locale?: string): string {
  const loc = locale || getRegionalPreferences().locale;

  // Use PluralRules for ordinal support
  const pr = new Intl.PluralRules(loc, { type: "ordinal" });
  const suffixes: Record<string, string> = {
    one: "st",
    two: "nd",
    few: "rd",
    other: "th",
  };

  const rule = pr.select(value);
  const suffix = suffixes[rule] || "th";

  return `${formatNumber(value, { locale: loc, maximumFractionDigits: 0 })}${suffix}`;
}

/**
 * Format a list of items with proper locale separators
 * e.g., ["a", "b", "c"] -> "a, b, and c" (en) or "a, b und c" (de)
 */
export function formatList(
  items: string[],
  options?: {
    locale?: string;
    type?: "conjunction" | "disjunction" | "unit";
    style?: "long" | "short" | "narrow";
  }
): string {
  const locale = options?.locale || getRegionalPreferences().locale;

  return new Intl.ListFormat(locale, {
    type: options?.type || "conjunction",
    style: options?.style || "long",
  }).format(items);
}

/**
 * Get the first day of week for a locale
 * Returns 0 (Sunday), 1 (Monday), or 6 (Saturday)
 */
export function getFirstDayOfWeek(locale?: string): 0 | 1 | 6 {
  // Check user preference first
  const prefs = getRegionalPreferences();
  if (prefs.firstDayOfWeek !== undefined) {
    return prefs.firstDayOfWeek;
  }

  // Fallback to locale-based defaults
  const loc = locale || prefs.locale;
  const region = loc.split("-")[1]?.toUpperCase() || "";

  // Countries that start week on Sunday
  const sundayStart = ["US", "CA", "JP", "TW", "KR", "IL", "SA", "AE"];
  // Countries that start week on Saturday
  const saturdayStart = ["BD", "DJ", "IR"];

  if (sundayStart.includes(region)) return 0;
  if (saturdayStart.includes(region)) return 6;
  return 1; // Most countries start on Monday
}

/**
 * Format a number range
 * e.g., 1, 10 -> "1-10" or "1 to 10"
 */
export function formatRange(
  start: number,
  end: number,
  options?: {
    locale?: string;
  }
): string {
  const locale = options?.locale || getRegionalPreferences().locale;

  // Use NumberFormat range if available (newer browsers)
  try {
    const nf = new Intl.NumberFormat(locale);
    if ("formatRange" in nf) {
      return (nf as Intl.NumberFormat & { formatRange: (a: number, b: number) => string }).formatRange(start, end);
    }
  } catch {
    // Fallback
  }

  // Fallback for older browsers
  return `${formatNumber(start, { locale })} - ${formatNumber(end, { locale })}`;
}

/**
 * Get decimal and grouping separators for a locale
 */
export function getNumberSeparators(locale?: string): {
  decimal: string;
  group: string;
} {
  const loc = locale || getRegionalPreferences().locale;
  const parts = new Intl.NumberFormat(loc).formatToParts(1234.5);

  let decimal = ".";
  let group = ",";

  for (const part of parts) {
    if (part.type === "decimal") decimal = part.value;
    if (part.type === "group") group = part.value;
  }

  return { decimal, group };
}
