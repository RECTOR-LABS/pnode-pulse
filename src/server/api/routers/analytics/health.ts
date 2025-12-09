/**
 * Health Analytics Router
 *
 * Endpoints for node and network health scoring
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  calculateNodeHealth,
  calculateNetworkHealth,
  type NodeMetrics,
  type NetworkStats,
  type HealthScore,
} from "@/lib/analytics/health-scorer";
import {
  findLatestVersion,
} from "@/lib/analytics/version-advisor";
import {
  calculateSummary,
} from "@/lib/analytics/statistics";

/**
 * Get network-wide statistics for health calculations
 */
async function getNetworkStats(db: typeof import("@/lib/db").db): Promise<NetworkStats> {
  // Get version distribution to find latest
  const versions = await db.node.groupBy({
    by: ["version"],
    where: { version: { not: null }, isActive: true },
  });

  const latestVersion = findLatestVersion(
    versions.map((v) => v.version!).filter(Boolean)
  );

  // Get latest metrics for all active nodes
  const latestMetrics = await db.$queryRaw<Array<{
    cpu_percent: number;
    ram_percent: number;
    uptime: number;
  }>>`
    SELECT
      nm.cpu_percent,
      CASE WHEN nm.ram_total > 0
        THEN (nm.ram_used::float / nm.ram_total * 100)
        ELSE 0
      END as ram_percent,
      nm.uptime
    FROM (
      SELECT DISTINCT ON (nm.node_id)
        nm.cpu_percent,
        nm.ram_used,
        nm.ram_total,
        nm.uptime
      FROM node_metrics nm
      JOIN nodes n ON n.id = nm.node_id
      WHERE n.is_active = true
      ORDER BY nm.node_id, nm.time DESC
    ) nm
  `;

  const cpuValues = latestMetrics.map((m) => m.cpu_percent);
  const ramValues = latestMetrics.map((m) => m.ram_percent);
  const uptimeValues = latestMetrics.map((m) => m.uptime);

  const cpuSummary = calculateSummary(cpuValues);
  const ramSummary = calculateSummary(ramValues);
  const uptimeSummary = calculateSummary(uptimeValues);

  return {
    latestVersion,
    avgCpu: cpuSummary.mean,
    avgRam: ramSummary.mean,
    avgUptime: uptimeSummary.mean,
    cpuStdDev: cpuSummary.stdDev,
    ramStdDev: ramSummary.stdDev,
    uptimeStdDev: uptimeSummary.stdDev,
  };
}

export const healthRouter = createTRPCRouter({
  /**
   * Get health score for a single node
   */
  nodeHealth: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input: nodeId }) => {
      // Get node with latest metrics
      const node = await ctx.db.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return null;
      }

      // Get latest metrics for this node
      const latestMetric = await ctx.db.nodeMetric.findFirst({
        where: { nodeId },
        orderBy: { time: "desc" },
      });

      // Get peer count
      const peerCount = await ctx.db.nodePeer.count({
        where: { nodeId },
      });

      // Get network stats for comparison
      const networkStats = await getNetworkStats(ctx.db);

      const metrics: NodeMetrics = {
        cpuPercent: latestMetric?.cpuPercent ?? 0,
        ramPercent: latestMetric
          ? Number(latestMetric.ramTotal) > 0
            ? (Number(latestMetric.ramUsed) / Number(latestMetric.ramTotal)) * 100
            : 0
          : 0,
        uptime: latestMetric?.uptime ?? 0,
        peerCount,
        version: node.version ?? undefined,
        isActive: node.isActive,
      };

      return calculateNodeHealth(metrics, networkStats);
    }),

  /**
   * Get health scores for multiple nodes (batch)
   */
  nodesHealth: publicProcedure
    .input(
      z.object({
        nodeIds: z.array(z.number()).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeIds, limit, offset } = input;

      // Get nodes
      const nodes = await ctx.db.node.findMany({
        where: nodeIds ? { id: { in: nodeIds } } : { isActive: true },
        take: limit,
        skip: offset,
        orderBy: { lastSeen: "desc" },
      });

      const nodeIdList = nodes.map((n) => n.id);

      // Get latest metrics for all nodes
      const latestMetrics = await ctx.db.$queryRaw<Array<{
        node_id: number;
        cpu_percent: number;
        ram_used: bigint;
        ram_total: bigint;
        uptime: number;
      }>>`
        SELECT DISTINCT ON (node_id)
          node_id,
          cpu_percent,
          ram_used,
          ram_total,
          uptime
        FROM node_metrics
        WHERE node_id = ANY(${nodeIdList})
        ORDER BY node_id, time DESC
      `;

      // Get peer counts for all nodes
      const peerCounts = await ctx.db.nodePeer.groupBy({
        by: ["nodeId"],
        where: { nodeId: { in: nodeIdList } },
        _count: { id: true },
      });

      // Build lookup maps
      const metricsMap = new Map(
        latestMetrics.map((m) => [m.node_id, m])
      );
      const peerMap = new Map(
        peerCounts.map((p) => [p.nodeId, p._count.id])
      );

      // Get network stats for comparison
      const networkStats = await getNetworkStats(ctx.db);

      // Calculate health for each node
      const results: Array<{
        nodeId: number;
        address: string;
        version: string | null;
        isActive: boolean;
        health: HealthScore;
      }> = nodes.map((node) => {
        const metric = metricsMap.get(node.id);
        const peerCount = peerMap.get(node.id) ?? 0;

        const nodeMetrics: NodeMetrics = {
          cpuPercent: metric?.cpu_percent ?? 0,
          ramPercent: metric
            ? Number(metric.ram_total) > 0
              ? (Number(metric.ram_used) / Number(metric.ram_total)) * 100
              : 0
            : 0,
          uptime: metric?.uptime ?? 0,
          peerCount,
          version: node.version ?? undefined,
          isActive: node.isActive,
        };

        return {
          nodeId: node.id,
          address: node.address,
          version: node.version,
          isActive: node.isActive,
          health: calculateNodeHealth(nodeMetrics, networkStats),
        };
      });

      return results;
    }),

  /**
   * Get network-wide health summary
   */
  networkHealth: publicProcedure.query(async ({ ctx }) => {
    // Get all active nodes
    const nodes = await ctx.db.node.findMany({
      where: { isActive: true },
    });

    const nodeIds = nodes.map((n) => n.id);

    // Get latest metrics for all nodes
    const latestMetrics = await ctx.db.$queryRaw<Array<{
      node_id: number;
      cpu_percent: number;
      ram_used: bigint;
      ram_total: bigint;
      uptime: number;
    }>>`
      SELECT DISTINCT ON (node_id)
        node_id,
        cpu_percent,
        ram_used,
        ram_total,
        uptime
      FROM node_metrics
      WHERE node_id = ANY(${nodeIds})
      ORDER BY node_id, time DESC
    `;

    // Get peer counts
    const peerCounts = await ctx.db.nodePeer.groupBy({
      by: ["nodeId"],
      where: { nodeId: { in: nodeIds } },
      _count: { id: true },
    });

    // Build lookup maps
    const metricsMap = new Map(
      latestMetrics.map((m) => [m.node_id, m])
    );
    const peerMap = new Map(
      peerCounts.map((p) => [p.nodeId, p._count.id])
    );

    // Get network stats
    const networkStats = await getNetworkStats(ctx.db);

    // Calculate health for each node
    const healthScores: HealthScore[] = nodes.map((node) => {
      const metric = metricsMap.get(node.id);
      const peerCount = peerMap.get(node.id) ?? 0;

      const nodeMetrics: NodeMetrics = {
        cpuPercent: metric?.cpu_percent ?? 0,
        ramPercent: metric
          ? Number(metric.ram_total) > 0
            ? (Number(metric.ram_used) / Number(metric.ram_total)) * 100
            : 0
          : 0,
        uptime: metric?.uptime ?? 0,
        peerCount,
        version: node.version ?? undefined,
        isActive: node.isActive,
      };

      return calculateNodeHealth(nodeMetrics, networkStats);
    });

    const networkHealth = calculateNetworkHealth(healthScores);

    return {
      ...networkHealth,
      totalNodes: nodes.length,
      networkStats: {
        avgCpu: networkStats.avgCpu,
        avgRam: networkStats.avgRam,
        avgUptime: networkStats.avgUptime,
        latestVersion: networkStats.latestVersion,
      },
    };
  }),
});
