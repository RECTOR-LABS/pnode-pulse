/**
 * Data Collection Worker
 *
 * Collects metrics from all known pNodes on a schedule.
 * - Runs every 30 seconds
 * - Collects in parallel with timeout handling
 * - Discovers new nodes from get-pods responses
 * - Updates node status (active/inactive)
 */

import { db } from "@/lib/db";
import { PUBLIC_PNODES } from "@/lib/prpc";
import { publishMetricsUpdate } from "@/lib/redis/pubsub";
import { logger } from "@/lib/logger";

// Import sub-modules
import type { CollectionSummary } from "./types";
import { COLLECTION_INTERVAL, PRPC_PORT } from "./types";
import { collectFromNode } from "./node-poller";
import { getOrCreateNode, updateNodeStatus } from "./node-repository";
import { saveMetrics } from "./metrics-saver";
import { discoverNodes } from "./node-discovery";
import { processPrivateNodeMetrics } from "./federation-handler";
import { updatePeers } from "./peer-manager";
import { updateNodeGeolocation } from "./geolocation";
import { computeNetworkStats } from "./network-stats";

// Re-export types for external use
export type { CollectionResult, CollectionSummary } from "./types";
export { COLLECTION_INTERVAL, NODE_TIMEOUT, PRPC_PORT } from "./types";

/**
 * Main collection cycle
 */
export async function runCollection(): Promise<CollectionSummary> {
  const startTime = Date.now();
  logger.info("Starting collection cycle");

  // Create job record
  const job = await db.collectionJob.create({
    data: { status: "RUNNING" },
  });

  try {
    // Get all known nodes from DB
    const knownNodes = await db.node.findMany({
      select: { address: true },
    });

    // Also include seed nodes if not already in DB
    const allAddresses = new Set(knownNodes.map((n) => n.address));
    for (const seedIp of PUBLIC_PNODES) {
      const seedAddress = `${seedIp}:${PRPC_PORT}`;
      if (!allAddresses.has(seedAddress)) {
        allAddresses.add(seedAddress);
        // Create seed node in DB
        await getOrCreateNode(seedAddress);
      }
    }

    const addresses = Array.from(allAddresses);
    logger.info("Collecting from nodes", { count: addresses.length });

    // Collect from all nodes in parallel
    const results = await Promise.all(addresses.map(collectFromNode));

    let successCount = 0;
    let failedCount = 0;
    const successfulAddresses = new Set<string>(); // Track nodes we successfully queried

    // Process results
    for (const result of results) {
      // Extract this node's own stats from pods result (v0.7.0+)
      let isPublic: boolean | null = null;
      let rpcPort: number | null = null;
      let storageCommitted: bigint | null = null;
      let storageUsagePercent: number | null = null;

      if (result.pods) {
        // Find this node in the pods list by matching address
        const selfPod = result.pods.pods.find((p) => {
          const podRpcAddr = p.address.replace(":9001", `:${PRPC_PORT}`);
          return podRpcAddr === result.address;
        });

        if (selfPod) {
          isPublic = selfPod.is_public;
          rpcPort = selfPod.rpc_port;
          if (selfPod.storage_committed !== null) {
            storageCommitted = BigInt(selfPod.storage_committed);
          }
          storageUsagePercent = selfPod.storage_usage_percent;
        }
      }

      const node = await getOrCreateNode(
        result.address,
        undefined,
        result.version?.version,
        isPublic,
        rpcPort,
      );

      if (result.success && result.stats) {
        await saveMetrics(
          node.id,
          result.stats,
          storageCommitted,
          storageUsagePercent,
        );
        await updateNodeStatus(node.id, true, result.version?.version);
        successfulAddresses.add(result.address); // Track successful query

        // Publish real-time metrics update
        const ramPercent =
          result.stats.ram_total > 0
            ? (result.stats.ram_used / result.stats.ram_total) * 100
            : 0;
        await publishMetricsUpdate(
          node.id,
          result.stats.cpu_percent,
          ramPercent,
          result.stats.uptime,
          Number(result.stats.file_size),
        ).catch(() => {}); // Silently ignore publish errors

        if (result.pods) {
          await updatePeers(node.id, result.pods);
        }

        successCount++;
      } else {
        await updateNodeStatus(node.id, false);
        failedCount++;
        logger.warn("Collection failed for node", {
          address: result.address,
          error: result.error,
        });
      }
    }

    // Discover new nodes
    const discoveredBefore = await db.node.count();
    await discoverNodes(results);
    const discoveredAfter = await db.node.count();
    const discovered = discoveredAfter - discoveredBefore;

    // Process metrics for private nodes from get-pods-with-stats data (#175)
    // For nodes we can't query directly, save what we can from federated data
    await processPrivateNodeMetrics(results, successfulAddresses);

    // Update geolocation for nodes that don't have it
    await updateNodeGeolocation();

    // Compute network stats
    await computeNetworkStats();

    // Update job record
    await db.collectionJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        nodesPolled: addresses.length,
        nodesSuccess: successCount,
        nodesFailed: failedCount,
      },
    });

    const duration = Date.now() - startTime;

    // Count v0.7.0+ nodes with rich stats
    const nodesWithStorageStats = results.filter(
      (r) =>
        r.success && r.pods?.pods.some((p) => p.storage_committed !== null),
    ).length;

    const v070Nodes = results.filter(
      (r) => r.success && r.version?.version.startsWith("0.7"),
    ).length;

    logger.info("Collection cycle completed", {
      durationMs: duration,
      total: addresses.length,
      success: successCount,
      failed: failedCount,
      discovered,
      v070Nodes,
      nodesWithStorageStats,
    });

    return {
      total: addresses.length,
      success: successCount,
      failed: failedCount,
      discovered,
    };
  } catch (error) {
    logger.error(
      "Collection cycle failed",
      error instanceof Error ? error : new Error(String(error)),
    );

    await db.collectionJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
}

/**
 * Start the collector worker
 */
export function startCollector() {
  logger.info("Starting collector worker", { intervalMs: COLLECTION_INTERVAL });

  let currentCollection: Promise<void> | null = null;
  let isShuttingDown = false;

  // Run immediately
  currentCollection = runCollection()
    .then(() => {})
    .catch((err) => logger.error("Collection failed", err))
    .finally(() => {
      currentCollection = null;
    });

  // Then run on interval
  const interval = setInterval(() => {
    // Skip if already running or shutting down
    if (currentCollection || isShuttingDown) {
      logger.debug("Skipping collection (already running or shutting down)");
      return;
    }

    currentCollection = runCollection()
      .then(() => {})
      .catch((err) => logger.error("Collection failed", err))
      .finally(() => {
        currentCollection = null;
      });
  }, COLLECTION_INTERVAL);

  // Return cleanup function with verification
  return async () => {
    logger.info("Stopping collector worker");
    isShuttingDown = true;

    // Clear interval
    clearInterval(interval);
    logger.debug("Interval cleared");

    // Wait for any in-flight collection to complete
    if (currentCollection) {
      logger.info("Waiting for in-flight collection to complete");
      await currentCollection;
    }

    logger.info("Collector cleanup complete");
  };
}
