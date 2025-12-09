/**
 * Analytics Router Index
 *
 * Merges all analytics sub-routers into a single router
 */

import { createTRPCRouter } from "../../trpc";
import { healthRouter } from "./health";
import { versionRouter } from "./version";
import { storageRouter } from "./storage";
import { statisticsRouter } from "./statistics";
import { patternsRouter } from "./patterns";
import { resourcesRouter } from "./resources";
import { forecastingRouter } from "./forecasting";
import { peersRouter } from "./peers";
import { degradationRouter } from "./degradation";
import { growthRouter } from "./growth";

export const analyticsRouter = createTRPCRouter({
  // Health Analytics
  ...healthRouter._def.procedures,

  // Version Analytics
  ...versionRouter._def.procedures,

  // Storage Analytics (v0.7.0+)
  storageStats: storageRouter._def.procedures.stats,
  nodeAccessibility: storageRouter._def.procedures.nodeAccessibility,
  storageVersionDistribution: storageRouter._def.procedures.versionDistribution,

  // Statistical Analysis
  ...statisticsRouter._def.procedures,

  // Pattern Detection
  ...patternsRouter._def.procedures,

  // Resource Optimization
  ...resourcesRouter._def.procedures,

  // Capacity Forecasting
  ...forecastingRouter._def.procedures,

  // Peer Analytics
  ...peersRouter._def.procedures,

  // Degradation Prediction
  ...degradationRouter._def.procedures,

  // Growth Modeling
  ...growthRouter._def.procedures,
});
