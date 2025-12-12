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
import type { PNodeStats, PodsWithStatsResult, PNodeVersion } from "@/types/prpc";
import { logger } from "@/lib/logger";

const COLLECTION_INTERVAL = 30 * 1000; // 30 seconds
const NODE_TIMEOUT = 5000; // 5 seconds per node
const PRPC_PORT = 6000;

interface CollectionResult {
  address: string;
  success: boolean;
  version?: PNodeVersion;
  stats?: PNodeStats;
  pods?: PodsWithStatsResult;
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
 *
 * Matching strategy (per Brad's recommendation):
 * 1. First try to find by pubkey (immutable identifier)
 * 2. If found by pubkey but address differs, log the IP change and update address
 * 3. If not found by pubkey, try by address (legacy fallback)
 * 4. Create new node if neither found
 */
async function getOrCreateNode(
  address: string,
  pubkey?: string | null,
  version?: string,
  isPublic?: boolean | null,
  rpcPort?: number | null
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
          isPublic: isPublic !== undefined ? isPublic : existingByPubkey.isPublic,
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
          isPublic: isPublic !== undefined ? isPublic : existingByAddress.isPublic,
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
 * Save metrics for a node
 */
async function saveMetrics(
  nodeId: number,
  stats: PNodeStats,
  storageCommitted?: bigint | null,
  storageUsagePercent?: number | null
) {
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
      // v0.7.0+ fields from get-pods-with-stats
      storageCommitted: storageCommitted !== undefined ? storageCommitted : null,
      storageUsagePercent: storageUsagePercent !== undefined ? storageUsagePercent : null,
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
 *
 * Uses pubkey as primary identifier (per Brad's recommendation):
 * - If pubkey exists, check if node already known by pubkey
 * - If known by pubkey but address differs, log IP change
 * - Fall back to address matching for legacy nodes without pubkey
 */
async function discoverNodes(results: CollectionResult[]) {
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
          knownPubkeys.set(pod.pubkey, { id: existing.id, address: rpcAddress });
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
    logger.info("Detected IP address changes during discovery", { count: ipChanges.length });

    for (const change of ipChanges) {
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

/**
 * Update peer relationships
 */
async function updatePeers(nodeId: number, pods: PodsWithStatsResult) {
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
    ).catch((err) => logger.error('Failed to publish network update', err));
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
  logger.info('Starting collection cycle');

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
    logger.info('Collecting from nodes', { count: addresses.length });

    // Collect from all nodes in parallel
    const results = await Promise.all(addresses.map(collectFromNode));

    let successCount = 0;
    let failedCount = 0;

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
        rpcPort
      );

      if (result.success && result.stats) {
        await saveMetrics(node.id, result.stats, storageCommitted, storageUsagePercent);
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
        logger.warn('Collection failed for node', { address: result.address, error: result.error });
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

    // Count v0.7.0+ nodes with rich stats
    const nodesWithStorageStats = results.filter((r) =>
      r.success && r.pods?.pods.some((p) => p.storage_committed !== null)
    ).length;

    const v070Nodes = results.filter((r) =>
      r.success && r.version?.version.startsWith('0.7')
    ).length;

    logger.info('Collection cycle completed', {
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
    logger.error('Collection cycle failed', error instanceof Error ? error : new Error(String(error)));

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
  logger.info('Starting collector worker', { intervalMs: COLLECTION_INTERVAL });

  let currentCollection: Promise<void> | null = null;
  let isShuttingDown = false;

  // Run immediately
  currentCollection = runCollection()
    .then(() => {})
    .catch((err) => logger.error('Collection failed', err))
    .finally(() => { currentCollection = null; });

  // Then run on interval
  const interval = setInterval(() => {
    // Skip if already running or shutting down
    if (currentCollection || isShuttingDown) {
      logger.debug('Skipping collection (already running or shutting down)');
      return;
    }

    currentCollection = runCollection()
      .then(() => {})
      .catch((err) => logger.error('Collection failed', err))
      .finally(() => { currentCollection = null; });
  }, COLLECTION_INTERVAL);

  // Return cleanup function with verification
  return async () => {
    logger.info('Stopping collector worker');
    isShuttingDown = true;

    // Clear interval
    clearInterval(interval);
    logger.debug('Interval cleared');

    // Wait for any in-flight collection to complete
    if (currentCollection) {
      logger.info('Waiting for in-flight collection to complete');
      await currentCollection;
    }

    logger.info('Collector cleanup complete');
  };
}
