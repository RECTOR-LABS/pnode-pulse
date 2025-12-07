/**
 * Root Router
 *
 * This is the main tRPC router that combines all sub-routers.
 */

import { createTRPCRouter } from "./trpc";
import { nodesRouter } from "./routers/nodes";
import { networkRouter } from "./routers/network";

/**
 * Main application router
 *
 * All routers are merged here.
 */
export const appRouter = createTRPCRouter({
  nodes: nodesRouter,
  network: networkRouter,
});

/**
 * Type definition for the app router
 * Used for type inference on the client side
 */
export type AppRouter = typeof appRouter;
