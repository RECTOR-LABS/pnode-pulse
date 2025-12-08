/**
 * Health Scorer for pNode Analytics
 *
 * Calculates health scores for individual nodes and the network.
 * Uses a weighted scoring algorithm based on key metrics.
 */

import { mean, categorizeValue, type OutlierCategory } from "./statistics";

/**
 * Metric weights for health score calculation
 * Higher weight = more impact on final score
 */
export const HEALTH_WEIGHTS = {
  uptime: 0.35,      // 35% - Stability is critical
  cpu: 0.20,         // 20% - Performance indicator
  ram: 0.20,         // 20% - Resource efficiency
  connectivity: 0.15, // 15% - Network participation
  version: 0.10,     // 10% - Up-to-date software
} as const;

/**
 * Thresholds for metric scoring
 */
export const HEALTH_THRESHOLDS = {
  // Uptime thresholds (seconds)
  uptime: {
    excellent: 7 * 24 * 60 * 60,  // 7 days
    good: 24 * 60 * 60,           // 1 day
    fair: 60 * 60,                // 1 hour
  },
  // CPU usage thresholds (percent) - lower is better
  cpu: {
    excellent: 20,
    good: 50,
    fair: 80,
  },
  // RAM usage thresholds (percent) - lower is better
  ram: {
    excellent: 40,
    good: 70,
    fair: 90,
  },
  // Peer count thresholds
  connectivity: {
    excellent: 20,
    good: 10,
    fair: 5,
  },
} as const;

export interface NodeMetrics {
  cpuPercent: number;
  ramPercent: number;
  uptime: number;
  peerCount?: number;
  version?: string;
  isActive: boolean;
}

export interface NetworkStats {
  latestVersion: string;
  avgCpu: number;
  avgRam: number;
  avgUptime: number;
  cpuStdDev: number;
  ramStdDev: number;
  uptimeStdDev: number;
}

export interface HealthScore {
  overall: number;        // 0-100 final score
  grade: HealthGrade;     // A-F letter grade
  components: {
    uptime: number;
    cpu: number;
    ram: number;
    connectivity: number;
    version: number;
  };
  details: {
    uptimeStatus: string;
    cpuStatus: string;
    ramStatus: string;
    connectivityStatus: string;
    versionStatus: string;
  };
  outliers: {
    cpu: OutlierCategory;
    ram: OutlierCategory;
    uptime: OutlierCategory;
  };
}

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

/**
 * Convert overall score to letter grade
 */
function scoreToGrade(score: number): HealthGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Calculate uptime component score (0-100)
 */
function calculateUptimeScore(uptime: number): { score: number; status: string } {
  const { excellent, good, fair } = HEALTH_THRESHOLDS.uptime;

  if (uptime >= excellent) {
    return { score: 100, status: "Excellent - Running for 7+ days" };
  }
  if (uptime >= good) {
    const days = Math.floor(uptime / 86400);
    return {
      score: 75 + (25 * (uptime - good) / (excellent - good)),
      status: `Good - Running for ${days} day(s)`,
    };
  }
  if (uptime >= fair) {
    const hours = Math.floor(uptime / 3600);
    return {
      score: 50 + (25 * (uptime - fair) / (good - fair)),
      status: `Fair - Running for ${hours} hour(s)`,
    };
  }
  const minutes = Math.floor(uptime / 60);
  return {
    score: Math.max(0, 50 * (uptime / fair)),
    status: `Poor - Only ${minutes} minute(s) uptime`,
  };
}

/**
 * Calculate CPU component score (0-100) - lower CPU is better
 */
function calculateCpuScore(cpuPercent: number): { score: number; status: string } {
  const { excellent, good, fair } = HEALTH_THRESHOLDS.cpu;

  if (cpuPercent <= excellent) {
    return { score: 100, status: "Excellent - Low CPU usage" };
  }
  if (cpuPercent <= good) {
    return {
      score: 75 + (25 * (good - cpuPercent) / (good - excellent)),
      status: "Good - Moderate CPU usage",
    };
  }
  if (cpuPercent <= fair) {
    return {
      score: 50 + (25 * (fair - cpuPercent) / (fair - good)),
      status: "Fair - High CPU usage",
    };
  }
  return {
    score: Math.max(0, 50 * (100 - cpuPercent) / (100 - fair)),
    status: "Poor - Very high CPU usage",
  };
}

/**
 * Calculate RAM component score (0-100) - lower RAM is better
 */
function calculateRamScore(ramPercent: number): { score: number; status: string } {
  const { excellent, good, fair } = HEALTH_THRESHOLDS.ram;

  if (ramPercent <= excellent) {
    return { score: 100, status: "Excellent - Low memory usage" };
  }
  if (ramPercent <= good) {
    return {
      score: 75 + (25 * (good - ramPercent) / (good - excellent)),
      status: "Good - Moderate memory usage",
    };
  }
  if (ramPercent <= fair) {
    return {
      score: 50 + (25 * (fair - ramPercent) / (fair - good)),
      status: "Fair - High memory usage",
    };
  }
  return {
    score: Math.max(0, 50 * (100 - ramPercent) / (100 - fair)),
    status: "Poor - Very high memory usage",
  };
}

/**
 * Calculate connectivity component score (0-100)
 */
function calculateConnectivityScore(
  peerCount: number | undefined
): { score: number; status: string } {
  if (peerCount === undefined) {
    return { score: 50, status: "Unknown - No peer data" };
  }

  const { excellent, good, fair } = HEALTH_THRESHOLDS.connectivity;

  if (peerCount >= excellent) {
    return { score: 100, status: `Excellent - ${peerCount} peers` };
  }
  if (peerCount >= good) {
    return {
      score: 75 + (25 * (peerCount - good) / (excellent - good)),
      status: `Good - ${peerCount} peers`,
    };
  }
  if (peerCount >= fair) {
    return {
      score: 50 + (25 * (peerCount - fair) / (good - fair)),
      status: `Fair - ${peerCount} peers`,
    };
  }
  return {
    score: Math.max(0, 50 * (peerCount / fair)),
    status: peerCount === 0 ? "Poor - No peers" : `Poor - Only ${peerCount} peer(s)`,
  };
}

/**
 * Calculate version component score (0-100)
 */
function calculateVersionScore(
  nodeVersion: string | undefined,
  latestVersion: string
): { score: number; status: string } {
  if (!nodeVersion) {
    return { score: 50, status: "Unknown version" };
  }

  // Parse version strings (e.g., "0.6.0" -> [0, 6, 0])
  const parseVersion = (v: string): number[] => {
    return v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  };

  const nodeParts = parseVersion(nodeVersion);
  const latestParts = parseVersion(latestVersion);

  // Compare major, minor, patch
  const majorDiff = latestParts[0] - nodeParts[0];
  const minorDiff = latestParts[1] - nodeParts[1];

  if (majorDiff === 0 && minorDiff === 0) {
    const patchDiff = latestParts[2] - nodeParts[2];
    if (patchDiff === 0) {
      return { score: 100, status: `Up to date (v${nodeVersion})` };
    }
    if (patchDiff === 1) {
      return { score: 85, status: `1 patch behind (v${nodeVersion})` };
    }
    return { score: 70, status: `${patchDiff} patches behind (v${nodeVersion})` };
  }

  if (majorDiff === 0 && minorDiff === 1) {
    return { score: 60, status: `1 minor version behind (v${nodeVersion})` };
  }

  if (majorDiff === 0 && minorDiff > 1) {
    return { score: 40, status: `${minorDiff} minor versions behind (v${nodeVersion})` };
  }

  if (majorDiff === 1) {
    return { score: 20, status: `1 major version behind (v${nodeVersion})` };
  }

  return { score: 0, status: `${majorDiff} major versions behind (v${nodeVersion})` };
}

/**
 * Calculate health score for a single node
 */
export function calculateNodeHealth(
  metrics: NodeMetrics,
  networkStats: NetworkStats
): HealthScore {
  // If node is inactive, return minimal score
  if (!metrics.isActive) {
    return {
      overall: 0,
      grade: "F",
      components: { uptime: 0, cpu: 0, ram: 0, connectivity: 0, version: 0 },
      details: {
        uptimeStatus: "Offline",
        cpuStatus: "Offline",
        ramStatus: "Offline",
        connectivityStatus: "Offline",
        versionStatus: "Offline",
      },
      outliers: { cpu: "normal", ram: "normal", uptime: "normal" },
    };
  }

  // Calculate individual component scores
  const uptime = calculateUptimeScore(metrics.uptime);
  const cpu = calculateCpuScore(metrics.cpuPercent);
  const ram = calculateRamScore(metrics.ramPercent);
  const connectivity = calculateConnectivityScore(metrics.peerCount);
  const version = calculateVersionScore(metrics.version, networkStats.latestVersion);

  // Calculate weighted overall score
  const overall =
    uptime.score * HEALTH_WEIGHTS.uptime +
    cpu.score * HEALTH_WEIGHTS.cpu +
    ram.score * HEALTH_WEIGHTS.ram +
    connectivity.score * HEALTH_WEIGHTS.connectivity +
    version.score * HEALTH_WEIGHTS.version;

  // Determine outlier categories
  const outliers = {
    cpu: categorizeValue(metrics.cpuPercent, networkStats.avgCpu, networkStats.cpuStdDev),
    ram: categorizeValue(metrics.ramPercent, networkStats.avgRam, networkStats.ramStdDev),
    uptime: categorizeValue(metrics.uptime, networkStats.avgUptime, networkStats.uptimeStdDev),
  };

  return {
    overall: Math.round(overall * 10) / 10,
    grade: scoreToGrade(overall),
    components: {
      uptime: Math.round(uptime.score),
      cpu: Math.round(cpu.score),
      ram: Math.round(ram.score),
      connectivity: Math.round(connectivity.score),
      version: Math.round(version.score),
    },
    details: {
      uptimeStatus: uptime.status,
      cpuStatus: cpu.status,
      ramStatus: ram.status,
      connectivityStatus: connectivity.status,
      versionStatus: version.status,
    },
    outliers,
  };
}

/**
 * Calculate network-wide health summary
 */
export function calculateNetworkHealth(
  nodeScores: HealthScore[]
): {
  avgScore: number;
  grade: HealthGrade;
  distribution: { A: number; B: number; C: number; D: number; F: number };
  healthyPercentage: number;
} {
  if (nodeScores.length === 0) {
    return {
      avgScore: 0,
      grade: "F",
      distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      healthyPercentage: 0,
    };
  }

  const scores = nodeScores.map((n) => n.overall);
  const avgScore = mean(scores);

  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  nodeScores.forEach((n) => {
    distribution[n.grade]++;
  });

  const healthyCount = distribution.A + distribution.B + distribution.C;
  const healthyPercentage = (healthyCount / nodeScores.length) * 100;

  return {
    avgScore: Math.round(avgScore * 10) / 10,
    grade: scoreToGrade(avgScore),
    distribution,
    healthyPercentage: Math.round(healthyPercentage),
  };
}
