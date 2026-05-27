/**
 * tRPC handler mounted under Hono.
 *
 * Uses @trpc/server/adapters/fetch — Hono is fetch-native, so we just hand
 * the underlying Request to the tRPC adapter and return its Response.
 */

import type { Context } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../server/root";
import { createTRPCContext } from "../server/trpc";

export const trpcHandler = async (c: Context) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () => createTRPCContext(),
    onError: ({ path, error }) => {
      // tRPC error formatter already shapes the response; this is purely for logs.
      console.error(`[tRPC] ${path ?? "<no path>"}:`, error.message);
    },
  });
};
