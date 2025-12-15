/**
 * Node Discovery
 *
 * Discovers new nodes from get-pods responses and handles IP changes.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { CollectionResult } from "./types";
import { PRPC_PORT } from "./types";

/**
 * Process discovered peers and add new nodes
 *
 * Uses pubkey as primary identifier (per Brad's recommendation):
 * - If pubkey exists, check if node already known by pubkey
 * - If known by pubkey but address differs, log IP change
 * - Fall back to address matching for legacy nodes without pubkey
 */
export async function discoverNodes(results: CollectionResult[]) {
  // Get all known nodes with both address and pubkey
  const existingNodes = await db.node.findMany({
    select: { id: true, address: true, pubkey: true },
  });

  const knownAddresses = new Set<string>(existingNodes.map((n) => n.address));
  const knownPubkeys = new Map<string, { id: number; address: string }>();
  existingNodes.forEach((n) => {
    if (n.pubkey) {
      knownPubkeys.set(n.pubkey, { id: n.id, address: n.address });
    }
  });

  // Track what we discover
  const newNodes: Array<{
    address: string;
    pubkey: string | null;
    version: string;
    isPublic: boolean | null;
    rpcPort: number | null;
  }> = [];

  const ipChanges: Array<{
    nodeId: number;
    oldAddress: string;
    newAddress: string;
    pubkey: string;
  }> = [];

  // Process seen addresses/pubkeys to avoid duplicates within this batch
  const seenInBatch = new Set<string>();

  for (const result of results) {
    if (!result.success || !result.pods) continue;

    for (const pod of result.pods.pods) {
      // Convert gossip address to RPC address
      const rpcAddress = pod.address.replace(":9001", `:${PRPC_PORT}`);

      // Skip if already processed in this batch
      const batchKey = pod.pubkey || rpcAddress;
      if (seenInBatch.has(batchKey)) continue;
      seenInBatch.add(batchKey);

      // Strategy 1: Check by pubkey first (preferred)
      if (pod.pubkey && knownPubkeys.has(pod.pubkey)) {
        const existing = knownPubkeys.get(pod.pubkey)!;

        // Detect IP change
        if (existing.address !== rpcAddress) {
          ipChanges.push({
            nodeId: existing.id,
            oldAddress: existing.address,
            newAddress: rpcAddress,
            pubkey: pod.pubkey,
          });

          // Update our local tracking
          knownAddresses.delete(existing.address);
          knownAddresses.add(rpcAddress);
          knownPubkeys.set(pod.pubkey, {
            id: existing.id,
            address: rpcAddress,
          });
        }
        continue; // Node already exists
      }

      // Strategy 2: Check by address (legacy fallback)
      if (knownAddresses.has(rpcAddress)) {
        continue; // Node already exists
      }

      // Strategy 3: Truly new node
      knownAddresses.add(rpcAddress);
      if (pod.pubkey) {
        knownPubkeys.set(pod.pubkey, { id: -1, address: rpcAddress }); // -1 = pending creation
      }

      newNodes.push({
        address: rpcAddress,
        pubkey: pod.pubkey,
        version: pod.version,
        isPublic: pod.is_public,
        rpcPort: pod.rpc_port,
      });
    }
  }

  // Process IP changes
  if (ipChanges.length > 0) {
    logger.info("Detected IP address changes during discovery", {
      count: ipChanges.length,
    });

    for (const change of ipChanges) {
      try {
        // Check if new address already exists for another node
        const existingWithAddress = await db.node.findUnique({
          where: { address: change.newAddress },
        });

        if (existingWithAddress && existingWithAddress.id !== change.nodeId) {
          // Address conflict - another node has this address
          // Skip update to avoid unique constraint violation
          logger.warn("IP change skipped - address already exists", {
            pubkey: change.pubkey,
            oldAddress: change.oldAddress,
            newAddress: change.newAddress,
            conflictingNodeId: existingWithAddress.id,
          });
          continue;
        }

        // Log the change
        await db.nodeAddressChange.create({
          data: {
            nodeId: change.nodeId,
            oldAddress: change.oldAddress,
            newAddress: change.newAddress,
          },
        });

        // Update the node's address
        await db.node.update({
          where: { id: change.nodeId },
          data: {
            address: change.newAddress,
            gossipAddress: change.newAddress.replace(`:${PRPC_PORT}`, ":9001"),
          },
        });

        logger.info("Node IP address changed", {
          pubkey: change.pubkey,
          oldAddress: change.oldAddress,
          newAddress: change.newAddress,
        });
      } catch (error) {
        logger.error("Failed to process IP change", {
          pubkey: change.pubkey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Create new nodes
  if (newNodes.length > 0) {
    logger.info("Discovered new nodes", { count: newNodes.length });

    for (const node of newNodes) {
      await db.node.create({
        data: {
          address: node.address,
          pubkey: node.pubkey,
          version: node.version,
          isPublic: node.isPublic,
          rpcPort: node.rpcPort,
          gossipAddress: node.address.replace(`:${PRPC_PORT}`, ":9001"),
          isActive: false, // Will be tested on next collection
        },
      });
    }
  }
}
