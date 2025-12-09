/**
 * Storage Analytics Router
 *
 * Endpoints for v0.7.0+ storage statistics and node accessibility
 */

import { createTRPCRouter, publicProcedure } from "../../trpc";

export const storageRouter = createTRPCRouter({
  /**
   * Get network-wide storage statistics (v0.7.0+)
   */
  stats: publicProcedure.query(async ({ ctx }) => {
    const activeNodes = await ctx.db.node.findMany({
      where: { isActive: true },
      include: {
        metrics: {
          orderBy: { time: "desc" },
          take: 1,
        },
      },
    });

    const nodesWithStorageStats = activeNodes.filter(
      (n) => n.metrics[0]?.storageCommitted !== null
    );

    const totalCommitted = nodesWithStorageStats.reduce(
      (sum, n) => sum + (n.metrics[0]?.storageCommitted ?? BigInt(0)),
      BigInt(0)
    );

    const avgUsagePercent =
      nodesWithStorageStats.length > 0
        ? nodesWithStorageStats.reduce(
            (sum, n) => sum + (n.metrics[0]?.storageUsagePercent ?? 0),
            0
          ) / nodesWithStorageStats.length
        : 0;

    const totalUsed = nodesWithStorageStats.reduce((sum, n) => {
      const committed = n.metrics[0]?.storageCommitted ?? BigInt(0);
      const usagePercent = n.metrics[0]?.storageUsagePercent ?? 0;
      return sum + BigInt(Math.floor(Number(committed) * (usagePercent / 100)));
    }, BigInt(0));

    return {
      totalCommitted: Number(totalCommitted),
      totalUsed: Number(totalUsed),
      avgUsagePercent,
      nodesWithStats: nodesWithStorageStats.length,
      totalNodes: activeNodes.length,
    };
  }),

  /**
   * Get node accessibility breakdown (public/private RPC)
   */
  nodeAccessibility: publicProcedure.query(async ({ ctx }) => {
    const [publicNodes, privateNodes, unknownNodes] = await Promise.all([
      ctx.db.node.count({ where: { isPublic: true, isActive: true } }),
      ctx.db.node.count({ where: { isPublic: false, isActive: true } }),
      ctx.db.node.count({ where: { isPublic: null, isActive: true } }),
    ]);

    return {
      publicNodes,
      privateNodes,
      unknownNodes,
      total: publicNodes + privateNodes + unknownNodes,
    };
  }),

  /**
   * Get version distribution with v0.7.0+ flag
   */
  versionDistribution: publicProcedure.query(async ({ ctx }) => {
    const versions = await ctx.db.node.groupBy({
      by: ["version"],
      where: { isActive: true, version: { not: null } },
      _count: { id: true },
    });

    const distribution = versions
      .map((v) => ({
        version: v.version!,
        count: v._count.id,
        isV070Plus: v.version!.startsWith("0.7"),
      }))
      .sort((a, b) => b.count - a.count);

    const v070Count = distribution
      .filter((v) => v.isV070Plus)
      .reduce((sum, v) => sum + v.count, 0);

    return {
      versions: distribution,
      v070Count,
      totalNodes: distribution.reduce((sum, v) => sum + v.count, 0),
    };
  }),
});
