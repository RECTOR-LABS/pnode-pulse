/**
 * Mirrored Prisma enums as TypeScript string-literal unions.
 *
 * Values MUST match prisma/schema.prisma exactly. A CI check should
 * compare these to the Prisma client output to prevent drift.
 */

export const ClaimVerificationMethod = [
  "WALLET_SIGNATURE",
  "VERIFICATION_FILE",
  "DNS_TXT",
] as const;
export type ClaimVerificationMethod = (typeof ClaimVerificationMethod)[number];

export const ClaimStatus = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
] as const;
export type ClaimStatus = (typeof ClaimStatus)[number];

export const JobStatus = ["RUNNING", "COMPLETED", "FAILED"] as const;
export type JobStatus = (typeof JobStatus)[number];

export const NodeStatus = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type NodeStatus = (typeof NodeStatus)[number];

export const AlertTargetType = [
  "ALL_NODES",
  "SPECIFIC_NODES",
  "BOOKMARKED",
] as const;
export type AlertTargetType = (typeof AlertTargetType)[number];

export const AlertMetric = [
  "CPU_PERCENT",
  "RAM_PERCENT",
  "STORAGE_SIZE",
  "UPTIME",
  "NODE_STATUS",
  "PACKETS_RECEIVED",
  "PACKETS_SENT",
] as const;
export type AlertMetric = (typeof AlertMetric)[number];

export const AlertOperator = ["GT", "GTE", "LT", "LTE", "EQ", "NEQ"] as const;
export type AlertOperator = (typeof AlertOperator)[number];

export const AlertStatus = [
  "ACTIVE",
  "ACKNOWLEDGED",
  "RESOLVED",
  "SUPPRESSED",
] as const;
export type AlertStatus = (typeof AlertStatus)[number];

export const NotificationChannelType = [
  "EMAIL",
  "DISCORD",
  "TELEGRAM",
] as const;
export type NotificationChannelType = (typeof NotificationChannelType)[number];

export const UptimeEventType = ["ONLINE", "OFFLINE"] as const;
export type UptimeEventType = (typeof UptimeEventType)[number];

export const ReportType = [
  "WEEKLY_SUMMARY",
  "DAILY_DIGEST",
  "MONTHLY_SLA",
  "CUSTOM",
] as const;
export type ReportType = (typeof ReportType)[number];

export const ReportSchedule = ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as const;
export type ReportSchedule = (typeof ReportSchedule)[number];

export const ReportScope = ["ALL_NODES", "PORTFOLIO"] as const;
export type ReportScope = (typeof ReportScope)[number];

export const DeliveryStatus = ["PENDING", "SENT", "FAILED"] as const;
export type DeliveryStatus = (typeof DeliveryStatus)[number];

export const ApiKeyTier = ["FREE", "PRO", "ENTERPRISE"] as const;
export type ApiKeyTier = (typeof ApiKeyTier)[number];

export const BadgeTier = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
] as const;
export type BadgeTier = (typeof BadgeTier)[number];
