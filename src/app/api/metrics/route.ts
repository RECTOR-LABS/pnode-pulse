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

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all nodes with latest metrics
    const nodes = await db.node.findMany({
      include: {
        metrics: {
          orderBy: { time: "desc" },
          take: 1,
        },
        _count: {
          select: { peers: true },
        },
      },
    });

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
      SELECT
        COALESCE(SUM(m."fileSize"), 0) as total_storage,
        COALESCE(AVG(m."cpuPercent"), 0) as avg_cpu,
        COALESCE(AVG(
          CASE WHEN m."ramTotal" > 0
            THEN (m."ramUsed"::float / m."ramTotal"::float) * 100
            ELSE 0
          END
        ), 0) as avg_ram,
        COALESCE(AVG(m.uptime), 0) as avg_uptime,
        COALESCE(SUM(m."packetsReceived"), 0) as total_packets_received,
        COALESCE(SUM(m."packetsSent"), 0) as total_packets_sent
      FROM (
        SELECT DISTINCT ON ("nodeId") *
        FROM "NodeMetric"
        ORDER BY "nodeId", time DESC
      ) m
      JOIN "Node" n ON m."nodeId" = n.id
      WHERE n."isActive" = true
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
    const versionCounts = nodes.reduce((acc, node) => {
      const version = node.version || "unknown";
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Build Prometheus metrics
    const lines: string[] = [];
    const timestamp = Date.now();

    // Scrape info
    lines.push("# HELP pnode_scrape_timestamp_seconds Unix timestamp of the last scrape");
    lines.push("# TYPE pnode_scrape_timestamp_seconds gauge");
    lines.push(`pnode_scrape_timestamp_seconds ${Math.floor(timestamp / 1000)}`);
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
    lines.push("# HELP pnode_network_storage_bytes Total storage across all active nodes");
    lines.push("# TYPE pnode_network_storage_bytes gauge");
    lines.push(`pnode_network_storage_bytes ${agg.total_storage}`);
    lines.push("");

    lines.push("# HELP pnode_network_cpu_percent Average CPU usage across all active nodes");
    lines.push("# TYPE pnode_network_cpu_percent gauge");
    lines.push(`pnode_network_cpu_percent ${(agg.avg_cpu).toFixed(2)}`);
    lines.push("");

    lines.push("# HELP pnode_network_ram_percent Average RAM usage across all active nodes");
    lines.push("# TYPE pnode_network_ram_percent gauge");
    lines.push(`pnode_network_ram_percent ${(agg.avg_ram).toFixed(2)}`);
    lines.push("");

    lines.push("# HELP pnode_network_uptime_seconds Average uptime across all active nodes");
    lines.push("# TYPE pnode_network_uptime_seconds gauge");
    lines.push(`pnode_network_uptime_seconds ${Math.round(agg.avg_uptime)}`);
    lines.push("");

    lines.push("# HELP pnode_network_packets_received_total Total packets received across all active nodes");
    lines.push("# TYPE pnode_network_packets_received_total counter");
    lines.push(`pnode_network_packets_received_total ${agg.total_packets_received}`);
    lines.push("");

    lines.push("# HELP pnode_network_packets_sent_total Total packets sent across all active nodes");
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
      const m = node.metrics[0];
      if (m?.cpuPercent !== null && m?.cpuPercent !== undefined) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_cpu_percent{${labels}} ${m.cpuPercent}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_ram_used_bytes RAM used in bytes");
    lines.push("# TYPE pnode_ram_used_bytes gauge");
    for (const node of nodes) {
      const m = node.metrics[0];
      if (m?.ramUsed) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_ram_used_bytes{${labels}} ${m.ramUsed}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_ram_total_bytes Total RAM in bytes");
    lines.push("# TYPE pnode_ram_total_bytes gauge");
    for (const node of nodes) {
      const m = node.metrics[0];
      if (m?.ramTotal) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_ram_total_bytes{${labels}} ${m.ramTotal}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_ram_percent RAM usage percentage");
    lines.push("# TYPE pnode_ram_percent gauge");
    for (const node of nodes) {
      const m = node.metrics[0];
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
      const m = node.metrics[0];
      if (m?.fileSize) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_storage_bytes{${labels}} ${m.fileSize}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_uptime_seconds Node uptime in seconds");
    lines.push("# TYPE pnode_uptime_seconds counter");
    for (const node of nodes) {
      const m = node.metrics[0];
      if (m?.uptime !== null && m?.uptime !== undefined) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_uptime_seconds{${labels}} ${m.uptime}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_packets_received_total Total packets received");
    lines.push("# TYPE pnode_packets_received_total counter");
    for (const node of nodes) {
      const m = node.metrics[0];
      if (m?.packetsReceived !== null && m?.packetsReceived !== undefined) {
        const labels = `node="${node.address.split(":")[0]}"`;
        lines.push(`pnode_packets_received_total{${labels}} ${m.packetsReceived}`);
      }
    }
    lines.push("");

    lines.push("# HELP pnode_packets_sent_total Total packets sent");
    lines.push("# TYPE pnode_packets_sent_total counter");
    for (const node of nodes) {
      const m = node.metrics[0];
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
    console.error("Metrics error:", error);
    return new NextResponse("# Error generating metrics", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
