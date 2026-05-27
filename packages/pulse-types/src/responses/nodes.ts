import type { BigIntString, IsoDate, Paginated } from "../common";
import type { NodeStatus } from "../enums";

export interface NodeSummary {
  pubkey: string | null;
  address: string;
  gossipAddress: string | null;
  version: string | null;
  status: NodeStatus;
  isActive: boolean;
  isPublic: boolean | null;
  rpcPort: number | null;
  firstSeen: IsoDate;
  lastSeen: IsoDate | null;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface NodeMetricSnapshot {
  time: IsoDate;
  cpuPercent: number | null;
  ramUsed: BigIntString | null;
  ramTotal: BigIntString | null;
  uptime: number | null;
  fileSize: BigIntString | null;
  totalBytes: BigIntString | null;
  totalPages: number | null;
  currentIndex: number | null;
  storageCommitted: BigIntString | null;
  storageUsagePercent: number | null;
  packetsReceived: number | null;
  packetsSent: number | null;
  activeStreams: number | null;
}

export interface NodeDetail extends NodeSummary {
  peerCount: number;
  latestMetric: NodeMetricSnapshot | null;
}

export interface NodeMetricBucket {
  bucket: IsoDate;
  avgCpu: number | null;
  avgRamPercent: number | null;
  maxUptime: number | null;
  maxFileSize: BigIntString | null;
  sampleCount: number;
}

export interface NodeMetricsResponse {
  pubkey: string;
  bucket: "raw" | "minute" | "hour" | "day" | "week";
  source: string;
  from: IsoDate;
  to: IsoDate;
  series: NodeMetricBucket[];
}

export interface NodePeerInfo {
  pubkey: string | null;
  address: string;
  lastSeen: IsoDate | null;
}

export interface NodeAddressChange {
  oldAddress: string;
  newAddress: string;
  changedAt: IsoDate;
}

export type ListNodesResponse = Paginated<NodeSummary>;
