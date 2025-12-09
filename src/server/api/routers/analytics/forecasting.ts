/**
 * Capacity Forecasting Analytics Router
 *
 * Endpoints for storage and network growth forecasting
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  forecastStorageGrowth,
  forecastNetworkGrowth,
  generateNetworkForecastSummary,
  type DataPoint,
} from "@/lib/analytics/capacity-forecaster";

export const forecastingRouter = createTRPCRouter({
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
});
