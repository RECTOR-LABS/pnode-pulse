/**
 * Peer Connectivity Analytics Router
 *
 * Endpoints for peer relationship analysis and optimization
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import {
  analyzePeerConnectivity,
  analyzeNetworkConnectivity,
  identifyOptimizationOpportunities,
  type PeerInfo,
} from "@/lib/analytics/peer-optimizer";

export const peersRouter = createTRPCRouter({
  /**
   * Analyze peer connectivity for a single node
   */
  nodePeerAnalysis: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input: nodeId }) => {
      const node = await ctx.db.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return null;
      }

      // Get all peers for this node with optional linked node data
      const peers = await ctx.db.nodePeer.findMany({
        where: { nodeId },
        include: {
          peerNode: {
            select: {
              isActive: true,
              lastSeen: true,
            },
          },
        },
      });

      const peerInfos: PeerInfo[] = peers.map((p) => ({
        peerId: p.peerNodeId ?? p.id,
        address: p.peerAddress,
        version: p.peerVersion ?? undefined,
        isActive: p.peerNode?.isActive ?? true, // Assume active if not linked
        lastSeenAt: p.peerNode?.lastSeen ?? p.lastSeenAt,
      }));

      const analysis = analyzePeerConnectivity(nodeId, node.address, peerInfos);

      return {
        ...analysis,
        nodeName: node.address,
      };
    }),

  /**
   * Get network-wide connectivity summary
   */
  networkConnectivity: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(100),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 100;

      // Get active nodes
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        take: limit,
        select: { id: true, address: true },
      });

      const nodeIds = nodes.map((n) => n.id);

      // Get all peers for these nodes with optional linked node data
      const allPeers = await ctx.db.nodePeer.findMany({
        where: { nodeId: { in: nodeIds } },
        include: {
          peerNode: {
            select: {
              isActive: true,
              lastSeen: true,
            },
          },
        },
      });

      // Group peers by nodeId
      const peersByNode = new Map<number, PeerInfo[]>();
      nodeIds.forEach((id) => peersByNode.set(id, []));

      allPeers.forEach((p) => {
        const peers = peersByNode.get(p.nodeId) ?? [];
        peers.push({
          peerId: p.peerNodeId ?? p.id,
          address: p.peerAddress,
          version: p.peerVersion ?? undefined,
          isActive: p.peerNode?.isActive ?? true,
          lastSeenAt: p.peerNode?.lastSeen ?? p.lastSeenAt,
        });
        peersByNode.set(p.nodeId, peers);
      });

      // Analyze each node
      const nodeAnalyses = nodes.map((node) => {
        const peers = peersByNode.get(node.id) ?? [];
        return analyzePeerConnectivity(node.id, node.address, peers);
      });

      // Get network summary
      const networkSummary = analyzeNetworkConnectivity(nodeAnalyses);

      return {
        ...networkSummary,
        analyzedNodes: nodes.length,
      };
    }),

  /**
   * Identify peer optimization opportunities across the network
   */
  peerOptimizations: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        priorityFilter: z.enum(["all", "critical", "high", "medium"]).default("all"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const priorityFilter = input?.priorityFilter ?? "all";

      // Get active nodes
      const nodes = await ctx.db.node.findMany({
        where: { isActive: true },
        select: { id: true, address: true },
      });

      const nodeIds = nodes.map((n) => n.id);

      // Get peer counts efficiently
      const peerCounts = await ctx.db.nodePeer.groupBy({
        by: ["nodeId"],
        where: { nodeId: { in: nodeIds } },
        _count: { id: true },
      });

      // Get active peer counts (peers that are also active nodes)
      const activePeerCounts = await ctx.db.$queryRaw<Array<{
        node_id: number;
        active_peers: bigint;
      }>>`
        SELECT
          np.node_id,
          COUNT(*) FILTER (WHERE n.is_active = true) as active_peers
        FROM node_peers np
        JOIN nodes n ON n.id = np.peer_node_id
        WHERE np.node_id = ANY(${nodeIds})
          AND np.peer_node_id IS NOT NULL
        GROUP BY np.node_id
      `;

      const totalPeerMap = new Map(
        peerCounts.map((p) => [p.nodeId, p._count.id])
      );
      const activePeerMap = new Map(
        activePeerCounts.map((p) => [p.node_id, Number(p.active_peers)])
      );

      // Create simplified analyses for optimization detection
      const nodeAnalyses = nodes.map((node) => ({
        nodeId: node.id,
        address: node.address,
        totalPeers: totalPeerMap.get(node.id) ?? 0,
        activePeers: activePeerMap.get(node.id) ?? 0,
        inactivePeers: (totalPeerMap.get(node.id) ?? 0) - (activePeerMap.get(node.id) ?? 0),
        versionDiversity: 0,
        peerVersions: [],
        healthScore: 50 + Math.min((activePeerMap.get(node.id) ?? 0) * 3, 40),
        recommendations: [],
      }));

      // Identify optimizations
      let optimizations = identifyOptimizationOpportunities(nodeAnalyses);

      // Filter by priority if specified
      if (priorityFilter !== "all") {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const maxPriority = priorityOrder[priorityFilter];
        optimizations = optimizations.filter(
          (o) => priorityOrder[o.priority] <= maxPriority
        );
      }

      // Limit results
      optimizations = optimizations.slice(0, limit);

      // Summary stats
      const summary = {
        totalNodesAnalyzed: nodes.length,
        nodesNeedingOptimization: optimizations.length,
        byPriority: {
          critical: optimizations.filter((o) => o.priority === "critical").length,
          high: optimizations.filter((o) => o.priority === "high").length,
          medium: optimizations.filter((o) => o.priority === "medium").length,
          low: optimizations.filter((o) => o.priority === "low").length,
        },
      };

      return {
        optimizations,
        summary,
      };
    }),
});
