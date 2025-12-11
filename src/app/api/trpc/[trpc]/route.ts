/**
 * tRPC API Route Handler
 *
 * This handles all tRPC requests via Next.js App Router.
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { logger } from "@/lib/logger";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            logger.error(`tRPC failed on ${path ?? "<no-path>"}`, error);
          }
        : undefined,
  });

export { handler as GET, handler as POST };
