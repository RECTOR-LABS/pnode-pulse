/**
 * Notification Types and Interfaces
 */

export type NotificationChannelType = "email" | "discord" | "telegram";

export interface NotificationPayload {
  alertId: string;
  ruleName: string;
  nodeAddress: string;
  nodeId: number;
  metric: string;
  operator: string;
  value: number;
  threshold: number;
  triggeredAt: Date;
  message: string;
}

export interface NotificationResult {
  success: boolean;
  channelType: NotificationChannelType;
  channelId: string;
  error?: string;
  messageId?: string;
}

export interface EmailConfig {
  address: string;
  verified: boolean;
}

export interface DiscordConfig {
  webhookUrl: string;
  serverName?: string;
  channelName?: string;
}

export interface TelegramConfig {
  chatId: string;
  username?: string;
}

export type ChannelConfig = EmailConfig | DiscordConfig | TelegramConfig;

export interface NotificationChannel {
  id: string;
  type: NotificationChannelType;
  name: string;
  config: ChannelConfig;
  isVerified: boolean;
}

/**
 * Alert metric types
 */
export const ALERT_METRICS = {
  CPU_PERCENT: {
    label: "CPU Usage",
    unit: "%",
    description: "CPU utilization percentage",
  },
  RAM_PERCENT: {
    label: "RAM Usage",
    unit: "%",
    description: "Memory utilization percentage",
  },
  STORAGE_SIZE: {
    label: "Storage",
    unit: "bytes",
    description: "Total storage used",
  },
  UPTIME: {
    label: "Uptime",
    unit: "seconds",
    description: "Node uptime in seconds",
  },
  NODE_STATUS: {
    label: "Node Status",
    unit: "",
    description: "Node online/offline status",
  },
  PACKETS_RECEIVED: {
    label: "Packets Received",
    unit: "",
    description: "Number of packets received",
  },
  PACKETS_SENT: {
    label: "Packets Sent",
    unit: "",
    description: "Number of packets sent",
  },
} as const;

export type AlertMetric = keyof typeof ALERT_METRICS;

/**
 * Alert operators
 */
export const ALERT_OPERATORS = {
  GT: { label: ">", description: "Greater than" },
  GTE: { label: ">=", description: "Greater than or equal" },
  LT: { label: "<", description: "Less than" },
  LTE: { label: "<=", description: "Less than or equal" },
  EQ: { label: "=", description: "Equal to" },
  NEQ: { label: "!=", description: "Not equal to" },
} as const;

export type AlertOperator = keyof typeof ALERT_OPERATORS;

/**
 * Alert target types
 */
export const ALERT_TARGET_TYPES = {
  ALL_NODES: { label: "All Nodes", description: "Monitor all active nodes" },
  SPECIFIC_NODES: { label: "Specific Nodes", description: "Monitor selected nodes only" },
  BOOKMARKED: { label: "Bookmarked Nodes", description: "Monitor your bookmarked nodes" },
} as const;

export type AlertTargetType = keyof typeof ALERT_TARGET_TYPES;

/**
 * Alert status
 */
export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "SUPPRESSED";

/**
 * Common preset thresholds
 */
export const PRESET_THRESHOLDS = [
  {
    name: "High CPU",
    metric: "CPU_PERCENT" as AlertMetric,
    operator: "GT" as AlertOperator,
    threshold: 80,
    description: "CPU usage exceeds 80%",
  },
  {
    name: "High RAM",
    metric: "RAM_PERCENT" as AlertMetric,
    operator: "GT" as AlertOperator,
    threshold: 90,
    description: "RAM usage exceeds 90%",
  },
  {
    name: "Node Offline",
    metric: "NODE_STATUS" as AlertMetric,
    operator: "EQ" as AlertOperator,
    threshold: 0,
    description: "Node goes offline",
  },
  {
    name: "Low Uptime",
    metric: "UPTIME" as AlertMetric,
    operator: "LT" as AlertOperator,
    threshold: 3600,
    description: "Uptime less than 1 hour (recent restart)",
  },
];
