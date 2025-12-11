/**
 * Node Pruning Worker
 *
 * Manages node lifecycle transitions based on activity:
 * - ACTIVE → INACTIVE: After 24 hours of no response
 * - INACTIVE → ARCHIVED: After 7 days of no response
 *
 * Configuration via environment variables:
 * - PRUNE_INACTIVE_THRESHOLD_HOURS (default: 24)
 * - PRUNE_ARCHIVE_THRESHOLD_DAYS (default: 7)
 *
 * @see Issue #165 - Implement pruning strategy for inactive nodes
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NodeStatus } from "@prisma/client";

// Configuration with environment variable overrides
const INACTIVE_THRESHOLD_HOURS = parseInt(
  process.env.PRUNE_INACTIVE_THRESHOLD_HOURS || "24",
  10
);
const ARCHIVE_THRESHOLD_DAYS = parseInt(
  process.env.PRUNE_ARCHIVE_THRESHOLD_DAYS || "7",
  10
);

// Convert to milliseconds
const INACTIVE_THRESHOLD_MS = INACTIVE_THRESHOLD_HOURS * 60 * 60 * 1000;
const ARCHIVE_THRESHOLD_MS = ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

// Run pruning every hour
const PRUNE_INTERVAL = 60 * 60 * 1000;

export interface PruneResult {
  markedInactive: number;
  markedArchived: number;
  reactivated: number;
  timestamp: Date;
}

/**
 * Run a single pruning cycle
 */
export async function runPrune(): Promise<PruneResult> {
  const now = new Date();
  const inactiveThreshold = new Date(now.getTime() - INACTIVE_THRESHOLD_MS);
  const archiveThreshold = new Date(now.getTime() - ARCHIVE_THRESHOLD_MS);

  logger.info("Starting pruning cycle", {
    inactiveThreshold: inactiveThreshold.toISOString(),
    archiveThreshold: archiveThreshold.toISOString(),
  });

  // 1. Mark nodes as INACTIVE if not seen in >24 hours
  const markedInactive = await db.node.updateMany({
    where: {
      status: NodeStatus.ACTIVE,
      lastSeen: {
        lt: inactiveThreshold,
      },
    },
    data: {
      status: NodeStatus.INACTIVE,
      isActive: false,
    },
  });

  // 2. Mark nodes as ARCHIVED if not seen in >7 days
  const markedArchived = await db.node.updateMany({
    where: {
      status: NodeStatus.INACTIVE,
      lastSeen: {
        lt: archiveThreshold,
      },
    },
    data: {
      status: NodeStatus.ARCHIVED,
    },
  });

  // 3. Reactivate nodes that have come back online
  // (nodes marked inactive/archived but seen recently)
  const reactivated = await db.node.updateMany({
    where: {
      status: {
        in: [NodeStatus.INACTIVE, NodeStatus.ARCHIVED],
      },
      lastSeen: {
        gte: inactiveThreshold,
      },
    },
    data: {
      status: NodeStatus.ACTIVE,
      isActive: true,
    },
  });

  const result: PruneResult = {
    markedInactive: markedInactive.count,
    markedArchived: markedArchived.count,
    reactivated: reactivated.count,
    timestamp: now,
  };

  logger.info("Pruning cycle complete", result);

  return result;
}

/**
 * Get current node status distribution
 */
export async function getNodeStatusDistribution(): Promise<
  Record<NodeStatus, number>
> {
  const counts = await db.node.groupBy({
    by: ["status"],
    _count: {
      id: true,
    },
  });

  const distribution: Record<NodeStatus, number> = {
    [NodeStatus.ACTIVE]: 0,
    [NodeStatus.INACTIVE]: 0,
    [NodeStatus.ARCHIVED]: 0,
  };

  for (const row of counts) {
    distribution[row.status] = row._count.id;
  }

  return distribution;
}

/**
 * Get archived nodes for "Node Graveyard" feature
 */
export async function getArchivedNodes(options?: {
  limit?: number;
  offset?: number;
  orderBy?: "lastSeen" | "firstSeen";
}) {
  const { limit = 50, offset = 0, orderBy = "lastSeen" } = options || {};

  return db.node.findMany({
    where: {
      status: NodeStatus.ARCHIVED,
    },
    orderBy: {
      [orderBy]: "desc",
    },
    take: limit,
    skip: offset,
    select: {
      id: true,
      address: true,
      pubkey: true,
      version: true,
      firstSeen: true,
      lastSeen: true,
      isPublic: true,
    },
  });
}

// Background worker state
let pruneInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the pruning worker
 */
export function startPruner(): void {
  if (pruneInterval) {
    logger.warn("Pruner already running");
    return;
  }

  logger.info("Starting pruner worker", {
    inactiveThresholdHours: INACTIVE_THRESHOLD_HOURS,
    archiveThresholdDays: ARCHIVE_THRESHOLD_DAYS,
    intervalMs: PRUNE_INTERVAL,
  });

  // Run immediately on start
  runPrune().catch((error) => {
    logger.error("Initial prune failed", error);
  });

  // Then run on interval
  pruneInterval = setInterval(() => {
    runPrune().catch((error) => {
      logger.error("Scheduled prune failed", error);
    });
  }, PRUNE_INTERVAL);
}

/**
 * Stop the pruning worker
 */
export function stopPruner(): void {
  if (pruneInterval) {
    clearInterval(pruneInterval);
    pruneInterval = null;
    logger.info("Pruner worker stopped");
  }
}

/**
 * Check if pruner is running
 */
export function isPrunerRunning(): boolean {
  return pruneInterval !== null;
}
