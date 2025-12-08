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
import { createClient, PUBLIC_PNODES, PRPCError } from "@/lib/prpc";
import { publishNetworkUpdate, publishMetricsUpdate } from "@/lib/redis/pubsub";
import type { PNodeStats, PodsResult, PNodeVersion } from "@/types/prpc";

const COLLECTION_INTERVAL = 30 * 1000; // 30 seconds
const NODE_TIMEOUT = 5000; // 5 seconds per node
const PRPC_PORT = 6000;

interface CollectionResult {
  address: string;
  success: boolean;
  version?: PNodeVersion;
  stats?: PNodeStats;
  pods?: PodsResult;
  error?: string;
}

/**
 * Collect data from a single pNode
 */
async function collectFromNode(address: string): Promise<CollectionResult> {
  const ip = address.includes(":") ? address.split(":")[0] : address;
  const client = createClient(ip, { timeout: NODE_TIMEOUT });

  try {
    // Collect all data in parallel
    const [version, stats, pods] = await Promise.all([
      client.getVersion(),
      client.getStats(),
      client.getPods(),
    ]);

    return {
      address: `${ip}:${PRPC_PORT}`,
      success: true,
      version,
      stats,
      pods,
    };
  } catch (error) {
    const message = error instanceof PRPCError
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

/**
 * Get or create a node in the database
 */
async function getOrCreateNode(address: string, pubkey?: string | null, version?: string) {
  const existing = await db.node.findUnique({ where: { address } });

  if (existing) {
    // Update if we have new info
    if (version || pubkey) {
      return db.node.update({
        where: { id: existing.id },
        data: {
          version: version ?? existing.version,
          pubkey: pubkey ?? existing.pubkey,
        },
      });
    }
    return existing;
  }

  // Create new node
  return db.node.create({
    data: {
      address,
      pubkey,
      version,
      gossipAddress: address.replace(`:${PRPC_PORT}`, ":9001"),
    },
  });
}

/**
 * Save metrics for a node
 */
async function saveMetrics(nodeId: number, stats: PNodeStats) {
  await db.nodeMetric.create({
    data: {
      nodeId,
      cpuPercent: stats.cpu_percent,
      ramUsed: BigInt(stats.ram_used),
      ramTotal: BigInt(stats.ram_total),
      uptime: stats.uptime,
      fileSize: BigInt(stats.file_size),
      totalBytes: BigInt(stats.total_bytes),
      totalPages: stats.total_pages,
      currentIndex: stats.current_index,
      packetsReceived: stats.packets_received,
      packetsSent: stats.packets_sent,
      activeStreams: stats.active_streams,
    },
  });
}

/**
 * Update node status
 */
async function updateNodeStatus(nodeId: number, isActive: boolean, version?: string) {
  await db.node.update({
    where: { id: nodeId },
    data: {
      isActive,
      lastSeen: isActive ? new Date() : undefined,
      version: version ?? undefined,
    },
  });
}

/**
 * Process discovered peers and add new nodes
 */
async function discoverNodes(results: CollectionResult[]) {
  const knownAddresses = new Set<string>();

  // Get all known addresses
  const existingNodes = await db.node.findMany({ select: { address: true } });
  existingNodes.forEach((n) => knownAddresses.add(n.address));

  // Find new nodes from pods responses
  const newNodes: Array<{ address: string; pubkey: string | null; version: string }> = [];

  for (const result of results) {
    if (!result.success || !result.pods) continue;

    for (const pod of result.pods.pods) {
      // Convert gossip address to RPC address
      const rpcAddress = pod.address.replace(":9001", `:${PRPC_PORT}`);

      if (!knownAddresses.has(rpcAddress)) {
        knownAddresses.add(rpcAddress);
        newNodes.push({
          address: rpcAddress,
          pubkey: pod.pubkey,
          version: pod.version,
        });
      }
    }
  }

  // Create new nodes
  if (newNodes.length > 0) {
    console.log(`[Collector] Discovered ${newNodes.length} new nodes`);

    for (const node of newNodes) {
      await db.node.create({
        data: {
          address: node.address,
          pubkey: node.pubkey,
          version: node.version,
          gossipAddress: node.address.replace(`:${PRPC_PORT}`, ":9001"),
          isActive: false, // Will be tested on next collection
        },
      });
    }
  }
}

/**
 * Update peer relationships
 */
async function updatePeers(nodeId: number, pods: PodsResult) {
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

/**
 * Compute and store network stats
 */
async function computeNetworkStats() {
  const result = await db.$queryRaw<Array<{
    total_nodes: bigint;
    active_nodes: bigint;
    total_storage: bigint;
    avg_cpu: number;
    avg_ram_percent: number;
    avg_uptime: number;
    total_peers: bigint;
  }>>`
    WITH latest_metrics AS (
      SELECT DISTINCT ON (node_id) *
      FROM node_metrics
      ORDER BY node_id, time DESC
    ),
    peer_counts AS (
      SELECT COUNT(*) as total FROM node_peers
    )
    SELECT
      (SELECT COUNT(*) FROM nodes) as total_nodes,
      (SELECT COUNT(*) FROM nodes WHERE is_active = true) as active_nodes,
      COALESCE(SUM(lm.file_size), 0) as total_storage,
      COALESCE(AVG(lm.cpu_percent), 0) as avg_cpu,
      COALESCE(AVG(lm.ram_used::float / NULLIF(lm.ram_total, 0) * 100), 0) as avg_ram_percent,
      COALESCE(AVG(lm.uptime), 0) as avg_uptime,
      (SELECT total FROM peer_counts) as total_peers
    FROM latest_metrics lm
  `;

  // Get version distribution from active nodes
  const versionDistribution = await db.node.groupBy({
    by: ["version"],
    _count: { id: true },
    where: { isActive: true, version: { not: null } },
  });

  // Convert to JSON object { "0.6.0": 15, "0.5.1": 10, ... }
  const versionDistJson: Record<string, number> = {};
  for (const v of versionDistribution) {
    if (v.version) {
      versionDistJson[v.version] = v._count.id;
    }
  }

  const stats = result[0];
  if (stats) {
    await db.networkStats.create({
      data: {
        totalNodes: Number(stats.total_nodes),
        activeNodes: Number(stats.active_nodes),
        totalStorage: BigInt(Math.floor(Number(stats.total_storage))),
        avgCpuPercent: stats.avg_cpu,
        avgRamPercent: stats.avg_ram_percent,
        avgUptime: Math.round(stats.avg_uptime),
        totalPeers: Number(stats.total_peers),
        versionDistribution: versionDistJson,
      },
    });

    // Publish real-time update
    await publishNetworkUpdate(
      Number(stats.total_nodes),
      Number(stats.active_nodes),
      Number(stats.total_nodes) - Number(stats.active_nodes)
    ).catch((err) => console.error("[Collector] Failed to publish network update:", err));
  }
}

/**
 * Main collection cycle
 */
export async function runCollection(): Promise<{
  total: number;
  success: number;
  failed: number;
  discovered: number;
}> {
  const startTime = Date.now();
  console.log("[Collector] Starting collection cycle...");

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
    console.log(`[Collector] Collecting from ${addresses.length} nodes...`);

    // Collect from all nodes in parallel
    const results = await Promise.all(addresses.map(collectFromNode));

    let successCount = 0;
    let failedCount = 0;

    // Process results
    for (const result of results) {
      const node = await getOrCreateNode(
        result.address,
        undefined,
        result.version?.version
      );

      if (result.success && result.stats) {
        await saveMetrics(node.id, result.stats);
        await updateNodeStatus(node.id, true, result.version?.version);

        // Publish real-time metrics update
        const ramPercent = result.stats.ram_total > 0
          ? (result.stats.ram_used / result.stats.ram_total) * 100
          : 0;
        await publishMetricsUpdate(
          node.id,
          result.stats.cpu_percent,
          ramPercent,
          result.stats.uptime,
          Number(result.stats.file_size)
        ).catch(() => {}); // Silently ignore publish errors

        if (result.pods) {
          await updatePeers(node.id, result.pods);
        }

        successCount++;
      } else {
        await updateNodeStatus(node.id, false);
        failedCount++;
        console.log(`[Collector] Failed: ${result.address} - ${result.error}`);
      }
    }

    // Discover new nodes
    const discoveredBefore = await db.node.count();
    await discoverNodes(results);
    const discoveredAfter = await db.node.count();
    const discovered = discoveredAfter - discoveredBefore;

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
    console.log(
      `[Collector] Completed in ${duration}ms: ${successCount}/${addresses.length} success, ${discovered} new nodes discovered`
    );

    return {
      total: addresses.length,
      success: successCount,
      failed: failedCount,
      discovered,
    };
  } catch (error) {
    console.error("[Collector] Error:", error);

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
  console.log("[Collector] Starting worker...");

  // Run immediately
  runCollection().catch(console.error);

  // Then run on interval
  const interval = setInterval(() => {
    runCollection().catch(console.error);
  }, COLLECTION_INTERVAL);

  // Return cleanup function
  return () => {
    console.log("[Collector] Stopping worker...");
    clearInterval(interval);
  };
}
