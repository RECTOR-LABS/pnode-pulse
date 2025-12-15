/**
 * Federation Handler
 *
 * Processes metrics for private nodes using federated data from public nodes.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { savePartialMetrics } from "./metrics-saver";
import type { CollectionResult } from "./types";
import { PRPC_PORT } from "./types";

/**
 * Process metrics for private nodes from get-pods-with-stats data
 *
 * For nodes we can't query directly (private nodes), we use the data
 * reported by public nodes via get-pods-with-stats. This gives us:
 * - uptime, storage_committed, storage_used, storage_usage_percent
 *
 * Issue #175: Brown noted get-pods-with-stats is less complete than get-stats,
 * but it's the only source of metrics for private nodes (~83% of network).
 */
export async function processPrivateNodeMetrics(
  results: CollectionResult[],
  successfulAddresses: Set<string>,
) {
  // Collect all pod data from successful queries, deduplicated by pubkey/address
  const podDataMap = new Map<
    string,
    {
      nodeId?: number;
      address: string;
      pubkey: string | null;
      uptime: number;
      storageCommitted: bigint | null;
      storageUsed: bigint | null;
      storageUsagePercent: number | null;
      isPublic: boolean | null;
      version: string;
    }
  >();

  for (const result of results) {
    if (!result.success || !result.pods) continue;

    for (const pod of result.pods.pods) {
      const rpcAddress = pod.address.replace(":9001", `:${PRPC_PORT}`);
      const key = pod.pubkey || rpcAddress;

      // Skip if we already successfully queried this node directly
      if (successfulAddresses.has(rpcAddress)) continue;

      // Skip if uptime is null (no useful metrics to save)
      if (pod.uptime === null) continue;

      // Store/update pod data (later results may have fresher data)
      podDataMap.set(key, {
        address: rpcAddress,
        pubkey: pod.pubkey,
        uptime: pod.uptime,
        storageCommitted:
          pod.storage_committed !== null ? BigInt(pod.storage_committed) : null,
        storageUsed:
          pod.storage_used !== null ? BigInt(pod.storage_used) : null,
        storageUsagePercent: pod.storage_usage_percent,
        isPublic: pod.is_public,
        version: pod.version,
      });
    }
  }

  if (podDataMap.size === 0) return;

  // Look up node IDs for the pods we have data for
  const addresses = Array.from(podDataMap.values()).map((p) => p.address);
  const existingNodes = await db.node.findMany({
    where: { address: { in: addresses } },
    select: { id: true, address: true, pubkey: true },
  });

  // Map addresses/pubkeys to node IDs
  const addressToId = new Map<string, number>();
  const pubkeyToId = new Map<string, number>();
  for (const node of existingNodes) {
    addressToId.set(node.address, node.id);
    if (node.pubkey) {
      pubkeyToId.set(node.pubkey, node.id);
    }
  }

  // Save partial metrics and update node status
  let savedCount = 0;
  for (const [, podData] of podDataMap) {
    // Find node ID by pubkey first, then address
    let nodeId = podData.pubkey ? pubkeyToId.get(podData.pubkey) : undefined;
    if (!nodeId) {
      nodeId = addressToId.get(podData.address);
    }

    if (!nodeId) {
      // Node doesn't exist yet - will be created by discoverNodes
      continue;
    }

    // Save partial metrics from pods data
    await savePartialMetrics(
      nodeId,
      podData.uptime,
      podData.storageCommitted,
      podData.storageUsed,
      podData.storageUsagePercent,
    );

    // Update node status - mark as active since we see it in gossip
    // Also update version and isPublic from pods data
    await db.node.update({
      where: { id: nodeId },
      data: {
        isActive: true,
        lastSeen: new Date(),
        version: podData.version,
        isPublic: podData.isPublic,
      },
    });

    savedCount++;
  }

  if (savedCount > 0) {
    logger.info("Saved partial metrics for private nodes", {
      count: savedCount,
    });
  }
}
