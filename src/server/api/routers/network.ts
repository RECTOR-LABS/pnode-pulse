/**
 * Network Router
 *
 * API endpoints for network-wide statistics
 * Phase 1: Basic overview, history, collection status, peer graph
 * Phase 2: Enhanced stats, trends, aggregations (#22-26)
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const networkRouter = createTRPCRouter({
  /**
   * Get current network overview
   */
  overview: publicProcedure.query(async ({ ctx }) => {
    // Get node counts
    const [totalNodes, activeNodes] = await Promise.all([
      ctx.db.node.count(),
      ctx.db.node.count({ where: { isActive: true } }),
    ]);

    // Get version distribution
    const versionDistribution = await ctx.db.node.groupBy({
      by: ["version"],
      _count: { id: true },
      where: { isActive: true, version: { not: null } },
    });

    // Get latest aggregated metrics
    const latestStats = await ctx.db.networkStats.findFirst({
      orderBy: { time: "desc" },
    });

    return {
      nodes: {
        total: totalNodes,
        active: activeNodes,
        inactive: totalNodes - activeNodes,
      },
      versions: versionDistribution.map((v) => ({
        version: v.version || "unknown",
        count: v._count.id,
      })),
      metrics: latestStats
        ? {
            totalStorage: latestStats.totalStorage,
            avgCpu: latestStats.avgCpuPercent,
            avgRam: latestStats.avgRamPercent,
            avgUptime: latestStats.avgUptime,
            totalPeers: latestStats.totalPeers,
            timestamp: latestStats.time,
          }
        : null,
    };
  }),

  /**
   * #22: Get detailed storage statistics
   */
  storageStats: publicProcedure.query(async ({ ctx }) => {
    // Get storage from latest metrics per active node
    const result = await ctx.db.$queryRaw<Array<{
      total_storage: bigint;
      node_count: bigint;
      avg_storage: number;
      min_storage: bigint;
      max_storage: bigint;
    }>>`
      WITH latest_metrics AS (
        SELECT DISTINCT ON (nm.node_id) nm.file_size
        FROM node_metrics nm
        JOIN nodes n ON n.id = nm.node_id
        WHERE n.is_active = true AND nm.file_size IS NOT NULL
        ORDER BY nm.node_id, nm.time DESC
      )
      SELECT
        COALESCE(SUM(file_size), 0) as total_storage,
        COUNT(*) as node_count,
        COALESCE(AVG(file_size), 0) as avg_storage,
        COALESCE(MIN(file_size), 0) as min_storage,
        COALESCE(MAX(file_size), 0) as max_storage
      FROM latest_metrics
    `;

    const stats = result[0];
    return {
      totalStorage: stats?.total_storage ?? BigInt(0),
      nodeCount: Number(stats?.node_count ?? 0),
      avgStorage: stats?.avg_storage ?? 0,
      minStorage: stats?.min_storage ?? BigInt(0),
      maxStorage: stats?.max_storage ?? BigInt(0),
    };
  }),

  /**
   * #23: Get active vs inactive node trends
   */
  nodeActivityTrend: publicProcedure
    .input(
      z.object({
        range: z.enum(["24h", "7d", "30d", "90d"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const rangeHours = {
        "24h": 24,
        "7d": 7 * 24,
        "30d": 30 * 24,
        "90d": 90 * 24,
      };

      const hours = rangeHours[input.range];

      // Use network_stats for trend data
      const stats = await ctx.db.networkStats.findMany({
        where: {
          time: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
        },
        orderBy: { time: "asc" },
        select: {
          time: true,
          totalNodes: true,
          activeNodes: true,
        },
      });

      return stats.map((s) => ({
        time: s.time,
        total: s.totalNodes,
        active: s.activeNodes,
        inactive: s.totalNodes - s.activeNodes,
      }));
    }),

  /**
   * #24: Calculate network-wide uptime percentage
   */
  uptimeStats: publicProcedure.query(async ({ ctx }) => {
    // Get uptime stats from active nodes
    const result = await ctx.db.$queryRaw<Array<{
      avg_uptime: number;
      min_uptime: number;
      max_uptime: number;
      total_uptime: bigint;
      node_count: bigint;
    }>>`
      WITH latest_metrics AS (
        SELECT DISTINCT ON (nm.node_id) nm.uptime
        FROM node_metrics nm
        JOIN nodes n ON n.id = nm.node_id
        WHERE n.is_active = true AND nm.uptime IS NOT NULL
        ORDER BY nm.node_id, nm.time DESC
      )
      SELECT
        COALESCE(AVG(uptime), 0) as avg_uptime,
        COALESCE(MIN(uptime), 0) as min_uptime,
        COALESCE(MAX(uptime), 0) as max_uptime,
        COALESCE(SUM(uptime), 0) as total_uptime,
        COUNT(*) as node_count
      FROM latest_metrics
    `;

    const stats = result[0];
    const avgUptimeSeconds = stats?.avg_uptime ?? 0;

    // Calculate uptime percentage (assuming 30-day reference period)
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const uptimePercentage = Math.min(100, (avgUptimeSeconds / thirtyDaysInSeconds) * 100);

    return {
      avgUptimeSeconds: Math.round(avgUptimeSeconds),
      minUptimeSeconds: Math.round(stats?.min_uptime ?? 0),
      maxUptimeSeconds: Math.round(stats?.max_uptime ?? 0),
      totalUptimeSeconds: stats?.total_uptime ?? BigInt(0),
      nodeCount: Number(stats?.node_count ?? 0),
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
    };
  }),

  /**
   * #25: Get version distribution with historical trends
   */
  versionTrend: publicProcedure
    .input(
      z.object({
        range: z.enum(["24h", "7d", "30d"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const rangeHours = {
        "24h": 24,
        "7d": 7 * 24,
        "30d": 30 * 24,
      };

      const hours = rangeHours[input.range];

      // Get historical version distribution from network_stats
      const stats = await ctx.db.networkStats.findMany({
        where: {
          time: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
        },
        orderBy: { time: "asc" },
        select: {
          time: true,
          versionDistribution: true,
        },
      });

      // Filter out entries without version distribution and type cast
      return stats
        .filter((s) => s.versionDistribution !== null)
        .map((s) => ({
          time: s.time,
          versions: s.versionDistribution as Record<string, number>,
        }));
    }),

  /**
   * #26: Get average node metrics with percentiles
   */
  aggregateMetrics: publicProcedure.query(async ({ ctx }) => {
    // Get comprehensive metrics from active nodes
    const result = await ctx.db.$queryRaw<Array<{
      // CPU stats
      avg_cpu: number;
      min_cpu: number;
      max_cpu: number;
      p50_cpu: number;
      p90_cpu: number;
      p99_cpu: number;
      // RAM stats
      avg_ram_percent: number;
      min_ram_percent: number;
      max_ram_percent: number;
      p50_ram: number;
      p90_ram: number;
      p99_ram: number;
      // Storage stats
      avg_storage: number;
      total_storage: bigint;
      // Uptime
      avg_uptime: number;
      // Count
      node_count: bigint;
    }>>`
      WITH latest_metrics AS (
        SELECT DISTINCT ON (nm.node_id)
          nm.cpu_percent,
          CASE WHEN nm.ram_total > 0
            THEN (nm.ram_used::float / nm.ram_total * 100)
            ELSE 0
          END as ram_percent,
          nm.file_size,
          nm.uptime
        FROM node_metrics nm
        JOIN nodes n ON n.id = nm.node_id
        WHERE n.is_active = true
        ORDER BY nm.node_id, nm.time DESC
      )
      SELECT
        -- CPU
        COALESCE(AVG(cpu_percent), 0) as avg_cpu,
        COALESCE(MIN(cpu_percent), 0) as min_cpu,
        COALESCE(MAX(cpu_percent), 0) as max_cpu,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cpu_percent), 0) as p50_cpu,
        COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cpu_percent), 0) as p90_cpu,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY cpu_percent), 0) as p99_cpu,
        -- RAM
        COALESCE(AVG(ram_percent), 0) as avg_ram_percent,
        COALESCE(MIN(ram_percent), 0) as min_ram_percent,
        COALESCE(MAX(ram_percent), 0) as max_ram_percent,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ram_percent), 0) as p50_ram,
        COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ram_percent), 0) as p90_ram,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ram_percent), 0) as p99_ram,
        -- Storage
        COALESCE(AVG(file_size), 0) as avg_storage,
        COALESCE(SUM(file_size), 0) as total_storage,
        -- Uptime
        COALESCE(AVG(uptime), 0) as avg_uptime,
        -- Count
        COUNT(*) as node_count
      FROM latest_metrics
    `;

    const stats = result[0];

    return {
      cpu: {
        avg: stats?.avg_cpu ?? 0,
        min: stats?.min_cpu ?? 0,
        max: stats?.max_cpu ?? 0,
        p50: stats?.p50_cpu ?? 0,
        p90: stats?.p90_cpu ?? 0,
        p99: stats?.p99_cpu ?? 0,
      },
      ram: {
        avgPercent: stats?.avg_ram_percent ?? 0,
        minPercent: stats?.min_ram_percent ?? 0,
        maxPercent: stats?.max_ram_percent ?? 0,
        p50: stats?.p50_ram ?? 0,
        p90: stats?.p90_ram ?? 0,
        p99: stats?.p99_ram ?? 0,
      },
      storage: {
        avg: stats?.avg_storage ?? 0,
        total: stats?.total_storage ?? BigInt(0),
      },
      uptime: {
        avgSeconds: Math.round(stats?.avg_uptime ?? 0),
      },
      nodeCount: Number(stats?.node_count ?? 0),
    };
  }),

  /**
   * Get network trends from continuous aggregates
   */
  trends: publicProcedure
    .input(
      z.object({
        range: z.enum(["24h", "7d", "30d", "90d"]).default("7d"),
        metric: z.enum(["nodes", "storage", "cpu", "ram"]).default("nodes"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { range, metric } = input;

      // Determine which aggregate to use
      const useDaily = range === "30d" || range === "90d";
      const tableName = useDaily ? "network_metrics_daily" : "network_metrics_hourly";

      const rangeMs = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
      };

      const startTime = new Date(Date.now() - rangeMs[range]);

      const result = await ctx.db.$queryRawUnsafe<Array<{
        bucket: Date;
        node_count: bigint;
        total_storage: bigint;
        avg_cpu: number;
        avg_ram_percent: number;
      }>>(
        `SELECT bucket, node_count, total_storage, avg_cpu, avg_ram_percent
         FROM ${tableName}
         WHERE bucket >= $1
         ORDER BY bucket ASC`,
        startTime
      );

      return result.map((r) => ({
        time: r.bucket,
        value:
          metric === "nodes"
            ? Number(r.node_count)
            : metric === "storage"
              ? r.total_storage
              : metric === "cpu"
                ? r.avg_cpu
                : r.avg_ram_percent,
      }));
    }),

  /**
   * Get historical network stats
   */
  history: publicProcedure
    .input(
      z.object({
        range: z.enum(["24h", "7d", "30d"]).default("24h"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { range } = input;

      const rangeMs = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };

      const startTime = new Date(Date.now() - rangeMs[range]);

      const stats = await ctx.db.networkStats.findMany({
        where: { time: { gte: startTime } },
        orderBy: { time: "asc" },
      });

      return stats;
    }),

  /**
   * Get collection job status
   */
  collectionStatus: publicProcedure.query(async ({ ctx }) => {
    const [latestJob, recentJobs] = await Promise.all([
      ctx.db.collectionJob.findFirst({
        orderBy: { startedAt: "desc" },
      }),
      ctx.db.collectionJob.findMany({
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      latest: latestJob,
      recent: recentJobs,
    };
  }),

  /**
   * Get peer connectivity graph data
   */
  /**
   * #36: Get network graph data for visualization
   * Prioritizes nodes with peer connections to build a meaningful graph
   */
  peerGraph: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(100),
        includeInactive: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 100;
      const includeInactive = input?.includeInactive ?? false;

      // Get nodes that have peer connections (these form the actual graph)
      // Prioritize nodes that are part of peer relationships
      const nodesWithPeers = includeInactive
        ? await ctx.db.$queryRaw<Array<{
            id: number;
            address: string;
            version: string | null;
            is_active: boolean;
          }>>`
            SELECT DISTINCT n.id, n.address, n.version, n.is_active
            FROM nodes n
            WHERE n.id IN (
              SELECT DISTINCT node_id FROM node_peers
              UNION
              SELECT DISTINCT peer_node_id FROM node_peers WHERE peer_node_id IS NOT NULL
            )
            ORDER BY n.id
            LIMIT ${limit}
          `
        : await ctx.db.$queryRaw<Array<{
            id: number;
            address: string;
            version: string | null;
            is_active: boolean;
          }>>`
            SELECT DISTINCT n.id, n.address, n.version, n.is_active
            FROM nodes n
            WHERE n.id IN (
              SELECT DISTINCT node_id FROM node_peers
              UNION
              SELECT DISTINCT peer_node_id FROM node_peers WHERE peer_node_id IS NOT NULL
            )
            AND n.is_active = true
            ORDER BY n.id
            LIMIT ${limit}
          `;

      const nodes = nodesWithPeers.map(n => ({
        id: n.id,
        address: n.address,
        version: n.version,
        isActive: n.is_active,
      }));

      // Get node IDs for further queries
      const nodeIds = nodes.map((n) => n.id);

      if (nodeIds.length === 0) {
        return {
          nodes: [],
          edges: [],
          stats: { nodeCount: 0, edgeCount: 0, maxStorage: 1 },
        };
      }

      // Get latest storage metrics for each node
      const metrics = await ctx.db.$queryRaw<Array<{
        node_id: number;
        file_size: bigint;
      }>>`
        SELECT DISTINCT ON (node_id) node_id, file_size
        FROM node_metrics
        WHERE node_id = ANY(${nodeIds})
        ORDER BY node_id, time DESC
      `;

      const storageMap = new Map(metrics.map(m => [m.node_id, m.file_size]));

      // Build address-to-ID map for resolving peer addresses
      const addressToId = new Map(nodes.map((n) => [n.address, n.id]));
      // Also map IP-only (without port) to nodeId for matching
      const ipToId = new Map(nodes.map((n) => [n.address.split(":")[0], n.id]));

      // Get peer connections between nodes in our set
      const peerData = await ctx.db.nodePeer.findMany({
        where: {
          nodeId: { in: nodeIds },
        },
        select: {
          nodeId: true,
          peerNodeId: true,
          peerAddress: true,
        },
      });

      // Build edges from peer data, resolving by peerNodeId OR peerAddress
      const edgeSet = new Set<string>(); // Dedupe edges
      const edges: Array<{ source: number; target: number }> = [];

      for (const peer of peerData) {
        let targetId: number | null = null;

        // First try resolved peerNodeId
        if (peer.peerNodeId && nodeIds.includes(peer.peerNodeId)) {
          targetId = peer.peerNodeId;
        }
        // Fallback: resolve by peerAddress
        else if (peer.peerAddress) {
          // Try exact address match
          targetId = addressToId.get(peer.peerAddress) ?? null;
          // Try IP-only match (peerAddress might have different port)
          if (!targetId) {
            const peerIp = peer.peerAddress.split(":")[0];
            targetId = ipToId.get(peerIp) ?? null;
          }
        }

        // Add edge if target resolved and not self-loop
        if (targetId && targetId !== peer.nodeId) {
          const edgeKey = `${Math.min(peer.nodeId, targetId)}-${Math.max(peer.nodeId, targetId)}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({ source: peer.nodeId, target: targetId });
          }
        }
      }

      // Calculate max storage for normalization
      const storageValues = Array.from(storageMap.values()).map(v => Number(v));
      const maxStorage = Math.max(...storageValues, 1);

      return {
        nodes: nodes.map((n) => ({
          id: n.id,
          label: n.address.split(":")[0],
          version: n.version,
          isActive: n.isActive,
          storage: Number(storageMap.get(n.id) ?? 0),
          normalizedSize: (Number(storageMap.get(n.id) ?? 0) / maxStorage),
        })),
        edges,
        stats: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          maxStorage,
        },
      };
    }),

  /**
   * Get nodes with geolocation data for world map visualization
   */
  geoNodes: publicProcedure.query(async ({ ctx }) => {
    const nodes = await ctx.db.node.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        country: true,
        city: true,
        isActive: true,
        version: true,
      },
      orderBy: { lastSeen: "desc" },
    });

    return nodes.map((n) => ({
      id: n.id,
      latitude: n.latitude!,
      longitude: n.longitude!,
      country: n.country || "Unknown",
      city: n.city || "Unknown",
      isActive: n.isActive,
      version: n.version,
    }));
  }),

  /**
   * Get inter-country connections for geo map visualization
   * Returns aggregated connections between different countries
   */
  geoConnections: publicProcedure.query(async ({ ctx }) => {
    // Get inter-country connections aggregated by country pairs
    const connections = await ctx.db.$queryRaw<Array<{
      from_country: string;
      from_lat: number;
      from_lng: number;
      to_country: string;
      to_lat: number;
      to_lng: number;
      connection_count: bigint;
    }>>`
      SELECT
        n1.country as from_country,
        AVG(n1.latitude) as from_lat,
        AVG(n1.longitude) as from_lng,
        n2.country as to_country,
        AVG(n2.latitude) as to_lat,
        AVG(n2.longitude) as to_lng,
        COUNT(*) as connection_count
      FROM node_peers np
      JOIN nodes n1 ON np.node_id = n1.id
      JOIN nodes n2 ON np.peer_node_id = n2.id
      WHERE n1.country IS NOT NULL
        AND n2.country IS NOT NULL
        AND n1.country != n2.country
        AND n1.is_active = true
        AND n2.is_active = true
      GROUP BY n1.country, n2.country
      ORDER BY connection_count DESC
      LIMIT 50
    `;

    // Dedupe bidirectional connections (US→DE and DE→US become one line)
    const seen = new Set<string>();
    const dedupedConnections = connections.filter(conn => {
      const key = [conn.from_country, conn.to_country].sort().join('-');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Find max for normalization
    const maxCount = Math.max(...dedupedConnections.map(c => Number(c.connection_count)), 1);

    return dedupedConnections.map(conn => ({
      from: {
        country: conn.from_country,
        lat: conn.from_lat,
        lng: conn.from_lng,
      },
      to: {
        country: conn.to_country,
        lat: conn.to_lat,
        lng: conn.to_lng,
      },
      strength: Number(conn.connection_count),
      normalizedStrength: Number(conn.connection_count) / maxCount,
    }));
  }),
});
