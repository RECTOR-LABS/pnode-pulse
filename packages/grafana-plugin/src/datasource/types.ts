import { DataSourceJsonData, DataQuery } from "@grafana/data";

/**
 * Query types for pNode Pulse datasource
 */
export enum QueryType {
  Network = "network",
  Nodes = "nodes",
  Node = "node",
  Leaderboard = "leaderboard",
}

/**
 * Query interface for pNode Pulse
 */
export interface PnodePulseQuery extends DataQuery {
  queryType: QueryType;
  nodeId?: number;
  nodeAddress?: string;
  metric?: "cpu" | "ram" | "storage" | "uptime";
  status?: "all" | "active" | "inactive";
  limit?: number;
  aggregation?: "raw" | "hourly" | "daily";
  timeRange?: "1h" | "24h" | "7d" | "30d";
}

/**
 * Default query values
 */
export const defaultQuery: Partial<PnodePulseQuery> = {
  queryType: QueryType.Network,
  limit: 50,
  status: "active",
  metric: "uptime",
  aggregation: "hourly",
  timeRange: "24h",
};

/**
 * Datasource configuration options
 */
export interface PnodePulseDataSourceOptions extends DataSourceJsonData {
  url: string;
}

/**
 * Secure configuration (API key stored securely)
 */
export interface PnodePulseSecureOptions {
  apiKey?: string;
}

/**
 * API Response types
 */
export interface NetworkOverview {
  nodes: {
    total: number;
    active: number;
    inactive: number;
  };
  versions: Array<{
    version: string;
    count: number;
  }>;
  metrics: {
    totalStorageBytes: number;
    avgCpuPercent: number;
    avgRamPercent: number;
    avgUptimeSeconds: number;
    timestamp: string;
  };
}

export interface Node {
  id: number;
  address: string;
  pubkey: string | null;
  version: string | null;
  isActive: boolean;
  lastSeen: string | null;
  firstSeen: string;
}

export interface NodeDetails extends Node {
  metrics: {
    cpuPercent: number | null;
    ramUsedBytes: number;
    ramTotalBytes: number;
    ramPercent: number;
    storageBytes: number;
    uptimeSeconds: number | null;
    packetsReceived: number | null;
    packetsSent: number | null;
    timestamp: string;
  } | null;
  peerCount: number;
  metricsCount: number;
}

export interface NodeMetrics {
  nodeId: number;
  range: string;
  aggregation: string;
  data: Array<{
    time: string;
    cpuPercent: number;
    ramPercent: number;
    storageBytes: number;
    uptimeSeconds: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  nodeId: number;
  address: string;
  version: string;
  value: number;
  metrics: {
    uptimeSeconds: number;
    cpuPercent: number;
    ramPercent: number;
    storageBytes: number;
  };
}

export interface Leaderboard {
  metric: string;
  period: string;
  order: string;
  rankings: LeaderboardEntry[];
}
