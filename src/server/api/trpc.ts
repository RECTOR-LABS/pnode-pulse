/**
 * tRPC Server Configuration
 *
 * This is the entry point for tRPC on the server side.
 * All routers and procedures are defined using these primitives.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth/verify-token";

/**
 * Context passed to all tRPC procedures
 */
export const createTRPCContext = async () => {
  return {
    db,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC with superjson transformer for proper Date serialization
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a router
 */
export const createTRPCRouter = t.router;

/**
 * Merge multiple routers
 */
export const mergeRouters = t.mergeRouters;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * Middleware for logging (development only)
 */
const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === "development") {
    console.log(`[tRPC] ${type} ${path} - ${duration}ms`);
  }

  return result;
});

/**
 * Logged procedure - includes timing logs in development
 */
export const loggedProcedure = t.procedure.use(loggerMiddleware);

/**
 * Authentication middleware - verifies JWT token and adds userId to context
 */
const authMiddleware = t.middleware(async ({ ctx, next, getRawInput }) => {
  const input = (await getRawInput()) as { token?: string };

  if (!input.token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication token required",
    });
  }

  const payload = await verifyToken(input.token);

  if (!payload.valid || !payload.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or expired token",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: payload.userId,
      walletAddress: payload.walletAddress,
    },
  });
});

/**
 * Protected procedure - requires valid JWT token
 * Adds userId and walletAddress to context
 */
export const protectedProcedure = t.procedure.use(authMiddleware);
