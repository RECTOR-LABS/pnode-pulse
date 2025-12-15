/**
 * Network Stats
 *
 * Computes and stores aggregate network statistics.
 */

import { db } from "@/lib/db";
import { publishNetworkUpdate } from "@/lib/redis/pubsub";
import { logger } from "@/lib/logger";

/**
 * Compute and store network stats
 */
export async function computeNetworkStats() {
  const result = await db.$queryRaw<
    Array<{
      total_nodes: bigint;
      active_nodes: bigint;
      total_storage: bigint;
      avg_cpu: number;
      avg_ram_percent: number;
      avg_uptime: number;
      total_peers: bigint;
    }>
  >`
    WITH latest_metrics AS (
      SELECT DISTINCT ON (node_id) *
      FROM node_metrics
      ORDER BY node_id, time DESC
    ),
    peer_counts AS (
      SELECT COUNT(*) as total FROM node_peers
    )
    SELECT
      (SELECT COUNT(*) FROM nodes) as total_nodes,
      (SELECT COUNT(*) FROM nodes WHERE is_active = true) as active_nodes,
      COALESCE(SUM(lm.file_size), 0) as total_storage,
      COALESCE(AVG(lm.cpu_percent), 0) as avg_cpu,
      COALESCE(AVG(lm.ram_used::float / NULLIF(lm.ram_total, 0) * 100), 0) as avg_ram_percent,
      COALESCE(AVG(lm.uptime), 0) as avg_uptime,
      (SELECT total FROM peer_counts) as total_peers
    FROM latest_metrics lm
  `;

  // Get version distribution from active nodes
  const versionDistribution = await db.node.groupBy({
    by: ["version"],
    _count: { id: true },
    where: { isActive: true, version: { not: null } },
  });

  // Convert to JSON object { "0.6.0": 15, "0.5.1": 10, ... }
  const versionDistJson: Record<string, number> = {};
  for (const v of versionDistribution) {
    if (v.version) {
      versionDistJson[v.version] = v._count.id;
    }
  }

  const stats = result[0];
  if (stats) {
    await db.networkStats.create({
      data: {
        totalNodes: Number(stats.total_nodes),
        activeNodes: Number(stats.active_nodes),
        totalStorage: BigInt(Math.floor(Number(stats.total_storage))),
        avgCpuPercent: stats.avg_cpu,
        avgRamPercent: stats.avg_ram_percent,
        avgUptime: Math.round(stats.avg_uptime),
        totalPeers: Number(stats.total_peers),
        versionDistribution: versionDistJson,
      },
    });

    // Publish real-time update
    await publishNetworkUpdate(
      Number(stats.total_nodes),
      Number(stats.active_nodes),
      Number(stats.total_nodes) - Number(stats.active_nodes),
    ).catch((err) => logger.error("Failed to publish network update", err));
  }
}
