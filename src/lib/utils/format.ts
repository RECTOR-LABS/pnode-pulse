/**
 * Formatting utilities
 *
 * All formatters handle null/undefined gracefully for v0.7.0 transition nodes
 * that may return incomplete data.
 */

/**
 * Format bytes to human readable string
 * Returns "N/A" for null/undefined values
 */
export function formatBytes(bytes: number | bigint | null | undefined): string {
  if (bytes === null || bytes === undefined) return "N/A";

  const num = typeof bytes === "bigint" ? Number(bytes) : bytes;

  if (num === 0) return "0 B";
  if (!isFinite(num) || num < 0) return "N/A";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const k = 1024;
  const i = Math.floor(Math.log(num) / Math.log(k));

  return `${(num / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format uptime in seconds to human readable string
 * Returns "N/A" for null/undefined values
 */
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "N/A";
  if (!isFinite(seconds) || seconds < 0) return "N/A";

  if (seconds < 60) return `${Math.round(seconds)}s`;

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Format percentage with fixed decimals
 * Returns "N/A" for null/undefined values
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "N/A";
  if (!isFinite(value)) return "N/A";

  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with commas
 * Returns "N/A" for null/undefined values
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  if (!isFinite(value)) return "N/A";

  return new Intl.NumberFormat().format(value);
}

/**
 * Format relative time
 * Returns "N/A" for null/undefined/invalid dates
 */
export function formatRelativeTime(date: Date | null | undefined): string {
  if (date === null || date === undefined) return "N/A";
  if (!(date instanceof Date) || isNaN(date.getTime())) return "N/A";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return "just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return `${Math.floor(diffSecs / 86400)}d ago`;
}

/**
 * Format IP address (truncate for display)
 * Returns "Unknown" for null/undefined values
 */
export function formatAddress(address: string | null | undefined): string {
  if (address === null || address === undefined || address === "") return "Unknown";
  if (!address.includes(":")) return address;
  return address.split(":")[0];
}

/**
 * Format version string
 * Returns "Unknown" for null/undefined values
 */
export function formatVersion(version: string | null | undefined): string {
  if (version === null || version === undefined || version === "") return "Unknown";
  return version.startsWith("v") ? version : `v${version}`;
}
