/**
 * Nodes Router
 *
 * API endpoints for pNode data
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const nodesRouter = createTRPCRouter({
  /**
   * Get all nodes with optional filtering and search
   */
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["all", "active", "inactive"]).default("all"),
        version: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        orderBy: z.enum([
          "lastSeen",
          "firstSeen",
          "address",
          "version",
          "isActive",
        ]).default("lastSeen"),
        order: z.enum(["asc", "desc"]).default("desc"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const {
        status = "all",
        version,
        search,
        limit = 50,
        offset = 0,
        orderBy = "lastSeen",
        order = "desc",
      } = input ?? {};

      // Build where clause
      const where: {
        isActive?: boolean;
        version?: string;
        OR?: Array<{ address?: { contains: string }; pubkey?: { contains: string } }>;
      } = {};

      if (status === "active") where.isActive = true;
      if (status === "inactive") where.isActive = false;
      if (version) where.version = version;
      if (search) {
        where.OR = [
          { address: { contains: search } },
          { pubkey: { contains: search } },
        ];
      }

      const [nodes, total] = await Promise.all([
        ctx.db.node.findMany({
          where: Object.keys(where).length > 0 ? where : undefined,
          take: limit,
          skip: offset,
          orderBy: { [orderBy]: order },
          include: {
            _count: {
              select: { metrics: true },
            },
          },
        }),
        ctx.db.node.count({ where: Object.keys(where).length > 0 ? where : undefined }),
      ]);

      return {
        nodes,
        total,
        hasMore: offset + nodes.length < total,
      };
    }),

  /**
   * Get all unique versions in the network
   */
  versions: publicProcedure.query(async ({ ctx }) => {
    const versions = await ctx.db.node.groupBy({
      by: ["version"],
      where: { version: { not: null } },
      _count: { id: true },
    });

    return versions
      .filter((v) => v.version !== null)
      .map((v) => ({
        version: v.version!,
        count: v._count.id,
      }))
      .sort((a, b) => b.count - a.count);
  }),

  /**
   * Get nodes with their latest metrics (for the list view)
   */
  listWithMetrics: publicProcedure
    .input(
      z.object({
        status: z.enum(["all", "active", "inactive"]).default("all"),
        version: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        orderBy: z.enum([
          "lastSeen",
          "firstSeen",
          "address",
          "version",
          "isActive",
        ]).default("lastSeen"),
        order: z.enum(["asc", "desc"]).default("desc"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const {
        status = "all",
        version,
        search,
        limit = 50,
        offset = 0,
        orderBy = "lastSeen",
        order = "desc",
      } = input ?? {};

      // Build where clause
      const where: {
        isActive?: boolean;
        version?: string;
        OR?: Array<{ address?: { contains: string }; pubkey?: { contains: string } }>;
      } = {};

      if (status === "active") where.isActive = true;
      if (status === "inactive") where.isActive = false;
      if (version) where.version = version;
      if (search) {
        where.OR = [
          { address: { contains: search } },
          { pubkey: { contains: search } },
        ];
      }

      const whereClause = Object.keys(where).length > 0 ? where : undefined;

      const [nodes, total] = await Promise.all([
        ctx.db.node.findMany({
          where: whereClause,
          take: limit,
          skip: offset,
          orderBy: { [orderBy]: order },
        }),
        ctx.db.node.count({ where: whereClause }),
      ]);

      // Get latest metrics for these nodes
      const nodeIds = nodes.map((n) => n.id);
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

      // Build metrics lookup map
      const metricsMap = new Map(
        latestMetrics.map((m) => [
          m.node_id,
          {
            cpuPercent: m.cpu_percent,
            ramUsed: m.ram_used,
            ramTotal: m.ram_total,
            ramPercent: m.ram_total > BigInt(0)
              ? Number((m.ram_used * BigInt(100)) / m.ram_total)
              : 0,
            fileSize: m.file_size,
            uptime: m.uptime,
          },
        ])
      );

      // Combine nodes with their metrics
      const nodesWithMetrics = nodes.map((node) => ({
        ...node,
        latestMetric: metricsMap.get(node.id) || null,
      }));

      return {
        nodes: nodesWithMetrics,
        total,
        limit,
        offset,
        hasMore: offset + nodes.length < total,
      };
    }),

  /**
   * Get a single node by ID
   */
  byId: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const node = await ctx.db.node.findUnique({
        where: { id: input },
        include: {
          _count: {
            select: { metrics: true, peers: true },
          },
        },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Node with ID ${input} not found`,
        });
      }

      return node;
    }),

  /**
   * Get a single node by address
   */
  byAddress: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const node = await ctx.db.node.findUnique({
        where: { address: input },
        include: {
          _count: {
            select: { metrics: true, peers: true },
          },
        },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Node with address ${input} not found`,
        });
      }

      return node;
    }),

  /**
   * Get metrics history for a node
   */
  metrics: publicProcedure
    .input(
      z.object({
        nodeId: z.number(),
        range: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
        aggregation: z.enum(["raw", "hourly", "daily"]).default("hourly"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeId, range, aggregation } = input;

      // Calculate time range
      const now = new Date();
      const rangeMs = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };
      const startTime = new Date(now.getTime() - rangeMs[range]);

      // For raw data, use the node_metrics table directly
      if (aggregation === "raw") {
        const metrics = await ctx.db.nodeMetric.findMany({
          where: {
            nodeId,
            time: { gte: startTime },
          },
          orderBy: { time: "asc" },
          take: 1000, // Limit raw data
        });
        return metrics;
      }

      // For aggregated data, use raw SQL with continuous aggregates
      // Use separate parameterized queries for each view to avoid SQL injection patterns
      type AggregatedMetric = {
        bucket: Date;
        avg_cpu: number | null;
        avg_ram_percent: number | null;
        max_uptime: number | null;
        max_file_size: bigint | null;
        sample_count: bigint;
      };

      const metrics = aggregation === "hourly"
        ? await ctx.db.$queryRaw<AggregatedMetric[]>`
            SELECT bucket, avg_cpu, avg_ram_percent, max_uptime, max_file_size, sample_count
            FROM node_metrics_hourly
            WHERE node_id = ${nodeId} AND bucket >= ${startTime}
            ORDER BY bucket ASC`
        : await ctx.db.$queryRaw<AggregatedMetric[]>`
            SELECT bucket, avg_cpu, avg_ram_percent, max_uptime, max_file_size, sample_count
            FROM node_metrics_daily
            WHERE node_id = ${nodeId} AND bucket >= ${startTime}
            ORDER BY bucket ASC`;

      return metrics;
    }),

  /**
   * Get latest metric for a node
   */
  latestMetric: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const metric = await ctx.db.nodeMetric.findFirst({
        where: { nodeId: input },
        orderBy: { time: "desc" },
      });

      return metric;
    }),

  /**
   * Get peers for a node
   */
  peers: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const peers = await ctx.db.nodePeer.findMany({
        where: { nodeId: input },
        include: {
          peerNode: {
            select: {
              id: true,
              address: true,
              version: true,
              isActive: true,
            },
          },
        },
        orderBy: { lastSeenAt: "desc" },
      });

      return peers;
    }),

  /**
   * Get summary stats for all active nodes
   */
  summary: publicProcedure.query(async ({ ctx }) => {
    const [totalNodes, activeNodes] = await Promise.all([
      ctx.db.node.count(),
      ctx.db.node.count({ where: { isActive: true } }),
    ]);

    // Get latest metrics for all active nodes
    const latestMetrics = await ctx.db.$queryRaw<Array<{
      total_storage: bigint;
      avg_cpu: number;
      avg_ram_percent: number;
      avg_uptime: number;
    }>>`
      SELECT
        COALESCE(SUM(file_size), 0) as total_storage,
        COALESCE(AVG(cpu_percent), 0) as avg_cpu,
        COALESCE(AVG(ram_used::float / NULLIF(ram_total, 0) * 100), 0) as avg_ram_percent,
        COALESCE(AVG(uptime), 0) as avg_uptime
      FROM (
        SELECT DISTINCT ON (node_id) *
        FROM node_metrics
        ORDER BY node_id, time DESC
      ) latest
    `;

    const stats = latestMetrics[0] || {
      total_storage: BigInt(0),
      avg_cpu: 0,
      avg_ram_percent: 0,
      avg_uptime: 0,
    };

    return {
      totalNodes,
      activeNodes,
      totalStorage: stats.total_storage,
      avgCpu: stats.avg_cpu,
      avgRamPercent: stats.avg_ram_percent,
      avgUptime: stats.avg_uptime,
    };
  }),

  /**
   * #35: Get top/bottom performing nodes
   */
  leaderboard: publicProcedure
    .input(
      z.object({
        metric: z.enum(["uptime", "cpu", "ram", "storage"]).default("uptime"),
        order: z.enum(["top", "bottom"]).default("top"),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const { metric, order, limit } = input;

      // Use separate parameterized queries for each metric/order combination
      // to avoid SQL injection patterns
      type LeaderboardRow = {
        node_id: number;
        address: string;
        version: string | null;
        cpu_percent: number | null;
        ram_percent: number | null;
        file_size: bigint | null;
        uptime: number | null;
      };

      // Execute the appropriate query based on metric and order
      // Using separate tagged templates for each combination
      let result: LeaderboardRow[];

      if (metric === "uptime") {
        // Higher uptime is better: top = DESC, bottom = ASC
        result = order === "top"
          ? await ctx.db.$queryRaw<LeaderboardRow[]>`
              WITH latest_metrics AS (
                SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                  CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                  nm.file_size, nm.uptime
                FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
                WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
              )
              SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
              FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
              WHERE n.is_active = true
              ORDER BY lm.uptime DESC NULLS LAST LIMIT ${limit}`
          : await ctx.db.$queryRaw<LeaderboardRow[]>`
              WITH latest_metrics AS (
                SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                  CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                  nm.file_size, nm.uptime
                FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
                WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
              )
              SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
              FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
              WHERE n.is_active = true
              ORDER BY lm.uptime ASC NULLS LAST LIMIT ${limit}`;
      } else if (metric === "cpu") {
        // Lower CPU is better: top = ASC, bottom = DESC
        result = order === "top"
          ? await ctx.db.$queryRaw<LeaderboardRow[]>`
              WITH latest_metrics AS (
                SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                  CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                  nm.file_size, nm.uptime
                FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
                WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
              )
              SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
              FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
              WHERE n.is_active = true
              ORDER BY lm.cpu_percent ASC NULLS LAST LIMIT ${limit}`
          : await ctx.db.$queryRaw<LeaderboardRow[]>`
              WITH latest_metrics AS (
                SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                  CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                  nm.file_size, nm.uptime
                FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
                WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
              )
              SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
              FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
              WHERE n.is_active = true
              ORDER BY lm.cpu_percent DESC NULLS LAST LIMIT ${limit}`;
      } else if (metric === "ram") {
        // Lower RAM is better: top = ASC, bottom = DESC
        result = order === "top"
          ? await ctx.db.$queryRaw<LeaderboardRow[]>`
              WITH latest_metrics AS (
                SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                  CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                  nm.file_size, nm.uptime
                FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
                WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
              )
              SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
              FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
              WHERE n.is_active = true
              ORDER BY lm.ram_percent ASC NULLS LAST LIMIT ${limit}`
          : await ctx.db.$queryRaw<LeaderboardRow[]>`
              WITH latest_metrics AS (
                SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                  CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                  nm.file_size, nm.uptime
                FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
                WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
              )
              SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
              FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
              WHERE n.is_active = true
              ORDER BY lm.ram_percent DESC NULLS LAST LIMIT ${limit}`;
      } else {
        // storage: Higher is better: top = DESC, bottom = ASC
        result = order === "top"
          ? await ctx.db.$queryRaw<LeaderboardRow[]>`
              WITH latest_metrics AS (
                SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                  CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                  nm.file_size, nm.uptime
                FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
                WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
              )
              SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
              FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
              WHERE n.is_active = true
              ORDER BY lm.file_size DESC NULLS LAST LIMIT ${limit}`
          : await ctx.db.$queryRaw<LeaderboardRow[]>`
              WITH latest_metrics AS (
                SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                  CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                  nm.file_size, nm.uptime
                FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
                WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
              )
              SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
              FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
              WHERE n.is_active = true
              ORDER BY lm.file_size ASC NULLS LAST LIMIT ${limit}`;
      }

      return result.map((r) => ({
        nodeId: r.node_id,
        address: r.address,
        version: r.version,
        metrics: {
          cpu: r.cpu_percent,
          ram: r.ram_percent,
          storage: r.file_size,
          uptime: r.uptime,
        },
      }));
    }),

  /**
   * #31: Get metrics history for a node (for performance comparison)
   */
  metricsHistory: publicProcedure
    .input(
      z.object({
        nodeId: z.number(),
        range: z.enum(["7d", "30d", "90d"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeId, range } = input;

      // Calculate time range
      const now = new Date();
      const rangeMs = {
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
      };
      const startTime = new Date(now.getTime() - rangeMs[range]);

      // Use separate parameterized queries for each view to avoid SQL injection patterns
      type MetricsHistoryRow = {
        bucket: Date;
        avg_cpu: number | null;
        avg_ram_percent: number | null;
      };

      // Use hourly aggregates for 7d, daily for longer ranges
      const metrics = range === "7d"
        ? await ctx.db.$queryRaw<MetricsHistoryRow[]>`
            SELECT bucket, avg_cpu, avg_ram_percent
            FROM node_metrics_hourly
            WHERE node_id = ${nodeId} AND bucket >= ${startTime}
            ORDER BY bucket ASC`
        : await ctx.db.$queryRaw<MetricsHistoryRow[]>`
            SELECT bucket, avg_cpu, avg_ram_percent
            FROM node_metrics_daily
            WHERE node_id = ${nodeId} AND bucket >= ${startTime}
            ORDER BY bucket ASC`;

      return metrics.map((m) => ({
        time: m.bucket,
        cpu: m.avg_cpu,
        ram: m.avg_ram_percent,
      }));
    }),

  /**
   * #164: Get IP address change history for a node
   */
  addressHistory: publicProcedure
    .input(
      z.object({
        nodeId: z.number(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeId, limit } = input;

      const changes = await ctx.db.nodeAddressChange.findMany({
        where: { nodeId },
        orderBy: { detectedAt: "desc" },
        take: limit,
      });

      return changes.map((c) => ({
        id: c.id.toString(),
        oldAddress: c.oldAddress,
        newAddress: c.newAddress,
        detectedAt: c.detectedAt,
      }));
    }),

  /**
   * #164: Get node by pubkey
   */
  byPubkey: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const node = await ctx.db.node.findUnique({
        where: { pubkey: input },
        include: {
          _count: {
            select: { metrics: true, peers: true, addressChanges: true },
          },
        },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Node with pubkey ${input} not found`,
        });
      }

      return node;
    }),

  /**
   * #169: Get recent IP address changes across the network
   */
  recentAddressChanges: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        range: z.enum(["24h", "7d", "30d"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, range } = input;

      const rangeMs = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };

      const since = new Date(Date.now() - rangeMs[range]);

      const changes = await ctx.db.nodeAddressChange.findMany({
        where: {
          detectedAt: { gte: since },
        },
        orderBy: { detectedAt: "desc" },
        take: limit,
        include: {
          node: {
            select: {
              id: true,
              pubkey: true,
              version: true,
              isActive: true,
            },
          },
        },
      });

      // Get count of total changes in period
      const totalCount = await ctx.db.nodeAddressChange.count({
        where: {
          detectedAt: { gte: since },
        },
      });

      // Get count of unique nodes that changed
      const uniqueNodes = await ctx.db.nodeAddressChange.groupBy({
        by: ["nodeId"],
        where: {
          detectedAt: { gte: since },
        },
      });

      return {
        changes: changes.map((c) => ({
          id: c.id.toString(),
          nodeId: c.nodeId,
          pubkey: c.node.pubkey,
          version: c.node.version,
          isActive: c.node.isActive,
          oldAddress: c.oldAddress,
          newAddress: c.newAddress,
          detectedAt: c.detectedAt,
        })),
        stats: {
          totalChanges: totalCount,
          uniqueNodes: uniqueNodes.length,
          range,
        },
      };
    }),
});
