/**
 * Analytics Router
 *
 * API endpoints for health scores, version advisories,
 * and outlier detection.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  calculateNodeHealth,
  calculateNetworkHealth,
  type NodeMetrics,
  type NetworkStats,
  type HealthScore,
} from "@/lib/analytics/health-scorer";
import {
  generateVersionAdvisory,
  analyzeVersionDistribution,
  findLatestVersion,
} from "@/lib/analytics/version-advisor";
import {
  calculateSummary,
  detectOutliers,
  categorizeValue,
} from "@/lib/analytics/statistics";
import {
  calculateBaseline,
  detectPatternDeviation,
  summarizeDeviations,
  type PatternMetric,
  type BaselinePeriod,
  type NodeBaseline,
} from "@/lib/analytics/pattern-detector";
import {
  generateTuningRecommendations,
  summarizeRecommendations,
  type NodeResourceMetrics,
} from "@/lib/analytics/resource-tuner";
import {
  forecastStorageGrowth,
  forecastNetworkGrowth,
  generateNetworkForecastSummary,
  type DataPoint,
} from "@/lib/analytics/capacity-forecaster";
import {
  analyzePeerConnectivity,
  analyzeNetworkConnectivity,
  identifyOptimizationOpportunities,
  type PeerInfo,
} from "@/lib/analytics/peer-optimizer";
import {
  predictDegradation,
  summarizeNetworkDegradation,
  type MetricTimeSeries,
} from "@/lib/analytics/degradation-predictor";
import {
  calculateGrowthMetrics,
  generateGrowthReport,
  compareScenarios,
  type GrowthDataPoint,
} from "@/lib/analytics/growth-modeler";

export const analyticsRouter = createTRPCRouter({
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

  /**
   * Detect outliers across the network
   */
  outliers: publicProcedure
    .input(
      z.object({
        metric: z.enum(["cpu", "ram", "uptime"]).default("cpu"),
        threshold: z.number().min(1).max(4).default(2),
      })
    )
    .query(async ({ ctx, input }) => {
      const { metric, threshold } = input;

      // Get all active nodes with latest metrics
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        select: { id: true, address: true, version: true },
      });

      const nodeIds = nodes.map((n) => n.id);

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

      // Build metrics array based on selected metric
      const metricsMap = new Map(
        latestMetrics.map((m) => [m.node_id, m])
      );

      const values: Array<{ nodeId: number; value: number }> = [];

      nodes.forEach((node) => {
        const m = metricsMap.get(node.id);
        if (!m) return;

        let value: number;
        switch (metric) {
          case "cpu":
            value = m.cpu_percent;
            break;
          case "ram":
            value = Number(m.ram_total) > 0
              ? (Number(m.ram_used) / Number(m.ram_total)) * 100
              : 0;
            break;
          case "uptime":
            value = m.uptime;
            break;
        }

        values.push({ nodeId: node.id, value });
      });

      const numericValues = values.map((v) => v.value);
      const summary = calculateSummary(numericValues);
      const outlierIndices = detectOutliers(numericValues, threshold);

      // Build outlier results
      const outliers = outlierIndices.map((idx) => {
        const { nodeId, value } = values[idx];
        const node = nodes.find((n) => n.id === nodeId);
        const category = categorizeValue(value, summary.mean, summary.stdDev);

        return {
          nodeId,
          address: node?.address ?? "",
          version: node?.version ?? null,
          value,
          zScore: summary.stdDev > 0 ? (value - summary.mean) / summary.stdDev : 0,
          category,
        };
      });

      // Sort by z-score (most extreme first)
      outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

      return {
        metric,
        threshold,
        summary,
        outliers,
        totalNodes: nodes.length,
        outlierCount: outliers.length,
      };
    }),

  /**
   * Calculate baseline for a node's metrics
   */
  nodeBaseline: publicProcedure
    .input(
      z.object({
        nodeId: z.number(),
        metric: z.enum(["cpu", "ram", "uptime", "packets_received", "packets_sent"]).default("cpu"),
        period: z.enum(["7d", "14d", "30d"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeId, metric, period } = input;

      // Calculate time range
      const now = new Date();
      const periodDays = { "7d": 7, "14d": 14, "30d": 30 }[period];
      const startTime = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

      // Get historical metrics
      const metrics = await ctx.db.nodeMetric.findMany({
        where: {
          nodeId,
          time: { gte: startTime },
        },
        orderBy: { time: "asc" },
        select: {
          time: true,
          cpuPercent: true,
          ramUsed: true,
          ramTotal: true,
          uptime: true,
          packetsReceived: true,
          packetsSent: true,
        },
      });

      if (metrics.length === 0) {
        return null;
      }

      // Extract values based on metric
      const values = metrics.map((m) => {
        let value: number;
        switch (metric) {
          case "cpu":
            value = m.cpuPercent ?? 0;
            break;
          case "ram":
            value = Number(m.ramTotal) > 0
              ? (Number(m.ramUsed) / Number(m.ramTotal)) * 100
              : 0;
            break;
          case "uptime":
            value = m.uptime ?? 0;
            break;
          case "packets_received":
            value = m.packetsReceived ?? 0;
            break;
          case "packets_sent":
            value = m.packetsSent ?? 0;
            break;
        }
        return { value, timestamp: m.time };
      });

      const baselineData = calculateBaseline(values, period as BaselinePeriod);

      return {
        nodeId,
        metric: metric as PatternMetric,
        period: period as BaselinePeriod,
        stats: {
          mean: baselineData.mean,
          median: baselineData.median,
          stdDev: baselineData.stdDev,
          min: baselineData.min,
          max: baselineData.max,
          count: baselineData.count,
        },
        hourlyPattern: baselineData.hourlyPattern,
        dayOfWeekPattern: baselineData.dayOfWeekPattern,
        dataPoints: values.length,
      };
    }),

  /**
   * Detect pattern deviations for a node
   */
  nodePatternDeviations: publicProcedure
    .input(
      z.object({
        nodeId: z.number(),
        metric: z.enum(["cpu", "ram"]).default("cpu"),
        period: z.enum(["7d", "14d", "30d"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeId, metric, period } = input;

      // Calculate baseline
      const periodDays = { "7d": 7, "14d": 14, "30d": 30 }[period];
      const startTime = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      const metrics = await ctx.db.nodeMetric.findMany({
        where: {
          nodeId,
          time: { gte: startTime },
        },
        orderBy: { time: "asc" },
        select: {
          time: true,
          cpuPercent: true,
          ramUsed: true,
          ramTotal: true,
        },
      });

      if (metrics.length < 10) {
        return { hasEnoughData: false, deviations: [] };
      }

      // Extract values
      const values = metrics.map((m) => ({
        value: metric === "cpu"
          ? (m.cpuPercent ?? 0)
          : Number(m.ramTotal) > 0
            ? (Number(m.ramUsed) / Number(m.ramTotal)) * 100
            : 0,
        timestamp: m.time,
      }));

      const baselineData = calculateBaseline(values, period as BaselinePeriod);

      // Get latest metric
      const latestMetric = metrics[metrics.length - 1];
      const currentValue = metric === "cpu"
        ? (latestMetric.cpuPercent ?? 0)
        : Number(latestMetric.ramTotal) > 0
          ? (Number(latestMetric.ramUsed) / Number(latestMetric.ramTotal)) * 100
          : 0;

      const baseline: NodeBaseline = {
        nodeId,
        metric: metric as PatternMetric,
        period: period as BaselinePeriod,
        stats: baselineData,
        hourlyPattern: baselineData.hourlyPattern,
        dayOfWeekPattern: baselineData.dayOfWeekPattern,
        updatedAt: new Date(),
      };

      const deviation = detectPatternDeviation(
        nodeId,
        metric as PatternMetric,
        currentValue,
        baseline
      );

      return {
        hasEnoughData: true,
        baseline: {
          mean: baselineData.mean,
          stdDev: baselineData.stdDev,
        },
        current: {
          value: currentValue,
          timestamp: latestMetric.time,
        },
        deviation: deviation ? {
          ...deviation,
          timestamp: deviation.timestamp.toISOString(),
        } : null,
      };
    }),

  /**
   * Network-wide pattern deviation summary
   */
  networkPatternDeviations: publicProcedure
    .input(
      z.object({
        metric: z.enum(["cpu", "ram"]).default("cpu"),
        period: z.enum(["7d", "14d"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { metric, period } = input;

      // Get all active nodes
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        select: { id: true, address: true },
        take: 100, // Limit for performance
      });

      const periodDays = { "7d": 7, "14d": 14 }[period];
      const startTime = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      // Get aggregated metrics for all nodes
      const allDeviations = [];

      for (const node of nodes) {
        const metrics = await ctx.db.nodeMetric.findMany({
          where: {
            nodeId: node.id,
            time: { gte: startTime },
          },
          orderBy: { time: "asc" },
          select: {
            time: true,
            cpuPercent: true,
            ramUsed: true,
            ramTotal: true,
          },
        });

        if (metrics.length < 10) continue;

        const values = metrics.map((m) => ({
          value: metric === "cpu"
            ? (m.cpuPercent ?? 0)
            : Number(m.ramTotal) > 0
              ? (Number(m.ramUsed) / Number(m.ramTotal)) * 100
              : 0,
          timestamp: m.time,
        }));

        const baselineData = calculateBaseline(values, period as BaselinePeriod);
        const latestMetric = metrics[metrics.length - 1];
        const currentValue = metric === "cpu"
          ? (latestMetric.cpuPercent ?? 0)
          : Number(latestMetric.ramTotal) > 0
            ? (Number(latestMetric.ramUsed) / Number(latestMetric.ramTotal)) * 100
            : 0;

        const baseline: NodeBaseline = {
          nodeId: node.id,
          metric: metric as PatternMetric,
          period: period as BaselinePeriod,
          stats: baselineData,
          hourlyPattern: baselineData.hourlyPattern,
          dayOfWeekPattern: baselineData.dayOfWeekPattern,
          updatedAt: new Date(),
        };

        const deviation = detectPatternDeviation(
          node.id,
          metric as PatternMetric,
          currentValue,
          baseline
        );

        if (deviation) {
          allDeviations.push({
            ...deviation,
            address: node.address,
          });
        }
      }

      const summary = summarizeDeviations(allDeviations);

      return {
        metric,
        period,
        totalNodesAnalyzed: nodes.length,
        ...summary,
        topDeviations: summary.topDeviations.map((d) => ({
          ...d,
          timestamp: d.timestamp.toISOString(),
        })),
      };
    }),

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

  /**
   * Forecast storage growth for a node
   */
  nodeStorageForecast: publicProcedure
    .input(
      z.object({
        nodeId: z.number(),
        period: z.enum(["7d", "14d", "30d"]).default("14d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeId, period } = input;

      const periodDays = { "7d": 7, "14d": 14, "30d": 30 }[period];
      const startTime = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      // Get daily aggregated storage data
      const metrics = await ctx.db.$queryRaw<Array<{
        bucket: Date;
        max_file_size: bigint | null;
      }>>`
        SELECT
          date_trunc('day', time) as bucket,
          MAX(file_size) as max_file_size
        FROM node_metrics
        WHERE node_id = ${nodeId} AND time >= ${startTime}
        GROUP BY date_trunc('day', time)
        ORDER BY bucket ASC
      `;

      if (metrics.length < 3) {
        return { hasEnoughData: false, forecast: null };
      }

      const dataPoints: DataPoint[] = metrics
        .filter((m) => m.max_file_size !== null)
        .map((m) => ({
          timestamp: m.bucket,
          value: Number(m.max_file_size),
        }));

      const forecast = forecastStorageGrowth(dataPoints);

      return {
        hasEnoughData: true,
        dataPoints: dataPoints.length,
        forecast: forecast ? {
          ...forecast,
          currentTimestamp: forecast.currentTimestamp.toISOString(),
        } : null,
      };
    }),

  /**
   * Forecast network-wide capacity and growth
   */
  networkForecast: publicProcedure
    .input(
      z.object({
        period: z.enum(["14d", "30d"]).default("30d"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const period = input?.period ?? "30d";
      const periodDays = { "14d": 14, "30d": 30 }[period];
      const startTime = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      // Get daily total storage across all nodes
      const storageHistory = await ctx.db.$queryRaw<Array<{
        bucket: Date;
        total_storage: bigint | null;
      }>>`
        SELECT
          date_trunc('day', time) as bucket,
          SUM(file_size) as total_storage
        FROM (
          SELECT DISTINCT ON (node_id, date_trunc('day', time))
            node_id, time, file_size
          FROM node_metrics
          WHERE time >= ${startTime}
          ORDER BY node_id, date_trunc('day', time), time DESC
        ) daily_latest
        GROUP BY date_trunc('day', time)
        ORDER BY bucket ASC
      `;

      // Get daily node counts (this is simplified - would need network_stats table in production)
      const [currentActive, currentTotal] = await Promise.all([
        ctx.db.node.count({ where: { isActive: true } }),
        ctx.db.node.count(),
      ]);

      // Prepare storage data points
      const storageDataPoints: DataPoint[] = storageHistory
        .filter((m) => m.total_storage !== null)
        .map((m) => ({
          timestamp: m.bucket,
          value: Number(m.total_storage),
        }));

      // Calculate forecasts
      const storageForecast = storageDataPoints.length >= 3
        ? forecastStorageGrowth(storageDataPoints)
        : null;

      // For node growth, we'd need historical node count data
      // For now, create a simple projection based on current state
      const nodeGrowthForecast = forecastNetworkGrowth(
        [{ timestamp: new Date(), value: currentTotal }],
        currentActive,
        currentTotal
      );

      const summary = generateNetworkForecastSummary(
        storageForecast,
        nodeGrowthForecast
      );

      return {
        period,
        storage: storageForecast ? {
          ...storageForecast,
          currentTimestamp: storageForecast.currentTimestamp.toISOString(),
          // Convert bytes to GB for readability
          currentValueGB: storageForecast.currentValue / (1024 * 1024 * 1024),
          predictionsGB: {
            nextWeek: storageForecast.predictions.nextWeek / (1024 * 1024 * 1024),
            nextMonth: storageForecast.predictions.nextMonth / (1024 * 1024 * 1024),
            next3Months: storageForecast.predictions.next3Months / (1024 * 1024 * 1024),
            next6Months: storageForecast.predictions.next6Months / (1024 * 1024 * 1024),
          },
        } : null,
        nodes: {
          current: {
            total: currentTotal,
            active: currentActive,
            inactive: currentTotal - currentActive,
          },
        },
        summary,
        dataPointsAvailable: storageDataPoints.length,
      };
    }),

  /**
   * Analyze peer connectivity for a single node
   */
  nodePeerAnalysis: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input: nodeId }) => {
      const node = await ctx.db.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return null;
      }

      // Get all peers for this node with optional linked node data
      const peers = await ctx.db.nodePeer.findMany({
        where: { nodeId },
        include: {
          peerNode: {
            select: {
              isActive: true,
              lastSeen: true,
            },
          },
        },
      });

      const peerInfos: PeerInfo[] = peers.map((p) => ({
        peerId: p.peerNodeId ?? p.id,
        address: p.peerAddress,
        version: p.peerVersion ?? undefined,
        isActive: p.peerNode?.isActive ?? true, // Assume active if not linked
        lastSeenAt: p.peerNode?.lastSeen ?? p.lastSeenAt,
      }));

      const analysis = analyzePeerConnectivity(nodeId, node.address, peerInfos);

      return {
        ...analysis,
        nodeName: node.address,
      };
    }),

  /**
   * Get network-wide connectivity summary
   */
  networkConnectivity: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(100),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 100;

      // Get active nodes
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        take: limit,
        select: { id: true, address: true },
      });

      const nodeIds = nodes.map((n) => n.id);

      // Get all peers for these nodes with optional linked node data
      const allPeers = await ctx.db.nodePeer.findMany({
        where: { nodeId: { in: nodeIds } },
        include: {
          peerNode: {
            select: {
              isActive: true,
              lastSeen: true,
            },
          },
        },
      });

      // Group peers by nodeId
      const peersByNode = new Map<number, PeerInfo[]>();
      nodeIds.forEach((id) => peersByNode.set(id, []));

      allPeers.forEach((p) => {
        const peers = peersByNode.get(p.nodeId) ?? [];
        peers.push({
          peerId: p.peerNodeId ?? p.id,
          address: p.peerAddress,
          version: p.peerVersion ?? undefined,
          isActive: p.peerNode?.isActive ?? true,
          lastSeenAt: p.peerNode?.lastSeen ?? p.lastSeenAt,
        });
        peersByNode.set(p.nodeId, peers);
      });

      // Analyze each node
      const nodeAnalyses = nodes.map((node) => {
        const peers = peersByNode.get(node.id) ?? [];
        return analyzePeerConnectivity(node.id, node.address, peers);
      });

      // Get network summary
      const networkSummary = analyzeNetworkConnectivity(nodeAnalyses);

      return {
        ...networkSummary,
        analyzedNodes: nodes.length,
      };
    }),

  /**
   * Identify peer optimization opportunities across the network
   */
  peerOptimizations: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        priorityFilter: z.enum(["all", "critical", "high", "medium"]).default("all"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const priorityFilter = input?.priorityFilter ?? "all";

      // Get active nodes
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        select: { id: true, address: true },
      });

      const nodeIds = nodes.map((n) => n.id);

      // Get peer counts efficiently
      const peerCounts = await ctx.db.nodePeer.groupBy({
        by: ["nodeId"],
        where: { nodeId: { in: nodeIds } },
        _count: { id: true },
      });

      // Get active peer counts (peers that are also active nodes)
      const activePeerCounts = await ctx.db.$queryRaw<Array<{
        node_id: number;
        active_peers: bigint;
      }>>`
        SELECT
          np.node_id,
          COUNT(*) FILTER (WHERE n.is_active = true) as active_peers
        FROM node_peers np
        JOIN nodes n ON n.id = np.peer_id
        WHERE np.node_id = ANY(${nodeIds})
        GROUP BY np.node_id
      `;

      const totalPeerMap = new Map(
        peerCounts.map((p) => [p.nodeId, p._count.id])
      );
      const activePeerMap = new Map(
        activePeerCounts.map((p) => [p.node_id, Number(p.active_peers)])
      );

      // Create simplified analyses for optimization detection
      const nodeAnalyses = nodes.map((node) => ({
        nodeId: node.id,
        address: node.address,
        totalPeers: totalPeerMap.get(node.id) ?? 0,
        activePeers: activePeerMap.get(node.id) ?? 0,
        inactivePeers: (totalPeerMap.get(node.id) ?? 0) - (activePeerMap.get(node.id) ?? 0),
        versionDiversity: 0,
        peerVersions: [],
        healthScore: 50 + Math.min((activePeerMap.get(node.id) ?? 0) * 3, 40),
        recommendations: [],
      }));

      // Identify optimizations
      let optimizations = identifyOptimizationOpportunities(nodeAnalyses);

      // Filter by priority if specified
      if (priorityFilter !== "all") {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const maxPriority = priorityOrder[priorityFilter];
        optimizations = optimizations.filter(
          (o) => priorityOrder[o.priority] <= maxPriority
        );
      }

      // Limit results
      optimizations = optimizations.slice(0, limit);

      // Summary stats
      const summary = {
        totalNodesAnalyzed: nodes.length,
        nodesNeedingOptimization: optimizations.length,
        byPriority: {
          critical: optimizations.filter((o) => o.priority === "critical").length,
          high: optimizations.filter((o) => o.priority === "high").length,
          medium: optimizations.filter((o) => o.priority === "medium").length,
          low: optimizations.filter((o) => o.priority === "low").length,
        },
      };

      return {
        optimizations,
        summary,
      };
    }),

  /**
   * Predict degradation for a single node
   */
  nodeDegradation: publicProcedure
    .input(
      z.object({
        nodeId: z.number(),
        period: z.enum(["24h", "48h", "7d"]).default("48h"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeId, period } = input;

      const periodHours = { "24h": 24, "48h": 48, "7d": 168 }[period];
      const startTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);

      // Get node info
      const node = await ctx.db.node.findUnique({
        where: { id: nodeId },
        select: { address: true },
      });

      if (!node) {
        return null;
      }

      // Get historical metrics
      const metrics = await ctx.db.nodeMetric.findMany({
        where: {
          nodeId,
          time: { gte: startTime },
        },
        orderBy: { time: "asc" },
        select: {
          time: true,
          cpuPercent: true,
          ramUsed: true,
          ramTotal: true,
          uptime: true,
        },
      });

      if (metrics.length < 3) {
        return { hasEnoughData: false, indicators: null };
      }

      // Build time series
      const cpuHistory: MetricTimeSeries[] = metrics.map((m) => ({
        timestamp: m.time,
        value: m.cpuPercent ?? 0,
      }));

      const ramHistory: MetricTimeSeries[] = metrics.map((m) => ({
        timestamp: m.time,
        value: Number(m.ramTotal) > 0
          ? (Number(m.ramUsed) / Number(m.ramTotal)) * 100
          : 0,
      }));

      const uptimeHistory: MetricTimeSeries[] = metrics.map((m) => ({
        timestamp: m.time,
        value: m.uptime ?? 0,
      }));

      const indicators = predictDegradation(cpuHistory, ramHistory, uptimeHistory);

      return {
        hasEnoughData: true,
        nodeId,
        address: node.address,
        period,
        dataPoints: metrics.length,
        indicators,
      };
    }),

  /**
   * Get network-wide degradation summary
   */
  networkDegradation: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const startTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h

      // Get active nodes
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        take: limit,
        select: { id: true, address: true },
      });

      const nodeAnalyses = [];

      for (const node of nodes) {
        const metrics = await ctx.db.nodeMetric.findMany({
          where: {
            nodeId: node.id,
            time: { gte: startTime },
          },
          orderBy: { time: "asc" },
          select: {
            time: true,
            cpuPercent: true,
            ramUsed: true,
            ramTotal: true,
            uptime: true,
          },
        });

        if (metrics.length < 3) continue;

        const cpuHistory: MetricTimeSeries[] = metrics.map((m) => ({
          timestamp: m.time,
          value: m.cpuPercent ?? 0,
        }));

        const ramHistory: MetricTimeSeries[] = metrics.map((m) => ({
          timestamp: m.time,
          value: Number(m.ramTotal) > 0
            ? (Number(m.ramUsed) / Number(m.ramTotal)) * 100
            : 0,
        }));

        const uptimeHistory: MetricTimeSeries[] = metrics.map((m) => ({
          timestamp: m.time,
          value: m.uptime ?? 0,
        }));

        const indicators = predictDegradation(cpuHistory, ramHistory, uptimeHistory);

        nodeAnalyses.push({
          nodeId: node.id,
          address: node.address,
          indicators,
        });
      }

      const summary = summarizeNetworkDegradation(nodeAnalyses);

      return {
        analyzedNodes: nodeAnalyses.length,
        ...summary,
      };
    }),

  /**
   * Get network growth report with scenario forecasts
   */
  networkGrowth: publicProcedure
    .input(
      z.object({
        period: z.enum(["14d", "30d", "60d"]).default("30d"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const period = input?.period ?? "30d";
      const periodDays = { "14d": 14, "30d": 30, "60d": 60 }[period];
      const startTime = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      // Get daily node counts and storage
      const dailyStats = await ctx.db.$queryRaw<Array<{
        bucket: Date;
        total_nodes: bigint;
        active_nodes: bigint;
        total_storage: bigint;
      }>>`
        WITH daily_snapshots AS (
          SELECT DISTINCT ON (date_trunc('day', time))
            date_trunc('day', time) as bucket,
            (SELECT COUNT(*) FROM nodes WHERE created_at <= time) as total_nodes,
            (SELECT COUNT(*) FROM nodes WHERE is_active = true AND created_at <= time) as active_nodes,
            (SELECT COALESCE(SUM(file_size), 0) FROM node_metrics WHERE time <= nm.time) as total_storage
          FROM node_metrics nm
          WHERE time >= ${startTime}
          ORDER BY date_trunc('day', time), time DESC
        )
        SELECT
          bucket,
          total_nodes,
          active_nodes,
          total_storage
        FROM daily_snapshots
        ORDER BY bucket ASC
      `;

      // If raw query doesn't work well, fallback to simpler approach
      if (dailyStats.length < 3) {
        // Get current counts
        const [totalNodes, activeNodes] = await Promise.all([
          ctx.db.node.count(),
          ctx.db.node.count({ where: { isActive: true } }),
        ]);

        const latestStorage = await ctx.db.nodeMetric.aggregate({
          _sum: { fileSize: true },
        });

        return {
          hasEnoughData: false,
          current: {
            totalNodes,
            activeNodes,
            storageTB: Number(latestStorage._sum.fileSize ?? 0) / (1024 ** 4),
          },
          report: null,
        };
      }

      // Build growth data points
      const history: GrowthDataPoint[] = dailyStats.map((d) => ({
        timestamp: d.bucket,
        totalNodes: Number(d.total_nodes),
        activeNodes: Number(d.active_nodes),
        totalStorageBytes: Number(d.total_storage),
      }));

      const report = generateGrowthReport(history, periodDays);

      if (!report) {
        return { hasEnoughData: false, current: null, report: null };
      }

      const scenarioComparison = compareScenarios(report.scenarios);

      return {
        hasEnoughData: true,
        period,
        dataPoints: history.length,
        report: {
          ...report,
          generatedAt: report.generatedAt.toISOString(),
          period: {
            start: report.period.start.toISOString(),
            end: report.period.end.toISOString(),
          },
          scenarios: report.scenarios.map((s) => ({
            ...s,
            predictions: {
              days30: {
                ...s.predictions.days30,
                date: s.predictions.days30.date.toISOString(),
              },
              days60: {
                ...s.predictions.days60,
                date: s.predictions.days60.date.toISOString(),
              },
              days90: {
                ...s.predictions.days90,
                date: s.predictions.days90.date.toISOString(),
              },
            },
            milestones: s.milestones.map((m) => ({
              ...m,
              estimatedDate: m.estimatedDate?.toISOString() ?? null,
            })),
          })),
        },
        scenarioComparison,
      };
    }),

  /**
   * Get at-risk nodes requiring attention
   */
  atRiskNodes: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        minRiskScore: z.number().min(0).max(100).default(20),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const minRiskScore = input?.minRiskScore ?? 20;
      const startTime = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Get active nodes
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        select: { id: true, address: true, version: true },
      });

      const atRiskNodes = [];

      for (const node of nodes) {
        const metrics = await ctx.db.nodeMetric.findMany({
          where: {
            nodeId: node.id,
            time: { gte: startTime },
          },
          orderBy: { time: "asc" },
          select: {
            time: true,
            cpuPercent: true,
            ramUsed: true,
            ramTotal: true,
            uptime: true,
          },
        });

        if (metrics.length < 3) continue;

        const cpuHistory: MetricTimeSeries[] = metrics.map((m) => ({
          timestamp: m.time,
          value: m.cpuPercent ?? 0,
        }));

        const ramHistory: MetricTimeSeries[] = metrics.map((m) => ({
          timestamp: m.time,
          value: Number(m.ramTotal) > 0
            ? (Number(m.ramUsed) / Number(m.ramTotal)) * 100
            : 0,
        }));

        const uptimeHistory: MetricTimeSeries[] = metrics.map((m) => ({
          timestamp: m.time,
          value: m.uptime ?? 0,
        }));

        const indicators = predictDegradation(cpuHistory, ramHistory, uptimeHistory);

        if (indicators.riskScore >= minRiskScore) {
          atRiskNodes.push({
            nodeId: node.id,
            address: node.address,
            version: node.version,
            riskLevel: indicators.overallRisk,
            riskScore: indicators.riskScore,
            topPrediction: indicators.predictions[0] ?? null,
            cpuTrend: indicators.cpuTrend.trend,
            ramTrend: indicators.ramTrend.trend,
          });
        }
      }

      // Sort by risk score descending
      atRiskNodes.sort((a, b) => b.riskScore - a.riskScore);

      return {
        totalAnalyzed: nodes.length,
        atRiskCount: atRiskNodes.length,
        nodes: atRiskNodes.slice(0, limit),
      };
    }),
});

/**
 * Helper to get network-wide statistics for health scoring
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
