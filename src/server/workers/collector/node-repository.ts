/**
 * Node Repository
 *
 * Database operations for node CRUD and status updates.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { PRPC_PORT } from "./types";

/**
 * Get or create a node in the database
 *
 * Matching strategy (per Brad's recommendation):
 * 1. First try to find by pubkey (immutable identifier)
 * 2. If found by pubkey but address differs, log the IP change and update address
 * 3. If not found by pubkey, try by address (legacy fallback)
 * 4. Create new node if neither found
 */
export async function getOrCreateNode(
  address: string,
  pubkey?: string | null,
  version?: string,
  isPublic?: boolean | null,
  rpcPort?: number | null,
) {
  // Strategy 1: Try to find by pubkey first (preferred - pubkey is immutable)
  if (pubkey) {
    const existingByPubkey = await db.node.findUnique({ where: { pubkey } });

    if (existingByPubkey) {
      // Check if IP address changed
      if (existingByPubkey.address !== address) {
        // Log the IP change
        await db.nodeAddressChange.create({
          data: {
            nodeId: existingByPubkey.id,
            oldAddress: existingByPubkey.address,
            newAddress: address,
          },
        });

        logger.info("Node IP address changed", {
          pubkey,
          oldAddress: existingByPubkey.address,
          newAddress: address,
        });
      }

      // Update node with new address and other info
      return db.node.update({
        where: { id: existingByPubkey.id },
        data: {
          address, // Update to new address
          gossipAddress: address.replace(`:${PRPC_PORT}`, ":9001"),
          version: version ?? existingByPubkey.version,
          isPublic:
            isPublic !== undefined ? isPublic : existingByPubkey.isPublic,
          rpcPort: rpcPort !== undefined ? rpcPort : existingByPubkey.rpcPort,
        },
      });
    }
  }

  // Strategy 2: Fallback to address matching (for legacy nodes without pubkey)
  const existingByAddress = await db.node.findUnique({ where: { address } });

  if (existingByAddress) {
    // Update if we have new info (but don't overwrite existing pubkey with null)
    const shouldUpdate =
      version ||
      (pubkey && !existingByAddress.pubkey) ||
      isPublic !== undefined ||
      rpcPort !== undefined;

    if (shouldUpdate) {
      return db.node.update({
        where: { id: existingByAddress.id },
        data: {
          version: version ?? existingByAddress.version,
          // Only set pubkey if it doesn't already exist (first time seeing it)
          pubkey: existingByAddress.pubkey ?? pubkey,
          isPublic:
            isPublic !== undefined ? isPublic : existingByAddress.isPublic,
          rpcPort: rpcPort !== undefined ? rpcPort : existingByAddress.rpcPort,
        },
      });
    }
    return existingByAddress;
  }

  // Strategy 3: Create new node
  return db.node.create({
    data: {
      address,
      pubkey,
      version,
      isPublic,
      rpcPort,
      gossipAddress: address.replace(`:${PRPC_PORT}`, ":9001"),
    },
  });
}

/**
 * Update node status
 */
export async function updateNodeStatus(
  nodeId: number,
  isActive: boolean,
  version?: string,
) {
  await db.node.update({
    where: { id: nodeId },
    data: {
      isActive,
      lastSeen: isActive ? new Date() : undefined,
      version: version ?? undefined,
    },
  });
}
