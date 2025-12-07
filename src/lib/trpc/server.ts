/**
 * tRPC Server Caller
 *
 * For use in Server Components to call tRPC procedures directly.
 *
 * Usage:
 * ```tsx
 * // In a Server Component
 * import { api } from "@/lib/trpc/server";
 *
 * export default async function Page() {
 *   const nodes = await api.nodes.list();
 *   return <div>{nodes.total} nodes</div>;
 * }
 * ```
 */

import "server-only";
import { cache } from "react";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

/**
 * Create a server-side caller
 * Cached per request for efficiency
 */
export const createCaller = cache(async () => {
  const ctx = await createTRPCContext();
  return appRouter.createCaller(ctx);
});

/**
 * Server-side tRPC API
 *
 * Call tRPC procedures directly in Server Components.
 * This is a convenience wrapper around the caller.
 */
export async function getApi() {
  return createCaller();
}
