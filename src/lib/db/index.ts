/**
 * Database client singleton
 *
 * Runs Prisma over the Neon serverless driver adapter (WebSocket-pooled),
 * which is required for Postgres access from Vercel Functions / Fluid Compute.
 * The adapter is constructed lazily-safe: the underlying pool does not connect
 * until the first query, so importing this module during `next build` (when
 * DATABASE_URL may be absent) does not throw.
 *
 * Usage:
 * ```ts
 * import { db } from "@/lib/db";
 * const nodes = await db.node.findMany();
 * ```
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({
    // Prefer the Vercel–Neon integration's managed pooled URL: it is the credential
    // the compute actually authenticates against and auto-rotates. Fall back to
    // DATABASE_URL for local dev / tests. NOTE: this DB is integration-managed, so
    // console-side password resets do NOT propagate to the compute — DATABASE_URL is
    // not the source of truth in prod. See docs / handoff for rotation procedure.
    connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Re-export types for convenience
export type {
  Node,
  NodeMetric,
  NodePeer,
  NetworkStats,
  CollectionJob,
  JobStatus,
} from "@prisma/client";
