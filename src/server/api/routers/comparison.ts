/**
 * Comparison Router
 *
 * API endpoints for node comparison and analysis:
 * - Version tracking
 * - Underperforming node detection
 * - Side-by-side comparison
 * - Peer health analysis
 * - Resource recommendations
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

// Severity levels for issues
type Severity = "info" | "warning" | "critical";

// ============================================
// #60: Version Tracking
// ============================================

export const comparisonRouter = createTRPCRouter({
  /**
   * Get version status across all nodes
   */
  versionStatus: publicProcedure.query(async ({ ctx }) => {
    // Get all nodes with versions
    const nodes = await ctx.db.node.findMany({
      where: { version: { not: null } },
      select: {
        id: true,
        address: true,
        version: true,
        isActive: true,
      },
    });

    if (nodes.length === 0) {
      return {
        latestVersion: null,
        versionDistribution: {},
        nodesOnLatest: 0,
        nodesNeedingUpdate: [],
        totalNodes: 0,
      };
    }

    // Find version distribution
    const versionCounts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.version) {
        versionCounts[node.version] = (versionCounts[node.version] || 0) + 1;
      }
    }

    // Determine latest version (highest semver)
    const versions = Object.keys(versionCounts).sort((a, b) => {
      const aParts = a.split(".").map(Number);
      const bParts = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if ((aParts[i] || 0) !== (bParts[i] || 0)) {
          return (bParts[i] || 0) - (aParts[i] || 0);
        }
      }
      return 0;
    });
    const latestVersion = versions[0] || null;

    // Find nodes needing update
    const nodesNeedingUpdate = nodes
      .filter((n) => n.version && n.version !== latestVersion)
      .map((n) => ({
        id: n.id,
        address: n.address,
        currentVersion: n.version!,
        latestVersion: latestVersion!,
        isActive: n.isActive,
      }));

    // Calculate percentage distribution
    const total = nodes.length;
    const versionDistribution: Record<string, { count: number; percent: number }> = {};
    for (const [version, count] of Object.entries(versionCounts)) {
      versionDistribution[version] = {
        count,
        percent: Math.round((count / total) * 100),
      };
    }

    return {
      latestVersion,
      versionDistribution,
      nodesOnLatest: versionCounts[latestVersion || ""] || 0,
      nodesNeedingUpdate,
      totalNodes: total,
    };
  }),

  /**
   * Get version status for portfolio nodes
   */
  portfolioVersionStatus: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
        include: {
          nodes: {
            include: {
              node: {
                select: { id: true, address: true, version: true, isActive: true },
              },
            },
          },
        },
      });

      if (!portfolio || portfolio.nodes.length === 0) {
        return null;
      }

      // Get network latest version
      const networkVersions = await ctx.db.node.groupBy({
        by: ["version"],
        _count: { version: true },
        where: { version: { not: null } },
        orderBy: { _count: { version: "desc" } },
      });

      const versions = networkVersions
        .map((v) => v.version!)
        .filter(Boolean)
        .sort((a, b) => {
          const aParts = a.split(".").map(Number);
          const bParts = b.split(".").map(Number);
          for (let i = 0; i < 3; i++) {
            if ((aParts[i] || 0) !== (bParts[i] || 0)) {
              return (bParts[i] || 0) - (aParts[i] || 0);
            }
          }
          return 0;
        });
      const latestVersion = versions[0] || null;

      const portfolioNodes = portfolio.nodes.map((pn) => pn.node);
      const onLatest = portfolioNodes.filter((n) => n.version === latestVersion);
      const needingUpdate = portfolioNodes.filter(
        (n) => n.version && n.version !== latestVersion
      );

      return {
        latestVersion,
        totalNodes: portfolioNodes.length,
        nodesOnLatest: onLatest.length,
        nodesNeedingUpdate: needingUpdate.map((n) => ({
          id: n.id,
          address: n.address,
          currentVersion: n.version!,
          latestVersion: latestVersion!,
          isActive: n.isActive,
        })),
      };
    }),

  // ============================================
  // #59: Underperforming Node Detection
  // ============================================

  /**
   * Identify underperforming nodes in portfolio
   */
  underperformers: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
        include: {
          nodes: {
            include: {
              node: {
                include: {
                  metrics: {
                    orderBy: { time: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!portfolio || portfolio.nodes.length === 0) {
        return [];
      }

      // Calculate network averages
      const networkMetrics = await ctx.db.$queryRaw<
        Array<{
          avg_cpu: number;
          avg_ram_percent: number;
          avg_uptime: number;
          avg_storage: number;
        }>
      >`
        SELECT
          AVG(cpu_percent) as avg_cpu,
          AVG(CASE WHEN ram_total > 0 THEN ram_used::float / ram_total * 100 ELSE 0 END) as avg_ram_percent,
          AVG(uptime) as avg_uptime,
          AVG(file_size) as avg_storage
        FROM node_metrics nm
        INNER JOIN (
          SELECT node_id, MAX(time) as max_time
          FROM node_metrics
          GROUP BY node_id
        ) latest ON nm.node_id = latest.node_id AND nm.time = latest.max_time
      `;

      const networkAvg = networkMetrics[0] || {
        avg_cpu: 20,
        avg_ram_percent: 60,
        avg_uptime: 86400 * 7,
        avg_storage: 500000000000,
      };

      // Get latest version
      const versions = await ctx.db.node.groupBy({
        by: ["version"],
        _count: { version: true },
        where: { version: { not: null } },
      });
      const latestVersion = versions
        .map((v) => v.version!)
        .sort((a, b) => {
          const aParts = a.split(".").map(Number);
          const bParts = b.split(".").map(Number);
          for (let i = 0; i < 3; i++) {
            if ((aParts[i] || 0) !== (bParts[i] || 0)) {
              return (bParts[i] || 0) - (aParts[i] || 0);
            }
          }
          return 0;
        })[0];

      // Analyze each portfolio node
      const underperformers: Array<{
        nodeId: number;
        address: string;
        isActive: boolean;
        score: number;
        issues: Array<{
          metric: string;
          currentValue: number;
          networkAvg: number;
          threshold: number;
          severity: Severity;
          message: string;
        }>;
      }> = [];

      for (const pn of portfolio.nodes) {
        const node = pn.node;
        const metric = node.metrics[0];
        const issues: Array<{
          metric: string;
          currentValue: number;
          networkAvg: number;
          threshold: number;
          severity: Severity;
          message: string;
        }> = [];

        // Check if offline
        if (!node.isActive) {
          issues.push({
            metric: "status",
            currentValue: 0,
            networkAvg: 1,
            threshold: 1,
            severity: "critical",
            message: "Node is offline",
          });
        }

        if (metric) {
          // CPU check (> 2x network avg)
          if (metric.cpuPercent !== null && metric.cpuPercent > networkAvg.avg_cpu * 2) {
            issues.push({
              metric: "cpu",
              currentValue: metric.cpuPercent,
              networkAvg: networkAvg.avg_cpu,
              threshold: networkAvg.avg_cpu * 2,
              severity: metric.cpuPercent > networkAvg.avg_cpu * 3 ? "critical" : "warning",
              message: `CPU usage ${metric.cpuPercent.toFixed(1)}% is ${(metric.cpuPercent / networkAvg.avg_cpu).toFixed(1)}x network average`,
            });
          }

          // RAM check (> 1.5x network avg)
          if (metric.ramUsed && metric.ramTotal && metric.ramTotal > BigInt(0)) {
            const ramPercent = Number(metric.ramUsed) / Number(metric.ramTotal) * 100;
            if (ramPercent > networkAvg.avg_ram_percent * 1.5) {
              issues.push({
                metric: "ram",
                currentValue: ramPercent,
                networkAvg: networkAvg.avg_ram_percent,
                threshold: networkAvg.avg_ram_percent * 1.5,
                severity: ramPercent > 90 ? "critical" : "warning",
                message: `RAM usage ${ramPercent.toFixed(1)}% exceeds threshold`,
              });
            }
          }

          // Uptime check (< 0.5x network avg)
          if (metric.uptime !== null && metric.uptime < networkAvg.avg_uptime * 0.5) {
            issues.push({
              metric: "uptime",
              currentValue: metric.uptime,
              networkAvg: networkAvg.avg_uptime,
              threshold: networkAvg.avg_uptime * 0.5,
              severity: metric.uptime < networkAvg.avg_uptime * 0.25 ? "critical" : "warning",
              message: "Uptime significantly below network average",
            });
          }
        }

        // Version check
        if (node.version && latestVersion && node.version !== latestVersion) {
          issues.push({
            metric: "version",
            currentValue: 0,
            networkAvg: 1,
            threshold: 1,
            severity: "info",
            message: `Running ${node.version}, latest is ${latestVersion}`,
          });
        }

        if (issues.length > 0) {
          // Calculate score (100 = perfect, lower = worse)
          const criticalCount = issues.filter((i) => i.severity === "critical").length;
          const warningCount = issues.filter((i) => i.severity === "warning").length;
          const infoCount = issues.filter((i) => i.severity === "info").length;
          const score = Math.max(0, 100 - criticalCount * 30 - warningCount * 15 - infoCount * 5);

          underperformers.push({
            nodeId: node.id,
            address: node.address,
            isActive: node.isActive,
            score,
            issues,
          });
        }
      }

      // Sort by score (worst first)
      return underperformers.sort((a, b) => a.score - b.score);
    }),

  // ============================================
  // #58: Side-by-Side Comparison
  // ============================================

  /**
   * Get comparison data for multiple nodes
   */
  compareNodes: publicProcedure
    .input(
      z.object({
        nodeIds: z.array(z.number()).min(2).max(4),
      })
    )
    .query(async ({ ctx, input }) => {
      const nodes = await ctx.db.node.findMany({
        where: { id: { in: input.nodeIds } },
        include: {
          metrics: {
            orderBy: { time: "desc" },
            take: 1,
          },
        },
      });

      if (nodes.length < 2) {
        return null;
      }

      // Get network stats for comparison
      const networkStats = await ctx.db.$queryRaw<
        Array<{
          avg_cpu: number;
          avg_ram_percent: number;
          avg_uptime: number;
          avg_storage: number;
          latest_version: string;
        }>
      >`
        SELECT
          AVG(cpu_percent) as avg_cpu,
          AVG(CASE WHEN ram_total > 0 THEN ram_used::float / ram_total * 100 ELSE 0 END) as avg_ram_percent,
          AVG(uptime) as avg_uptime,
          AVG(file_size) as avg_storage,
          (SELECT version FROM nodes WHERE version IS NOT NULL GROUP BY version ORDER BY COUNT(*) DESC LIMIT 1) as latest_version
        FROM node_metrics nm
        INNER JOIN (
          SELECT node_id, MAX(time) as max_time
          FROM node_metrics
          GROUP BY node_id
        ) latest ON nm.node_id = latest.node_id AND nm.time = latest.max_time
      `;

      const network = networkStats[0];

      // Build comparison data
      const comparison = nodes.map((node) => {
        const m = node.metrics[0];
        const ramPercent = m?.ramUsed && m?.ramTotal && m.ramTotal > BigInt(0)
          ? Number(m.ramUsed) / Number(m.ramTotal) * 100
          : null;

        return {
          id: node.id,
          address: node.address,
          isActive: node.isActive,
          version: node.version,
          lastSeen: node.lastSeen,
          metrics: {
            cpu: m?.cpuPercent ?? null,
            ram: ramPercent,
            storage: m?.fileSize ? Number(m.fileSize) : null,
            uptime: m?.uptime ?? null,
            packetsReceived: m?.packetsReceived ?? null,
            packetsSent: m?.packetsSent ?? null,
          },
        };
      });

      // Find best values for each metric
      const bestValues = {
        cpu: Math.min(...comparison.map((n) => n.metrics.cpu ?? Infinity)),
        ram: Math.min(...comparison.map((n) => n.metrics.ram ?? Infinity)),
        storage: Math.max(...comparison.map((n) => n.metrics.storage ?? 0)),
        uptime: Math.max(...comparison.map((n) => n.metrics.uptime ?? 0)),
      };

      return {
        nodes: comparison,
        bestValues,
        networkAvg: {
          cpu: network?.avg_cpu ?? 0,
          ram: network?.avg_ram_percent ?? 0,
          storage: network?.avg_storage ?? 0,
          uptime: network?.avg_uptime ?? 0,
          latestVersion: network?.latest_version ?? null,
        },
      };
    }),

  /**
   * Search nodes for comparison picker
   */
  searchNodes: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        excludeIds: z.array(z.number()).default([]),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const nodes = await ctx.db.node.findMany({
        where: {
          id: { notIn: input.excludeIds },
          OR: [
            { address: { contains: input.query } },
            { pubkey: { contains: input.query } },
          ],
        },
        select: {
          id: true,
          address: true,
          version: true,
          isActive: true,
        },
        take: input.limit,
      });

      return nodes;
    }),

  // ============================================
  // #61: Peer Health Analysis
  // ============================================

  /**
   * Analyze peer health for a node
   */
  peerHealth: publicProcedure
    .input(z.object({ nodeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const node = await ctx.db.node.findUnique({
        where: { id: input.nodeId },
        include: {
          peers: {
            include: {
              peerNode: {
                select: { id: true, address: true, isActive: true },
              },
            },
            orderBy: { lastSeenAt: "desc" },
          },
        },
      });

      if (!node) {
        return null;
      }

      const now = new Date();
      const staleThreshold = 10 * 60 * 1000; // 10 minutes

      // Analyze peers
      const peers = node.peers.map((p) => {
        const lastSeenMs = now.getTime() - p.lastSeenAt.getTime();
        const isStale = lastSeenMs > staleThreshold;
        return {
          address: p.peerAddress,
          version: p.peerVersion,
          lastSeenAt: p.lastSeenAt,
          lastSeenAgo: lastSeenMs,
          isStale,
          isActive: p.peerNode?.isActive ?? !isStale,
        };
      });

      // Version distribution
      const versionCounts: Record<string, number> = {};
      for (const peer of peers) {
        if (peer.version) {
          versionCounts[peer.version] = (versionCounts[peer.version] || 0) + 1;
        }
      }

      // Get latest version
      const versions = Object.keys(versionCounts).sort((a, b) => {
        const aParts = a.split(".").map(Number);
        const bParts = b.split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if ((aParts[i] || 0) !== (bParts[i] || 0)) {
            return (bParts[i] || 0) - (aParts[i] || 0);
          }
        }
        return 0;
      });
      const latestVersion = versions[0] || null;
      const onLatestPercent = latestVersion
        ? Math.round(((versionCounts[latestVersion] || 0) / peers.length) * 100)
        : 0;

      // Calculate health metrics
      const activePeers = peers.filter((p) => !p.isStale).length;
      const stalePeers = peers.filter((p) => p.isStale).length;
      const stalePercent = peers.length > 0 ? Math.round((stalePeers / peers.length) * 100) : 0;

      // Determine health status
      let healthStatus: "good" | "warning" | "critical" = "good";
      if (activePeers < 10 || stalePercent > 25) {
        healthStatus = "critical";
      } else if (activePeers < 20 || stalePercent > 10) {
        healthStatus = "warning";
      }

      // Get network average peer count
      const networkPeerAvg = await ctx.db.nodePeer.groupBy({
        by: ["nodeId"],
        _count: { id: true },
      });
      const avgPeerCount = networkPeerAvg.length > 0
        ? networkPeerAvg.reduce((sum, n) => sum + n._count.id, 0) / networkPeerAvg.length
        : 0;

      return {
        nodeId: node.id,
        nodeAddress: node.address,
        totalPeers: peers.length,
        activePeers,
        stalePeers,
        stalePercent,
        healthStatus,
        networkAvgPeers: Math.round(avgPeerCount),
        versionDistribution: Object.entries(versionCounts).map(([version, count]) => ({
          version,
          count,
          percent: Math.round((count / peers.length) * 100),
          isLatest: version === latestVersion,
        })),
        onLatestPercent,
        peers: peers.slice(0, 50), // Limit for performance
        avgLastSeen: peers.length > 0
          ? peers.reduce((sum, p) => sum + p.lastSeenAgo, 0) / peers.length
          : 0,
      };
    }),

  // ============================================
  // #57: Resource Recommendations
  // ============================================

  /**
   * Get recommendations for portfolio nodes
   */
  recommendations: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
        include: {
          nodes: {
            include: {
              node: {
                include: {
                  metrics: {
                    orderBy: { time: "desc" },
                    take: 1,
                  },
                  peers: true,
                },
              },
            },
          },
        },
      });

      if (!portfolio || portfolio.nodes.length === 0) {
        return [];
      }

      // Get network stats
      const networkStats = await ctx.db.$queryRaw<
        Array<{
          avg_cpu: number;
          avg_ram_percent: number;
          avg_peers: number;
        }>
      >`
        SELECT
          AVG(nm.cpu_percent) as avg_cpu,
          AVG(CASE WHEN nm.ram_total > 0 THEN nm.ram_used::float / nm.ram_total * 100 ELSE 0 END) as avg_ram_percent,
          (SELECT AVG(peer_count) FROM (SELECT node_id, COUNT(*) as peer_count FROM node_peers GROUP BY node_id) pc) as avg_peers
        FROM node_metrics nm
        INNER JOIN (
          SELECT node_id, MAX(time) as max_time FROM node_metrics GROUP BY node_id
        ) latest ON nm.node_id = latest.node_id AND nm.time = latest.max_time
      `;
      const network = networkStats[0] || { avg_cpu: 20, avg_ram_percent: 60, avg_peers: 25 };

      // Get latest version
      const versions = await ctx.db.node.groupBy({
        by: ["version"],
        _count: { version: true },
        where: { version: { not: null } },
      });
      const latestVersion = versions
        .map((v) => v.version!)
        .sort((a, b) => {
          const aParts = a.split(".").map(Number);
          const bParts = b.split(".").map(Number);
          for (let i = 0; i < 3; i++) {
            if ((aParts[i] || 0) !== (bParts[i] || 0)) {
              return (bParts[i] || 0) - (aParts[i] || 0);
            }
          }
          return 0;
        })[0];

      const recommendations: Array<{
        id: string;
        type: "optimization" | "update" | "network" | "status";
        severity: Severity;
        title: string;
        description: string;
        nodeIds: number[];
        nodeAddresses: string[];
        actions: Array<{ label: string; href?: string }>;
      }> = [];

      // Track nodes with issues
      const highRamNodes: Array<{ id: number; address: string; value: number }> = [];
      const highCpuNodes: Array<{ id: number; address: string; value: number }> = [];
      const outdatedNodes: Array<{ id: number; address: string; version: string }> = [];
      const lowPeerNodes: Array<{ id: number; address: string; count: number }> = [];
      const offlineNodes: Array<{ id: number; address: string }> = [];

      for (const pn of portfolio.nodes) {
        const node = pn.node;
        const metric = node.metrics[0];

        // Check offline
        if (!node.isActive) {
          offlineNodes.push({ id: node.id, address: node.address });
        }

        if (metric) {
          // Check high RAM
          if (metric.ramUsed && metric.ramTotal && metric.ramTotal > BigInt(0)) {
            const ramPercent = Number(metric.ramUsed) / Number(metric.ramTotal) * 100;
            if (ramPercent > 80) {
              highRamNodes.push({ id: node.id, address: node.address, value: ramPercent });
            }
          }

          // Check high CPU
          if (metric.cpuPercent && metric.cpuPercent > 70) {
            highCpuNodes.push({ id: node.id, address: node.address, value: metric.cpuPercent });
          }
        }

        // Check version
        if (node.version && latestVersion && node.version !== latestVersion) {
          outdatedNodes.push({ id: node.id, address: node.address, version: node.version });
        }

        // Check peer count
        if (node.peers.length < network.avg_peers * 0.5) {
          lowPeerNodes.push({ id: node.id, address: node.address, count: node.peers.length });
        }
      }

      // Generate recommendations
      if (offlineNodes.length > 0) {
        recommendations.push({
          id: "offline-nodes",
          type: "status",
          severity: "critical",
          title: `${offlineNodes.length} node${offlineNodes.length > 1 ? "s are" : " is"} offline`,
          description: "These nodes are not responding. Check network connectivity and node status.",
          nodeIds: offlineNodes.map((n) => n.id),
          nodeAddresses: offlineNodes.map((n) => n.address.split(":")[0]),
          actions: [{ label: "View Nodes" }],
        });
      }

      if (highRamNodes.length > 0) {
        recommendations.push({
          id: "high-ram",
          type: "optimization",
          severity: highRamNodes.some((n) => n.value > 90) ? "critical" : "warning",
          title: `High RAM usage on ${highRamNodes.length} node${highRamNodes.length > 1 ? "s" : ""}`,
          description: "RAM usage above 80% may impact stability. Consider increasing RAM or optimizing storage settings.",
          nodeIds: highRamNodes.map((n) => n.id),
          nodeAddresses: highRamNodes.map((n) => n.address.split(":")[0]),
          actions: [{ label: "View Details" }],
        });
      }

      if (highCpuNodes.length > 0) {
        recommendations.push({
          id: "high-cpu",
          type: "optimization",
          severity: highCpuNodes.some((n) => n.value > 90) ? "critical" : "warning",
          title: `High CPU usage on ${highCpuNodes.length} node${highCpuNodes.length > 1 ? "s" : ""}`,
          description: "CPU usage above 70% may indicate performance issues or resource contention.",
          nodeIds: highCpuNodes.map((n) => n.id),
          nodeAddresses: highCpuNodes.map((n) => n.address.split(":")[0]),
          actions: [{ label: "View Details" }],
        });
      }

      if (outdatedNodes.length > 0) {
        recommendations.push({
          id: "version-update",
          type: "update",
          severity: "info",
          title: `Version ${latestVersion} available for ${outdatedNodes.length} node${outdatedNodes.length > 1 ? "s" : ""}`,
          description: `Update from ${outdatedNodes[0].version} to ${latestVersion} for latest features and bug fixes.`,
          nodeIds: outdatedNodes.map((n) => n.id),
          nodeAddresses: outdatedNodes.map((n) => n.address.split(":")[0]),
          actions: [
            { label: "Update Guide", href: "https://docs.xandeum.network" },
          ],
        });
      }

      if (lowPeerNodes.length > 0) {
        recommendations.push({
          id: "low-peers",
          type: "network",
          severity: "warning",
          title: `${lowPeerNodes.length} node${lowPeerNodes.length > 1 ? "s have" : " has"} fewer peers than average`,
          description: `Network average is ${Math.round(network.avg_peers)} peers. Low peer count may indicate connectivity issues.`,
          nodeIds: lowPeerNodes.map((n) => n.id),
          nodeAddresses: lowPeerNodes.map((n) => n.address.split(":")[0]),
          actions: [{ label: "Check Peer Health" }],
        });
      }

      // Sort by severity
      const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
      return recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    }),
});
