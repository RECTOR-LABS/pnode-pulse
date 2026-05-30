/**
 * Prometheus Metrics Endpoint
 *
 * GET /api/metrics - Returns Prometheus-formatted metrics for network monitoring
 *
 * Metrics exposed:
 * - Network aggregate metrics (total storage, avg CPU/RAM, etc.)
 * - Per-node metrics (CPU, RAM, storage, uptime, packets)
 * - Version distribution
 *
 * Usage in prometheus.yml:
 *   - job_name: 'pnode-pulse'
 *     static_configs:
 *       - targets: ['pulse.rectorspace.com']
 *     metrics_path: /api/metrics
 *     scheme: https
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all nodes with peer counts (latest metric is fetched separately below)
    const nodes = await db.node.findMany({
      include: {
        _count: {
          select: { peers: true },
        },
      },
    });

    // Latest metric per node via a single LATERAL query (one indexed lookup per node).
    // Replaces Prisma's `include: { metrics: { take: 1 } }`, which generates a
    // ROW_NUMBER() window over the entire node_metrics hypertable (~90s, pool-exhausting).
    const latestMetricRows = await db.$queryRaw<
      Array<{
        node_id: number;
        cpu_percent: number | null;
        ram_used: bigint | null;
        ram_total: bigint | null;
        file_size: bigint | null;
        uptime: number | null;
        packets_received: number | null;
        packets_sent: number | null;
      }>
    >`
      SELECT m.node_id, m.cpu_percent, m.ram_used, m.ram_total, m.file_size, m.uptime, m.packets_received, m.packets_sent
      FROM nodes n
      JOIN LATERAL (
        SELECT nm.node_id, nm.cpu_percent, nm.ram_used, nm.ram_total, nm.file_size, nm.uptime, nm.packets_received, nm.packets_sent
        FROM node_metrics nm
        WHERE nm.node_id = n.id
        ORDER BY nm.time DESC
        LIMIT 1
      ) m ON true
    `;

    // Map by node id, shaped to match the previous `node.metrics[0]` (camelCase) fields.
    const latestByNode = new Map(
      latestMetricRows.map((r) => [
        r.node_id,
        {
          cpuPercent: r.cpu_percent,
          ramUsed: r.ram_used,
          ramTotal: r.ram_total,
          fileSize: r.file_size,
          uptime: r.uptime,
          packetsReceived: r.packets_received,
          packetsSent: r.packets_sent,
        },
      ]),
    );

    // Get network stats
    const activeNodes = nodes.filter((n) => n.isActive).length;
    const totalNodes = nodes.length;

    // Get aggregate network metrics
    const aggregateMetrics = await db.$queryRaw<
      Array<{
        total_storage: bigint;
        avg_cpu: number;
        avg_ram: number;
        avg_uptime: number;
        total_packets_received: bigint;
        total_packets_sent: bigint;
      }>
    >`
      WITH latest_metrics AS (
        SELECT
          m.file_size,
          m.cpu_percent,
          CASE WHEN m.ram_total > 0
            THEN (m.ram_used::float / m.ram_total::float) * 100
            ELSE 0
          END as ram_percent,
          m.uptime,
          m.packets_received,
          m.packets_sent
        FROM nodes n
        JOIN LATERAL (
          SELECT nm.file_size, nm.cpu_percent, nm.ram_used, nm.ram_total, nm.uptime, nm.packets_received, nm.packets_sent
          FROM node_metrics nm
          WHERE nm.node_id = n.id
          ORDER BY nm.time DESC
          LIMIT 1
        ) m ON true
        WHERE n.is_active = true
      )
      SELECT
        COALESCE(SUM(file_size), 0) as total_storage,
        COALESCE(AVG(cpu_percent), 0) as avg_cpu,
        COALESCE(AVG(ram_percent), 0) as avg_ram,
        COALESCE(AVG(uptime), 0) as avg_uptime,
        COALESCE(SUM(packets_received), 0) as total_packets_received,
        COALESCE(SUM(packets_sent), 0) as total_packets_sent
      FROM latest_metrics
    `;

    const agg = aggregateMetrics[0] || {
      total_storage: BigInt(0),
      avg_cpu: 0,
      avg_ram: 0,
      avg_uptime: 0,
      total_packets_received: BigInt(0),
      total_packets_sent: BigInt(0),
    };

    // Get version distribution
    const versionCounts = nodes.reduce(
      (acc, node) => {
        const version = node.version || "unknown";
        acc[version] = (acc[version] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Build Prometheus metrics
    const lines: string[] = [];
    const timestamp = Date.now();

    // Scrape info
    lines.push(
      "# HELP pnode_scrape_timestamp_seconds Unix timestamp of the last scrape",
    );
    lines.push("# TYPE pnode_scrape_timestamp_seconds gauge");
    lines.push(
      `pnode_scrape_timestamp_seconds ${Math.floor(timestamp / 1000)}`,
    );
    lines.push("");

    // Network-level metrics
    lines.push("# HELP pnode_active_nodes Total number of active pNodes");
    lines.push("# TYPE pnode_active_nodes gauge");
    lines.push(`pnode_active_nodes ${activeNodes}`);
    lines.push("");

    lines.push("# HELP pnode_total_nodes Total number of tracked pNodes");
    lines.push("# TYPE pnode_total_nodes gauge");
    lines.push(`pnode_total_nodes ${totalNodes}`);
    lines.push("");

    lines.push("# HELP pnode_inactive_nodes Total number of inactive pNodes");
    lines.push("# TYPE pnode_inactive_nodes gauge");
    lines.push(`pnode_inactive_nodes ${totalNodes - activeNodes}`);
    lines.push("");

    // Network aggregate metrics
    lines.push(
      "# HELP pnode_network_storage_bytes Total storage across all active nodes",
    );
    lines.push("# TYPE pnode_network_storage_bytes gauge");
    lines.push(`pnode_network_storage_bytes ${agg.total_storage}`);
    lines.push("");

    lines.push(
      "# HELP pnode_network_cpu_percent Average CPU usage across all active nodes",
    );
    lines.push("# TYPE pnode_network_cpu_percent gauge");
    lines.push(`pnode_network_cpu_percent ${agg.avg_cpu.toFixed(2)}`);
    lines.push("");

    lines.push(
      "# HELP pnode_network_ram_percent Average RAM usage across all active nodes",
    );
    lines.push("# TYPE pnode_network_ram_percent gauge");
    lines.push(`pnode_network_ram_percent ${agg.avg_ram.toFixed(2)}`);
    lines.push("");

    lines.push(
      "# HELP pnode_network_uptime_seconds Average uptime across all active nodes",
    );
    lines.push("# TYPE pnode_network_uptime_seconds gauge");
    lines.push(`pnode_network_uptime_seconds ${Math.round(agg.avg_uptime)}`);
    lines.push("");

    lines.push(
      "# HELP pnode_network_packets_received_total Total packets received across all active nodes",
    );
    lines.push("# TYPE pnode_network_packets_received_total counter");
    lines.push(
      `pnode_network_packets_received_total ${agg.total_packets_received}`,
    );
    lines.push("");

    lines.push(
      "# HELP pnode_network_packets_sent_total Total packets sent across all active nodes",
    );
    lines.push("# TYPE pnode_network_packets_sent_total counter");
    lines.push(`pnode_network_packets_sent_total ${agg.total_packets_sent}`);
    lines.push("");

    // Version distribution
    lines.push("# HELP pnode_nodes_by_version Number of nodes per version");
    lines.push("# TYPE pnode_nodes_by_version gauge");
    for (const [version, count] of Object.entries(versionCounts)) {
      lines.push(`pnode_nodes_by_version{version="${version}"} ${count}`);
    }
    lines.push("");

    // Node-level metrics
    lines.push("# HELP pnode_up Whether the node is active (1) or not (0)");
    lines.push("# TYPE pnode_up gauge");
    for (const node of nodes) {
      const labels = `node="${node.address.split(":")[0]}"`;
      lines.push(`pnode_up{${labels}} ${node.isActive ? 1 : 0}`);
    }
    lines.push("");

    lines.push("# HELP pnode_cpu_percent CPU usage percentage");
    lines.push("# TYPE pnode_cpu_percent gauge");
    for (const node of nodes) {
      const m = latestByNode.get(node.id);
      if (m?.cpuPercent !== null && m?.cpuPercent !== undefined) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_cpu_percent{${labels}} ${m.cpuPercent}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_ram_used_bytes RAM used in bytes");
    lines.push("# TYPE pnode_ram_used_bytes gauge");
    for (const node of nodes) {
      const m = latestByNode.get(node.id);
      if (m?.ramUsed) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_ram_used_bytes{${labels}} ${m.ramUsed}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_ram_total_bytes Total RAM in bytes");
    lines.push("# TYPE pnode_ram_total_bytes gauge");
    for (const node of nodes) {
      const m = latestByNode.get(node.id);
      if (m?.ramTotal) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_ram_total_bytes{${labels}} ${m.ramTotal}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_ram_percent RAM usage percentage");
    lines.push("# TYPE pnode_ram_percent gauge");
    for (const node of nodes) {
      const m = latestByNode.get(node.id);
      if (m?.ramUsed && m?.ramTotal && m.ramTotal > BigInt(0)) {
        const labels = `node="${node.address.split(":")[0]}"`;
        const percent = (Number(m.ramUsed) / Number(m.ramTotal)) * 100;
        lines.push(`pnode_ram_percent{${labels}} ${percent.toFixed(2)}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_storage_bytes Storage size in bytes");
    lines.push("# TYPE pnode_storage_bytes gauge");
    for (const node of nodes) {
      const m = latestByNode.get(node.id);
      if (m?.fileSize) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_storage_bytes{${labels}} ${m.fileSize}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_uptime_seconds Node uptime in seconds");
    lines.push("# TYPE pnode_uptime_seconds counter");
    for (const node of nodes) {
      const m = latestByNode.get(node.id);
      if (m?.uptime !== null && m?.uptime !== undefined) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_uptime_seconds{${labels}} ${m.uptime}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_packets_received_total Total packets received");
    lines.push("# TYPE pnode_packets_received_total counter");
    for (const node of nodes) {
      const m = latestByNode.get(node.id);
      if (m?.packetsReceived !== null && m?.packetsReceived !== undefined) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(
          `pnode_packets_received_total{${labels}} ${m.packetsReceived}`,
        );
      }
    }
    lines.push("");

    lines.push("# HELP pnode_packets_sent_total Total packets sent");
    lines.push("# TYPE pnode_packets_sent_total counter");
    for (const node of nodes) {
      const m = latestByNode.get(node.id);
      if (m?.packetsSent !== null && m?.packetsSent !== undefined) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_packets_sent_total{${labels}} ${m.packetsSent}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_peer_count Number of peers for each node");
    lines.push("# TYPE pnode_peer_count gauge");
    for (const node of nodes) {
      const labels = `node="${node.address.split(":")[0]}"`;
      lines.push(`pnode_peer_count{${labels}} ${node._count.peers}`);
    }
    lines.push("");

    lines.push("# HELP pnode_version_info Node version information");
    lines.push("# TYPE pnode_version_info gauge");
    for (const node of nodes) {
      if (node.version) {
        const labels = `node="${node.address.split(":")[0]}",version="${node.version}"`;
        lines.push(`pnode_version_info{${labels}} 1`);
      }
    }

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    });
  } catch (error) {
    logger.error(
      "Metrics error:",
      error instanceof Error ? error : new Error(String(error)),
    );
    return new NextResponse("# Error generating metrics", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
