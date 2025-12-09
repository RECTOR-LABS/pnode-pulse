/**
 * Statistics Analytics Router
 *
 * Endpoints for outlier detection and statistical analysis
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  calculateSummary,
  detectOutliers,
  categorizeValue,
} from "@/lib/analytics/statistics";

export const statisticsRouter = createTRPCRouter({
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
});
