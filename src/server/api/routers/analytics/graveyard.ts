/**
 * Graveyard Router
 *
 * API endpoints for viewing archived/inactive nodes
 * "Honoring nodes that served the network" - Brad's suggestion
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import { NodeStatus } from "@prisma/client";

export const graveyardRouter = createTRPCRouter({
  /**
   * Get archived nodes for the graveyard view
   */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        orderBy: z.enum(["lastSeen", "firstSeen", "version"]).default("lastSeen"),
        order: z.enum(["asc", "desc"]).default("desc"),
        versionFilter: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, orderBy, order, versionFilter } = input;

      const where = {
        status: NodeStatus.ARCHIVED,
        ...(versionFilter && { version: { contains: versionFilter } }),
      };

      const [nodes, total] = await Promise.all([
        ctx.db.node.findMany({
          where,
          orderBy: { [orderBy]: order },
          take: limit,
          skip: offset,
          select: {
            id: true,
            address: true,
            pubkey: true,
            version: true,
            firstSeen: true,
            lastSeen: true,
            isPublic: true,
            // Get last known metrics
            metrics: {
              orderBy: { time: "desc" },
              take: 1,
              select: {
                uptime: true,
                fileSize: true,
                cpuPercent: true,
              },
            },
          },
        }),
        ctx.db.node.count({ where }),
      ]);

      // Calculate lifetime for each node
      const nodesWithLifetime = nodes.map((node) => {
        const firstSeen = new Date(node.firstSeen);
        const lastSeen = node.lastSeen ? new Date(node.lastSeen) : new Date();
        const lifetimeMs = lastSeen.getTime() - firstSeen.getTime();
        const lifetimeDays = Math.floor(lifetimeMs / (1000 * 60 * 60 * 24));

        return {
          ...node,
          lifetimeDays,
          lastMetric: node.metrics[0] || null,
        };
      });

      return {
        nodes: nodesWithLifetime,
        total,
        hasMore: offset + nodes.length < total,
      };
    }),

  /**
   * Get graveyard statistics
   */
  stats: publicProcedure.query(async ({ ctx }) => {
    const [active, inactive, archived, totalEver] = await Promise.all([
      ctx.db.node.count({ where: { status: NodeStatus.ACTIVE } }),
      ctx.db.node.count({ where: { status: NodeStatus.INACTIVE } }),
      ctx.db.node.count({ where: { status: NodeStatus.ARCHIVED } }),
      ctx.db.node.count(),
    ]);

    // Get version distribution of archived nodes
    const archivedVersions = await ctx.db.node.groupBy({
      by: ["version"],
      where: { status: NodeStatus.ARCHIVED, version: { not: null } },
      _count: { id: true },
    });

    // Get oldest and newest archived nodes
    const [oldestArchived, newestArchived] = await Promise.all([
      ctx.db.node.findFirst({
        where: { status: NodeStatus.ARCHIVED },
        orderBy: { lastSeen: "asc" },
        select: { lastSeen: true, address: true, pubkey: true },
      }),
      ctx.db.node.findFirst({
        where: { status: NodeStatus.ARCHIVED },
        orderBy: { lastSeen: "desc" },
        select: { lastSeen: true, address: true, pubkey: true },
      }),
    ]);

    return {
      active,
      inactive,
      archived,
      totalEver,
      survivalRate: totalEver > 0 ? ((active / totalEver) * 100).toFixed(1) : "0",
      versionDistribution: archivedVersions
        .filter((v) => v.version)
        .map((v) => ({
          version: v.version!,
          count: v._count.id,
        }))
        .sort((a, b) => b.count - a.count),
      oldestArchived,
      newestArchived,
    };
  }),

  /**
   * Get churn statistics over time
   */
  churn: publicProcedure
    .input(
      z.object({
        range: z.enum(["7d", "30d", "90d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const rangeMs = {
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
      };

      const startDate = new Date(Date.now() - rangeMs[input.range]);

      // Nodes that became archived in this period
      const newlyArchived = await ctx.db.node.count({
        where: {
          status: NodeStatus.ARCHIVED,
          lastSeen: { gte: startDate },
        },
      });

      // Nodes first seen in this period (new joins)
      const newJoins = await ctx.db.node.count({
        where: {
          firstSeen: { gte: startDate },
        },
      });

      // Get daily breakdown for charting
      const dailyStats = await ctx.db.$queryRaw<
        Array<{
          date: Date;
          archived_count: bigint;
          joined_count: bigint;
        }>
      >`
        WITH date_series AS (
          SELECT generate_series(
            ${startDate}::date,
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        ),
        archived AS (
          SELECT DATE(last_seen) as date, COUNT(*) as cnt
          FROM nodes
          WHERE status = 'ARCHIVED'
            AND last_seen >= ${startDate}
          GROUP BY DATE(last_seen)
        ),
        joined AS (
          SELECT DATE(first_seen) as date, COUNT(*) as cnt
          FROM nodes
          WHERE first_seen >= ${startDate}
          GROUP BY DATE(first_seen)
        )
        SELECT
          ds.date,
          COALESCE(a.cnt, 0) as archived_count,
          COALESCE(j.cnt, 0) as joined_count
        FROM date_series ds
        LEFT JOIN archived a ON ds.date = a.date
        LEFT JOIN joined j ON ds.date = j.date
        ORDER BY ds.date ASC
      `;

      // Calculate net change
      const netChange = newJoins - newlyArchived;

      return {
        range: input.range,
        newlyArchived,
        newJoins,
        netChange,
        churnRate:
          newJoins > 0
            ? ((newlyArchived / newJoins) * 100).toFixed(1)
            : "0",
        dailyStats: dailyStats.map((d) => ({
          date: d.date,
          archived: Number(d.archived_count),
          joined: Number(d.joined_count),
          net: Number(d.joined_count) - Number(d.archived_count),
        })),
      };
    }),

  /**
   * Get resurrection statistics (nodes that came back online)
   */
  resurrections: publicProcedure
    .input(
      z.object({
        range: z.enum(["7d", "30d", "90d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const rangeMs = {
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
      };

      const startDate = new Date(Date.now() - rangeMs[input.range]);

      // Nodes that were reactivated (have status ACTIVE but were previously ARCHIVED)
      // We can detect this by looking at nodes with IP changes AND active status
      // Or nodes that have gaps in their metrics
      const reactivatedNodes = await ctx.db.node.count({
        where: {
          status: NodeStatus.ACTIVE,
          // Has address changes (indicates it was tracked, went away, came back)
          addressChanges: {
            some: {
              detectedAt: { gte: startDate },
            },
          },
        },
      });

      return {
        range: input.range,
        resurrections: reactivatedNodes,
        message:
          reactivatedNodes > 0
            ? `${reactivatedNodes} node${reactivatedNodes > 1 ? "s" : ""} came back online after being inactive`
            : "No resurrections detected in this period",
      };
    }),
});
