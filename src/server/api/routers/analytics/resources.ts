/**
 * Resource Tuning Analytics Router
 *
 * Endpoints for generating resource optimization recommendations
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  generateTuningRecommendations,
  summarizeRecommendations,
  type NodeResourceMetrics,
} from "@/lib/analytics/resource-tuner";
import { findLatestVersion } from "@/lib/analytics/version-advisor";

export const resourcesRouter = createTRPCRouter({
  /**
   * Get tuning recommendations for a single node
   */
  nodeRecommendations: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input: nodeId }) => {
      const node = await ctx.db.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return null;
      }

      // Get latest metrics
      const latestMetric = await ctx.db.nodeMetric.findFirst({
        where: { nodeId },
        orderBy: { time: "desc" },
      });

      // Get peer count
      const peerCount = await ctx.db.nodePeer.count({
        where: { nodeId },
      });

      // Get latest version in network
      const versions = await ctx.db.node.groupBy({
        by: ["version"],
        where: { version: { not: null }, isActive: true },
      });
      const latestVersion = findLatestVersion(
        versions.map((v) => v.version!).filter(Boolean)
      );

      const resourceMetrics: NodeResourceMetrics = {
        cpuPercent: latestMetric?.cpuPercent ?? 0,
        ramPercent: latestMetric && Number(latestMetric.ramTotal) > 0
          ? (Number(latestMetric.ramUsed) / Number(latestMetric.ramTotal)) * 100
          : 0,
        uptime: latestMetric?.uptime ?? 0,
        fileSize: latestMetric?.fileSize ?? BigInt(0),
        version: node.version ?? undefined,
        peerCount,
      };

      const recommendations = generateTuningRecommendations(resourceMetrics, latestVersion);

      return {
        nodeId,
        address: node.address,
        version: node.version,
        recommendations,
        metrics: {
          cpu: resourceMetrics.cpuPercent,
          ram: resourceMetrics.ramPercent,
          uptime: resourceMetrics.uptime,
          peers: peerCount,
        },
      };
    }),

  /**
   * Get tuning recommendations summary across the network
   */
  networkRecommendations: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;

      // Get all active nodes
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        take: limit,
      });

      const nodeIds = nodes.map((n) => n.id);

      // Get latest metrics for all nodes
      const latestMetrics = await ctx.db.$queryRaw<Array<{
        node_id: number;
        cpu_percent: number;
        ram_used: bigint;
        ram_total: bigint;
        file_size: bigint;
        uptime: number;
      }>>`
        SELECT DISTINCT ON (node_id)
          node_id,
          cpu_percent,
          ram_used,
          ram_total,
          file_size,
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

      // Get latest version
      const versions = await ctx.db.node.groupBy({
        by: ["version"],
        where: { version: { not: null }, isActive: true },
      });
      const latestVersion = findLatestVersion(
        versions.map((v) => v.version!).filter(Boolean)
      );

      // Build lookup maps
      const metricsMap = new Map(
        latestMetrics.map((m) => [m.node_id, m])
      );
      const peerMap = new Map(
        peerCounts.map((p) => [p.nodeId, p._count.id])
      );

      // Generate recommendations for each node
      const allRecommendations = nodes.map((node) => {
        const metric = metricsMap.get(node.id);
        const peerCount = peerMap.get(node.id) ?? 0;

        const resourceMetrics: NodeResourceMetrics = {
          cpuPercent: metric?.cpu_percent ?? 0,
          ramPercent: metric && Number(metric.ram_total) > 0
            ? (Number(metric.ram_used) / Number(metric.ram_total)) * 100
            : 0,
          uptime: metric?.uptime ?? 0,
          fileSize: metric?.file_size ?? BigInt(0),
          version: node.version ?? undefined,
          peerCount,
        };

        return {
          nodeId: node.id,
          recommendations: generateTuningRecommendations(resourceMetrics, latestVersion),
        };
      });

      const summary = summarizeRecommendations(allRecommendations);

      // Get nodes with most issues
      const nodesWithIssues = allRecommendations
        .filter((n) => n.recommendations.length > 0)
        .map((n) => {
          const node = nodes.find((node) => node.id === n.nodeId);
          const criticalCount = n.recommendations.filter((r) => r.priority === "critical").length;
          const highCount = n.recommendations.filter((r) => r.priority === "high").length;
          return {
            nodeId: n.nodeId,
            address: node?.address ?? "",
            recommendationCount: n.recommendations.length,
            criticalCount,
            highCount,
            topRecommendation: n.recommendations[0],
          };
        })
        .sort((a, b) => {
          // Sort by critical first, then high, then total
          if (a.criticalCount !== b.criticalCount) return b.criticalCount - a.criticalCount;
          if (a.highCount !== b.highCount) return b.highCount - a.highCount;
          return b.recommendationCount - a.recommendationCount;
        })
        .slice(0, 10);

      return {
        ...summary,
        latestVersion,
        nodesWithIssues,
      };
    }),
});
