/**
 * Database client singleton
 *
 * Usage:
 * ```ts
 * import { db } from "@/lib/db";
 * const nodes = await db.node.findMany();
 * ```
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Re-export types for convenience
export type { Node, NodeMetric, NodePeer, NetworkStats, CollectionJob, JobStatus } from "@prisma/client";
