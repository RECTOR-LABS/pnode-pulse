/**
 * Network Growth Analytics Router
 *
 * Endpoints for network growth modeling and at-risk node identification
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  generateGrowthReport,
  compareScenarios,
  type GrowthDataPoint,
} from "@/lib/analytics/growth-modeler";
import {
  predictDegradation,
  type MetricTimeSeries,
} from "@/lib/analytics/degradation-predictor";

export const growthRouter = createTRPCRouter({
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

      // Get daily node counts and storage - optimized query
      // Use simpler approach: get daily snapshot of counts directly
      const dailyStats = await ctx.db.$queryRaw<Array<{
        bucket: Date;
        total_nodes: bigint;
        active_nodes: bigint;
        total_storage: bigint;
      }>>`
        SELECT
          DATE(time) as bucket,
          COUNT(DISTINCT node_id) as total_nodes,
          COUNT(DISTINCT node_id) as active_nodes,
          MAX(file_size) as total_storage
        FROM node_metrics
        WHERE time >= ${startTime}
        GROUP BY DATE(time)
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

      const nodeIds = nodes.map((n) => n.id);

      // Batch fetch all metrics for all nodes at once (instead of N+1 queries)
      const allMetrics = await ctx.db.nodeMetric.findMany({
        where: {
          nodeId: { in: nodeIds },
          time: { gte: startTime },
        },
        orderBy: { time: "asc" },
        select: {
          nodeId: true,
          time: true,
          cpuPercent: true,
          ramUsed: true,
          ramTotal: true,
          uptime: true,
        },
      });

      // Group metrics by nodeId
      const metricsByNode = new Map<number, typeof allMetrics>();
      for (const metric of allMetrics) {
        const existing = metricsByNode.get(metric.nodeId) ?? [];
        existing.push(metric);
        metricsByNode.set(metric.nodeId, existing);
      }

      const atRiskNodes = [];

      for (const node of nodes) {
        const metrics = metricsByNode.get(node.id) ?? [];

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
