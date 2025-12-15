/**
 * Shared types for the collector module
 */

import type {
  PNodeStats,
  PodsWithStatsResult,
  PNodeVersion,
} from "@/types/prpc";

export const COLLECTION_INTERVAL = 30 * 1000; // 30 seconds
export const NODE_TIMEOUT = 5000; // 5 seconds per node
export const PRPC_PORT = 6000;

export interface CollectionResult {
  address: string;
  success: boolean;
  version?: PNodeVersion;
  stats?: PNodeStats;
  pods?: PodsWithStatsResult;
  error?: string;
}

export interface CollectionSummary {
  total: number;
  success: number;
  failed: number;
  discovered: number;
}
