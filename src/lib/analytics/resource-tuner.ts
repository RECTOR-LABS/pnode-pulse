/**
 * Resource Tuner for Optimization Recommendations
 *
 * Analyzes node metrics and provides actionable recommendations
 * for resource optimization and performance tuning.
 */

export interface NodeResourceMetrics {
  cpuPercent: number;
  ramPercent: number;
  uptime: number;
  fileSize: bigint | number;
  version?: string;
  peerCount?: number;
}

export interface TuningRecommendation {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  impact: string;
  action: string;
  metric?: {
    current: number;
    threshold: number;
    unit: string;
  };
}

export type RecommendationCategory =
  | "cpu"
  | "memory"
  | "storage"
  | "network"
  | "uptime"
  | "version"
  | "general";

export type RecommendationPriority = "low" | "medium" | "high" | "critical";

/**
 * Thresholds for generating recommendations
 */
const THRESHOLDS = {
  cpu: {
    high: 80,
    veryHigh: 95,
    low: 5,
  },
  ram: {
    high: 85,
    veryHigh: 95,
    low: 20,
  },
  uptime: {
    unstable: 3600, // 1 hour
    shortRun: 86400, // 1 day
  },
  peers: {
    low: 5,
    veryLow: 2,
  },
  storage: {
    large: 500 * 1024 * 1024 * 1024, // 500GB
  },
} as const;

/**
 * Generate tuning recommendations for a node
 */
export function generateTuningRecommendations(
  metrics: NodeResourceMetrics,
  latestVersion?: string
): TuningRecommendation[] {
  const recommendations: TuningRecommendation[] = [];

  // CPU Recommendations
  if (metrics.cpuPercent >= THRESHOLDS.cpu.veryHigh) {
    recommendations.push({
      id: "cpu-critical",
      category: "cpu",
      priority: "critical",
      title: "Critical CPU Usage",
      description: `CPU usage is at ${metrics.cpuPercent.toFixed(1)}%, which may cause performance degradation and instability.`,
      impact: "Node responsiveness and reliability severely impacted",
      action: "Investigate CPU-intensive processes. Consider upgrading hardware or optimizing workloads.",
      metric: {
        current: metrics.cpuPercent,
        threshold: THRESHOLDS.cpu.veryHigh,
        unit: "%",
      },
    });
  } else if (metrics.cpuPercent >= THRESHOLDS.cpu.high) {
    recommendations.push({
      id: "cpu-high",
      category: "cpu",
      priority: "medium",
      title: "High CPU Usage",
      description: `CPU usage is at ${metrics.cpuPercent.toFixed(1)}%, approaching concerning levels.`,
      impact: "May affect node performance during peak loads",
      action: "Monitor CPU trends. Consider load balancing or resource optimization.",
      metric: {
        current: metrics.cpuPercent,
        threshold: THRESHOLDS.cpu.high,
        unit: "%",
      },
    });
  } else if (metrics.cpuPercent < THRESHOLDS.cpu.low && metrics.uptime > 86400) {
    recommendations.push({
      id: "cpu-underutilized",
      category: "cpu",
      priority: "low",
      title: "CPU Underutilized",
      description: `CPU usage is only ${metrics.cpuPercent.toFixed(1)}%, indicating potential for additional workloads.`,
      impact: "Resources may be over-provisioned",
      action: "Consider rightsizing the node or adding additional pNode workloads.",
      metric: {
        current: metrics.cpuPercent,
        threshold: THRESHOLDS.cpu.low,
        unit: "%",
      },
    });
  }

  // Memory Recommendations
  if (metrics.ramPercent >= THRESHOLDS.ram.veryHigh) {
    recommendations.push({
      id: "ram-critical",
      category: "memory",
      priority: "critical",
      title: "Critical Memory Usage",
      description: `Memory usage is at ${metrics.ramPercent.toFixed(1)}%, risking out-of-memory conditions.`,
      impact: "Node may become unresponsive or crash",
      action: "Add more RAM or identify memory-intensive processes. Consider enabling swap if not configured.",
      metric: {
        current: metrics.ramPercent,
        threshold: THRESHOLDS.ram.veryHigh,
        unit: "%",
      },
    });
  } else if (metrics.ramPercent >= THRESHOLDS.ram.high) {
    recommendations.push({
      id: "ram-high",
      category: "memory",
      priority: "medium",
      title: "High Memory Usage",
      description: `Memory usage is at ${metrics.ramPercent.toFixed(1)}%, leaving little headroom.`,
      impact: "Performance may degrade under load spikes",
      action: "Monitor memory trends. Consider adding RAM or optimizing memory usage.",
      metric: {
        current: metrics.ramPercent,
        threshold: THRESHOLDS.ram.high,
        unit: "%",
      },
    });
  } else if (metrics.ramPercent < THRESHOLDS.ram.low && metrics.uptime > 86400) {
    recommendations.push({
      id: "ram-underutilized",
      category: "memory",
      priority: "low",
      title: "Memory Underutilized",
      description: `Memory usage is only ${metrics.ramPercent.toFixed(1)}%, indicating over-provisioning.`,
      impact: "Resources may be inefficiently allocated",
      action: "Consider rightsizing the node to reduce costs.",
      metric: {
        current: metrics.ramPercent,
        threshold: THRESHOLDS.ram.low,
        unit: "%",
      },
    });
  }

  // Uptime Recommendations
  if (metrics.uptime < THRESHOLDS.uptime.unstable) {
    recommendations.push({
      id: "uptime-unstable",
      category: "uptime",
      priority: "high",
      title: "Node Recently Restarted",
      description: `Node has been running for less than 1 hour (${Math.floor(metrics.uptime / 60)} minutes).`,
      impact: "Frequent restarts reduce network reliability",
      action: "Investigate cause of restart. Check logs for errors or crashes. Ensure proper system configuration.",
      metric: {
        current: metrics.uptime,
        threshold: THRESHOLDS.uptime.unstable,
        unit: "seconds",
      },
    });
  } else if (metrics.uptime < THRESHOLDS.uptime.shortRun) {
    recommendations.push({
      id: "uptime-short",
      category: "uptime",
      priority: "medium",
      title: "Short Uptime",
      description: `Node has only been running for ${Math.floor(metrics.uptime / 3600)} hours.`,
      impact: "May indicate stability issues",
      action: "Monitor for unexpected restarts. Review system logs for warnings.",
      metric: {
        current: metrics.uptime,
        threshold: THRESHOLDS.uptime.shortRun,
        unit: "seconds",
      },
    });
  }

  // Network/Peer Recommendations
  if (metrics.peerCount !== undefined) {
    if (metrics.peerCount <= THRESHOLDS.peers.veryLow) {
      recommendations.push({
        id: "peers-critical",
        category: "network",
        priority: "high",
        title: "Very Low Peer Count",
        description: `Node has only ${metrics.peerCount} peer(s), limiting network participation.`,
        impact: "Reduced network connectivity and data availability",
        action: "Check network configuration and firewall rules. Ensure port 9001 is accessible.",
        metric: {
          current: metrics.peerCount,
          threshold: THRESHOLDS.peers.veryLow,
          unit: "peers",
        },
      });
    } else if (metrics.peerCount < THRESHOLDS.peers.low) {
      recommendations.push({
        id: "peers-low",
        category: "network",
        priority: "medium",
        title: "Low Peer Count",
        description: `Node has only ${metrics.peerCount} peers.`,
        impact: "May affect network efficiency",
        action: "Monitor peer discovery. Consider checking network connectivity.",
        metric: {
          current: metrics.peerCount,
          threshold: THRESHOLDS.peers.low,
          unit: "peers",
        },
      });
    }
  }

  // Version Recommendations
  if (metrics.version && latestVersion) {
    const currentParts = metrics.version.replace(/^v/, "").split(".").map(Number);
    const latestParts = latestVersion.replace(/^v/, "").split(".").map(Number);

    if (currentParts[0] < latestParts[0]) {
      recommendations.push({
        id: "version-major",
        category: "version",
        priority: "critical",
        title: "Major Version Update Available",
        description: `Running v${metrics.version}, but v${latestVersion} is available.`,
        impact: "Missing important features and security updates",
        action: "Schedule upgrade to the latest version as soon as possible.",
      });
    } else if (currentParts[1] < latestParts[1]) {
      recommendations.push({
        id: "version-minor",
        category: "version",
        priority: "medium",
        title: "Minor Version Update Available",
        description: `Running v${metrics.version}, v${latestVersion} is available.`,
        impact: "Missing new features and improvements",
        action: "Plan upgrade during next maintenance window.",
      });
    }
  }

  // Storage Recommendations
  const fileSize = Number(metrics.fileSize);
  if (fileSize > THRESHOLDS.storage.large) {
    recommendations.push({
      id: "storage-large",
      category: "storage",
      priority: "low",
      title: "Large Storage Footprint",
      description: `Node is storing ${(fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB of data.`,
      impact: "Normal operation, but monitor growth trends",
      action: "Ensure adequate storage capacity for future growth.",
      metric: {
        current: fileSize / (1024 * 1024 * 1024),
        threshold: THRESHOLDS.storage.large / (1024 * 1024 * 1024),
        unit: "GB",
      },
    });
  }

  // Sort by priority
  const priorityOrder: Record<RecommendationPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * Get summary of recommendations across multiple nodes
 */
export function summarizeRecommendations(
  allRecommendations: Array<{ nodeId: number; recommendations: TuningRecommendation[] }>
): {
  totalNodes: number;
  nodesWithRecommendations: number;
  byPriority: Record<RecommendationPriority, number>;
  byCategory: Record<RecommendationCategory, number>;
  topIssues: Array<{ issue: string; count: number; priority: RecommendationPriority }>;
} {
  const byPriority: Record<RecommendationPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const byCategory: Record<RecommendationCategory, number> = {
    cpu: 0,
    memory: 0,
    storage: 0,
    network: 0,
    uptime: 0,
    version: 0,
    general: 0,
  };

  const issueCount: Record<string, { count: number; priority: RecommendationPriority }> = {};

  let nodesWithRecommendations = 0;

  allRecommendations.forEach(({ recommendations }) => {
    if (recommendations.length > 0) {
      nodesWithRecommendations++;
    }

    recommendations.forEach((rec) => {
      byPriority[rec.priority]++;
      byCategory[rec.category]++;

      if (!issueCount[rec.id]) {
        issueCount[rec.id] = { count: 0, priority: rec.priority };
      }
      issueCount[rec.id].count++;
    });
  });

  const topIssues = Object.entries(issueCount)
    .map(([issue, data]) => ({ issue, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalNodes: allRecommendations.length,
    nodesWithRecommendations,
    byPriority,
    byCategory,
    topIssues,
  };
}
