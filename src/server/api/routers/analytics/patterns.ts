/**
 * Pattern Detection Analytics Router
 *
 * Endpoints for baseline calculation and pattern deviation detection
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  calculateBaseline,
  detectPatternDeviation,
  summarizeDeviations,
  type PatternMetric,
  type BaselinePeriod,
  type NodeBaseline,
} from "@/lib/analytics/pattern-detector";

export const patternsRouter = createTRPCRouter({
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
});
