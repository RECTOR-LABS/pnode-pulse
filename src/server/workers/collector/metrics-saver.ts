/**
 * Metrics Saver
 *
 * Database operations for saving node metrics.
 */

import { db } from "@/lib/db";
import type { PNodeStats } from "@/types/prpc";

/**
 * Save metrics for a node (full stats from get-stats)
 */
export async function saveMetrics(
  nodeId: number,
  stats: PNodeStats,
  storageCommitted?: bigint | null,
  storageUsagePercent?: number | null,
) {
  await db.nodeMetric.create({
    data: {
      nodeId,
      cpuPercent: stats.cpu_percent,
      ramUsed: BigInt(stats.ram_used),
      ramTotal: BigInt(stats.ram_total),
      uptime: stats.uptime,
      fileSize: BigInt(stats.file_size),
      totalBytes: BigInt(stats.total_bytes),
      totalPages: stats.total_pages,
      currentIndex: stats.current_index,
      packetsReceived: stats.packets_received,
      packetsSent: stats.packets_sent,
      activeStreams: stats.active_streams,
      // v0.7.0+ fields from get-pods-with-stats
      storageCommitted:
        storageCommitted !== undefined ? storageCommitted : null,
      storageUsagePercent:
        storageUsagePercent !== undefined ? storageUsagePercent : null,
    },
  });
}

/**
 * Save partial metrics for a node (limited data from get-pods-with-stats)
 *
 * Used for private nodes that we can't query directly.
 * Brown's observation (Dec 11, 2025): get-pods-with-stats returns less
 * complete data than get-stats, but it's the only source for private nodes.
 *
 * Fields available from get-pods-with-stats:
 * - uptime, storage_committed, storage_used, storage_usage_percent
 *
 * Fields NOT available (only from get-stats):
 * - cpu_percent, ram_used, ram_total, active_streams, packets_*, etc.
 */
export async function savePartialMetrics(
  nodeId: number,
  uptime: number,
  storageCommitted: bigint | null,
  storageUsed: bigint | null,
  storageUsagePercent: number | null,
) {
  await db.nodeMetric.create({
    data: {
      nodeId,
      uptime,
      // Storage fields from get-pods-with-stats
      storageCommitted,
      storageUsagePercent,
      // Use storage_used as totalBytes since it represents actual data stored
      totalBytes: storageUsed,
      // Fields we don't have from get-pods-with-stats - set to null/0
      cpuPercent: null,
      ramUsed: null,
      ramTotal: null,
      fileSize: null,
      totalPages: null,
      currentIndex: null,
      packetsReceived: null,
      packetsSent: null,
      activeStreams: null,
    },
  });
}
