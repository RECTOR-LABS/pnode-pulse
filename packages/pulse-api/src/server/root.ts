/**
 * Root Router
 *
 * This is the main tRPC router that combines all sub-routers.
 */

import { createTRPCRouter } from "./trpc";
import { nodesRouter } from "./routers/nodes";
import { networkRouter } from "./routers/network";
import { alertsRouter } from "./routers/alerts";
import { portfolioRouter } from "./routers/portfolio";
import { comparisonRouter } from "./routers/comparison";
import { exportRouter } from "./routers/export";
import { reportsRouter } from "./routers/reports";
import { authRouter } from "./routers/auth";
import { claimsRouter } from "./routers/claims";
import { apiKeysRouter } from "./routers/apiKeys";
import { profilesRouter } from "./routers/profiles";
import { badgesRouter } from "./routers/badges";
import { analyticsRouter } from "./routers/analytics";

/**
 * Main application router
 *
 * All routers are merged here.
 */
export const appRouter = createTRPCRouter({
  nodes: nodesRouter,
  network: networkRouter,
  alerts: alertsRouter,
  portfolio: portfolioRouter,
  comparison: comparisonRouter,
  export: exportRouter,
  reports: reportsRouter,
  auth: authRouter,
  claims: claimsRouter,
  apiKeys: apiKeysRouter,
  profiles: profilesRouter,
  badges: badgesRouter,
  analytics: analyticsRouter,
});

/**
 * Type definition for the app router
 * Used for type inference on the client side
 */
export type AppRouter = typeof appRouter;
