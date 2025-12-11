/**
 * Version Analytics Router
 *
 * Endpoints for version advisories and distribution analysis
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  generateVersionAdvisory,
  analyzeVersionDistribution,
  findLatestVersion,
} from "@/lib/analytics/version-advisor";

export const versionRouter = createTRPCRouter({
  /**
   * Get version advisory for a single node
   */
  nodeVersionAdvisory: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input: nodeId }) => {
      const node = await ctx.db.node.findUnique({
        where: { id: nodeId },
        select: { version: true },
      });

      if (!node) return null;

      // Get latest version in network
      const versions = await ctx.db.node.groupBy({
        by: ["version"],
        where: { version: { not: null } },
      });

      const latestVersion = findLatestVersion(
        versions.map((v) => v.version!).filter(Boolean)
      );

      return generateVersionAdvisory(node.version, latestVersion);
    }),

  /**
   * Get network-wide version distribution and advisories
   */
  versionDistribution: publicProcedure.query(async ({ ctx }) => {
    const versionCounts = await ctx.db.node.groupBy({
      by: ["version"],
      where: { version: { not: null }, isActive: true },
      _count: { id: true },
    });

    const distribution = versionCounts
      .filter((v) => v.version !== null)
      .map((v) => ({
        version: v.version!,
        count: v._count.id,
      }));

    return analyzeVersionDistribution(distribution);
  }),
});
