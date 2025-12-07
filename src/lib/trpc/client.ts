/**
 * tRPC React Client
 *
 * Usage in components:
 * ```tsx
 * const { data } = trpc.nodes.list.useQuery();
 * ```
 */

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/api/root";

export const trpc = createTRPCReact<AppRouter>();
