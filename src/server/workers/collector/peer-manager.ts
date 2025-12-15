/**
 * Peer Manager
 *
 * Handles peer relationship updates between nodes.
 */

import { db } from "@/lib/db";
import type { PodsWithStatsResult } from "@/types/prpc";
import { PRPC_PORT } from "./types";

/**
 * Update peer relationships for a node
 */
export async function updatePeers(nodeId: number, pods: PodsWithStatsResult) {
  for (const pod of pods.pods) {
    const peerAddress = pod.address.replace(":9001", `:${PRPC_PORT}`);

    // Find or get peer node
    const peerNode = await db.node.findUnique({
      where: { address: peerAddress },
      select: { id: true },
    });

    // Upsert peer relationship
    await db.nodePeer.upsert({
      where: {
        nodeId_peerAddress: {
          nodeId,
          peerAddress,
        },
      },
      create: {
        nodeId,
        peerAddress,
        peerNodeId: peerNode?.id,
        peerVersion: pod.version,
        lastSeenAt: new Date(pod.last_seen_timestamp * 1000),
      },
      update: {
        peerNodeId: peerNode?.id,
        peerVersion: pod.version,
        lastSeenAt: new Date(pod.last_seen_timestamp * 1000),
      },
    });
  }
}
