/**
 * Peer Optimizer for Network Connectivity Analysis
 *
 * Analyzes node peer relationships and provides recommendations
 * for optimizing network connectivity.
 */

export interface PeerInfo {
  peerId: number;
  address: string;
  version?: string;
  isActive: boolean;
  lastSeenAt: Date;
}

export interface NodePeerAnalysis {
  nodeId: number;
  address: string;
  totalPeers: number;
  activePeers: number;
  inactivePeers: number;
  versionDiversity: number; // Number of unique versions among peers
  peerVersions: Array<{ version: string; count: number }>;
  healthScore: number; // 0-100
  recommendations: PeerRecommendation[];
}

export interface PeerRecommendation {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  action: string;
}

export interface NetworkConnectivitySummary {
  totalNodes: number;
  totalConnections: number;
  avgPeersPerNode: number;
  medianPeersPerNode: number;
  isolatedNodes: number; // Nodes with 0-2 peers
  wellConnectedNodes: number; // Nodes with 10+ peers
  highlyConnectedNodes: number; // Nodes with 20+ peers
  connectivityScore: number; // 0-100
  recommendations: PeerRecommendation[];
}

// Thresholds
const THRESHOLDS = {
  minHealthyPeers: 5,
  optimalPeers: 10,
  excellentPeers: 20,
  isolatedMaxPeers: 2,
  staleConnectionHours: 24,
} as const;

/**
 * Analyze peer connectivity for a single node
 */
export function analyzePeerConnectivity(
  nodeId: number,
  nodeAddress: string,
  peers: PeerInfo[]
): NodePeerAnalysis {
  const activePeers = peers.filter((p) => p.isActive);
  const inactivePeers = peers.filter((p) => !p.isActive);

  // Calculate version diversity
  const versionMap = new Map<string, number>();
  peers.forEach((p) => {
    if (p.version) {
      versionMap.set(p.version, (versionMap.get(p.version) || 0) + 1);
    }
  });

  const peerVersions = Array.from(versionMap.entries())
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => b.count - a.count);

  // Calculate health score
  let healthScore = 50; // Base score

  // Peer count scoring (0-40 points)
  if (activePeers.length >= THRESHOLDS.excellentPeers) {
    healthScore += 40;
  } else if (activePeers.length >= THRESHOLDS.optimalPeers) {
    healthScore += 30;
  } else if (activePeers.length >= THRESHOLDS.minHealthyPeers) {
    healthScore += 20;
  } else if (activePeers.length > 0) {
    healthScore += 10;
  } else {
    healthScore -= 30; // No peers is critical
  }

  // Active peer ratio (0-10 points)
  if (peers.length > 0) {
    const activeRatio = activePeers.length / peers.length;
    healthScore += Math.round(activeRatio * 10);
  }

  // Ensure score is in valid range
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Generate recommendations
  const recommendations: PeerRecommendation[] = [];

  if (activePeers.length === 0) {
    recommendations.push({
      id: "no-peers",
      priority: "critical",
      title: "No Active Peers",
      description: "This node has no active peer connections, making it isolated from the network.",
      action: "Check network configuration, firewall rules, and ensure port 9001 is accessible.",
    });
  } else if (activePeers.length < THRESHOLDS.minHealthyPeers) {
    recommendations.push({
      id: "low-peers",
      priority: "high",
      title: "Low Peer Count",
      description: `Only ${activePeers.length} active peer(s). Recommended minimum is ${THRESHOLDS.minHealthyPeers}.`,
      action: "Consider improving network visibility or checking connectivity settings.",
    });
  } else if (activePeers.length < THRESHOLDS.optimalPeers) {
    recommendations.push({
      id: "moderate-peers",
      priority: "low",
      title: "Moderate Peer Count",
      description: `${activePeers.length} active peers. Optimal is ${THRESHOLDS.optimalPeers}+.`,
      action: "Peer count is acceptable but could be improved for better network participation.",
    });
  }

  // Check for stale connections
  const now = new Date();
  const staleHoursThreshold = THRESHOLDS.staleConnectionHours * 60 * 60 * 1000;
  const stalePeers = inactivePeers.filter(
    (p) => now.getTime() - p.lastSeenAt.getTime() > staleHoursThreshold
  );

  if (stalePeers.length > inactivePeers.length * 0.5 && stalePeers.length > 5) {
    recommendations.push({
      id: "stale-connections",
      priority: "medium",
      title: "Many Stale Connections",
      description: `${stalePeers.length} peers haven't been seen in over ${THRESHOLDS.staleConnectionHours} hours.`,
      action: "Consider clearing stale peer entries to improve connection efficiency.",
    });
  }

  // Check version diversity
  if (peerVersions.length === 1 && peers.length >= 5) {
    recommendations.push({
      id: "low-version-diversity",
      priority: "low",
      title: "Low Version Diversity",
      description: "All peers are running the same version.",
      action: "Not necessarily a problem, but diverse connections can improve resilience.",
    });
  }

  return {
    nodeId,
    address: nodeAddress,
    totalPeers: peers.length,
    activePeers: activePeers.length,
    inactivePeers: inactivePeers.length,
    versionDiversity: versionMap.size,
    peerVersions,
    healthScore,
    recommendations,
  };
}

/**
 * Calculate median of an array
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Analyze network-wide connectivity
 */
export function analyzeNetworkConnectivity(
  nodeAnalyses: NodePeerAnalysis[]
): NetworkConnectivitySummary {
  if (nodeAnalyses.length === 0) {
    return {
      totalNodes: 0,
      totalConnections: 0,
      avgPeersPerNode: 0,
      medianPeersPerNode: 0,
      isolatedNodes: 0,
      wellConnectedNodes: 0,
      highlyConnectedNodes: 0,
      connectivityScore: 0,
      recommendations: [],
    };
  }

  const peerCounts = nodeAnalyses.map((n) => n.activePeers);
  const totalConnections = peerCounts.reduce((sum, c) => sum + c, 0);

  const isolatedNodes = nodeAnalyses.filter(
    (n) => n.activePeers <= THRESHOLDS.isolatedMaxPeers
  ).length;

  const wellConnectedNodes = nodeAnalyses.filter(
    (n) => n.activePeers >= THRESHOLDS.optimalPeers
  ).length;

  const highlyConnectedNodes = nodeAnalyses.filter(
    (n) => n.activePeers >= THRESHOLDS.excellentPeers
  ).length;

  // Calculate connectivity score
  let connectivityScore = 50;

  // Well-connected ratio (0-30 points)
  const wellConnectedRatio = wellConnectedNodes / nodeAnalyses.length;
  connectivityScore += Math.round(wellConnectedRatio * 30);

  // Isolated penalty (-20 to 0 points)
  const isolatedRatio = isolatedNodes / nodeAnalyses.length;
  connectivityScore -= Math.round(isolatedRatio * 20);

  // Average peers bonus (0-20 points)
  const avgPeers = totalConnections / nodeAnalyses.length;
  if (avgPeers >= THRESHOLDS.excellentPeers) {
    connectivityScore += 20;
  } else if (avgPeers >= THRESHOLDS.optimalPeers) {
    connectivityScore += 15;
  } else if (avgPeers >= THRESHOLDS.minHealthyPeers) {
    connectivityScore += 10;
  }

  connectivityScore = Math.max(0, Math.min(100, connectivityScore));

  // Generate network-wide recommendations
  const recommendations: PeerRecommendation[] = [];

  if (isolatedRatio > 0.2) {
    recommendations.push({
      id: "network-isolation",
      priority: "critical",
      title: "High Node Isolation Rate",
      description: `${(isolatedRatio * 100).toFixed(0)}% of nodes have ${THRESHOLDS.isolatedMaxPeers} or fewer peers.`,
      action: "Investigate network-wide connectivity issues. Check DNS, firewall configurations.",
    });
  } else if (isolatedRatio > 0.1) {
    recommendations.push({
      id: "moderate-isolation",
      priority: "high",
      title: "Moderate Node Isolation",
      description: `${isolatedNodes} nodes (${(isolatedRatio * 100).toFixed(0)}%) have limited connectivity.`,
      action: "Work with operators of isolated nodes to improve their network configuration.",
    });
  }

  if (wellConnectedRatio < 0.3) {
    recommendations.push({
      id: "low-connectivity",
      priority: "medium",
      title: "Low Overall Connectivity",
      description: `Only ${(wellConnectedRatio * 100).toFixed(0)}% of nodes have optimal peer counts.`,
      action: "Encourage operators to improve node visibility and network access.",
    });
  }

  if (avgPeers < THRESHOLDS.minHealthyPeers) {
    recommendations.push({
      id: "low-avg-peers",
      priority: "high",
      title: "Low Average Peer Count",
      description: `Network average is ${avgPeers.toFixed(1)} peers per node. Recommended: ${THRESHOLDS.optimalPeers}+.`,
      action: "Network may benefit from peer discovery improvements.",
    });
  }

  if (recommendations.length === 0 && connectivityScore >= 80) {
    recommendations.push({
      id: "healthy-network",
      priority: "low",
      title: "Healthy Network Connectivity",
      description: "Network peer connectivity is in good shape.",
      action: "Continue monitoring for changes.",
    });
  }

  return {
    totalNodes: nodeAnalyses.length,
    totalConnections,
    avgPeersPerNode: avgPeers,
    medianPeersPerNode: median(peerCounts),
    isolatedNodes,
    wellConnectedNodes,
    highlyConnectedNodes,
    connectivityScore,
    recommendations,
  };
}

/**
 * Find potential peer optimization opportunities
 */
export interface PeerOptimization {
  nodeId: number;
  address: string;
  issue: string;
  currentPeers: number;
  targetPeers: number;
  priority: "low" | "medium" | "high" | "critical";
}

export function identifyOptimizationOpportunities(
  analyses: NodePeerAnalysis[]
): PeerOptimization[] {
  const opportunities: PeerOptimization[] = [];

  for (const analysis of analyses) {
    if (analysis.activePeers === 0) {
      opportunities.push({
        nodeId: analysis.nodeId,
        address: analysis.address,
        issue: "No active peers - isolated node",
        currentPeers: 0,
        targetPeers: THRESHOLDS.minHealthyPeers,
        priority: "critical",
      });
    } else if (analysis.activePeers < THRESHOLDS.minHealthyPeers) {
      opportunities.push({
        nodeId: analysis.nodeId,
        address: analysis.address,
        issue: "Below minimum healthy peer count",
        currentPeers: analysis.activePeers,
        targetPeers: THRESHOLDS.minHealthyPeers,
        priority: "high",
      });
    } else if (analysis.activePeers < THRESHOLDS.optimalPeers) {
      opportunities.push({
        nodeId: analysis.nodeId,
        address: analysis.address,
        issue: "Below optimal peer count",
        currentPeers: analysis.activePeers,
        targetPeers: THRESHOLDS.optimalPeers,
        priority: "medium",
      });
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  opportunities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return opportunities;
}
