/**
 * Node Poller
 *
 * Handles polling individual pNodes for data via pRPC.
 */

import { createClient, PRPCError } from "@/lib/prpc";
import type { CollectionResult } from "./types";
import { NODE_TIMEOUT, PRPC_PORT } from "./types";

/**
 * Collect data from a single pNode
 */
export async function collectFromNode(
  address: string,
): Promise<CollectionResult> {
  const ip = address.includes(":") ? address.split(":")[0] : address;
  const client = createClient(ip, { timeout: NODE_TIMEOUT });

  try {
    // Collect all data in parallel
    const [version, stats, pods] = await Promise.all([
      client.getVersion(),
      client.getStats(),
      client.getPodsWithStats(), // v0.7.0+: Returns ALL pods with rich stats
    ]);

    return {
      address: `${ip}:${PRPC_PORT}`,
      success: true,
      version,
      stats,
      pods,
    };
  } catch (error) {
    const message =
      error instanceof PRPCError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unknown error";

    return {
      address: `${ip}:${PRPC_PORT}`,
      success: false,
      error: message,
    };
  }
}
