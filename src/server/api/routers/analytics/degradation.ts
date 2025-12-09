/**
 * Degradation Prediction Analytics Router
 *
 * Endpoints for predicting node performance degradation
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  predictDegradation,
  summarizeNetworkDegradation,
  type MetricTimeSeries,
} from "@/lib/analytics/degradation-predictor";

export const degradationRouter = createTRPCRouter({
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
});
