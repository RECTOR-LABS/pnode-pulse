/**
 * Degradation Predictor for Performance Prediction
 *
 * Predicts when nodes are likely to experience performance issues
 * using trend analysis, pattern detection, and classification.
 */

export interface MetricTimeSeries {
  timestamp: Date;
  value: number;
}

export interface DegradationIndicators {
  cpuTrend: TrendAnalysis;
  ramTrend: TrendAnalysis;
  uptimeStability: UptimeStability;
  overallRisk: RiskLevel;
  riskScore: number; // 0-100
  predictions: DegradationPrediction[];
}

export interface TrendAnalysis {
  slope: number; // Rate of change per hour
  acceleration: number; // Second derivative - is it speeding up?
  currentValue: number;
  predictedIn24h: number;
  trend: "increasing" | "stable" | "decreasing";
  concern: "none" | "low" | "moderate" | "high" | "critical";
}

export interface UptimeStability {
  recentRestarts: number; // Restarts in last 7 days
  avgUptimeBetweenRestarts: number; // Hours
  stability: "stable" | "unstable" | "critical";
  lastRestartAgo: number; // Hours since last restart
}

export type RiskLevel = "healthy" | "warning" | "elevated" | "critical";

export interface DegradationPrediction {
  id: string;
  metric: "cpu" | "ram" | "uptime" | "overall";
  severity: RiskLevel;
  confidence: number; // 0-1
  timeToIssue: number | null; // Hours until predicted issue, null if not predictable
  title: string;
  description: string;
  recommendation: string;
}

// Thresholds
const THRESHOLDS = {
  cpu: {
    warning: 70,
    elevated: 85,
    critical: 95,
  },
  ram: {
    warning: 75,
    elevated: 88,
    critical: 95,
  },
  trend: {
    // Percent change per hour that's concerning
    moderate: 0.5,
    high: 1.0,
    critical: 2.0,
  },
  restarts: {
    unstable: 3, // 3+ restarts in 7 days
    critical: 7, // 7+ restarts in 7 days
  },
} as const;

/**
 * Calculate trend from time series data
 */
export function analyzeTrend(
  data: MetricTimeSeries[],
  metricName: "cpu" | "ram",
): TrendAnalysis | null {
  if (data.length < 3) {
    return null;
  }

  // Sort by timestamp
  const sorted = [...data].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const currentValue = sorted[sorted.length - 1].value;
  const firstTimestamp = sorted[0].timestamp.getTime();

  // Convert to hours from first point
  const points = sorted.map((d) => ({
    x: (d.timestamp.getTime() - firstTimestamp) / (1000 * 60 * 60), // hours
    y: d.value,
  }));

  // Linear regression for slope
  const n = points.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;

  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;

  // Calculate acceleration (change in slope over time)
  // Use second half vs first half slope comparison
  const midpoint = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, midpoint);
  const secondHalf = points.slice(midpoint);

  let acceleration = 0;
  if (firstHalf.length >= 2 && secondHalf.length >= 2) {
    const slope1 = calculateSlope(firstHalf);
    const slope2 = calculateSlope(secondHalf);
    acceleration = slope2 - slope1;
  }

  // Predict value in 24 hours
  const predictedIn24h = currentValue + slope * 24;

  // Determine trend direction
  const hourlyChangePercent = Math.abs(slope);
  let trend: TrendAnalysis["trend"] = "stable";
  if (hourlyChangePercent > 0.1) {
    trend = slope > 0 ? "increasing" : "decreasing";
  }

  // Determine concern level
  let concern: TrendAnalysis["concern"] = "none";
  const thresholds = THRESHOLDS[metricName];

  if (
    currentValue >= thresholds.critical ||
    predictedIn24h >= thresholds.critical
  ) {
    concern = "critical";
  } else if (
    currentValue >= thresholds.elevated ||
    predictedIn24h >= thresholds.elevated
  ) {
    concern = "high";
  } else if (
    currentValue >= thresholds.warning ||
    predictedIn24h >= thresholds.warning
  ) {
    concern = "moderate";
  } else if (slope > THRESHOLDS.trend.moderate) {
    concern = "low";
  }

  return {
    slope,
    acceleration,
    currentValue,
    predictedIn24h: Math.max(0, Math.min(100, predictedIn24h)),
    trend,
    concern,
  };
}

function calculateSlope(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) return 0;

  const n = points.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;

  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Analyze uptime stability based on restart patterns
 */
export function analyzeUptimeStability(
  uptimeHistory: MetricTimeSeries[],
): UptimeStability {
  if (uptimeHistory.length < 2) {
    return {
      recentRestarts: 0,
      avgUptimeBetweenRestarts: 0,
      stability: "stable",
      lastRestartAgo: 0,
    };
  }

  // Sort by timestamp
  const sorted = [...uptimeHistory].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  // Detect restarts: when uptime decreases significantly
  const restarts: Date[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevUptime = sorted[i - 1].value;
    const currUptime = sorted[i].value;

    // Restart detected if uptime dropped significantly
    if (currUptime < prevUptime * 0.5 && prevUptime > 300) {
      restarts.push(sorted[i].timestamp);
    }
  }

  // Filter to last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentRestarts = restarts.filter(
    (r) => r.getTime() > sevenDaysAgo,
  ).length;

  // Calculate average uptime between restarts
  let avgUptimeBetweenRestarts = 0;
  if (restarts.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < restarts.length; i++) {
      intervals.push(
        (restarts[i].getTime() - restarts[i - 1].getTime()) / (1000 * 60 * 60),
      );
    }
    avgUptimeBetweenRestarts =
      intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  // Current uptime (last reading)
  const currentUptime = sorted[sorted.length - 1].value;
  const lastRestartAgo = currentUptime / 3600; // Convert seconds to hours

  // Determine stability
  let stability: UptimeStability["stability"] = "stable";
  if (recentRestarts >= THRESHOLDS.restarts.critical) {
    stability = "critical";
  } else if (recentRestarts >= THRESHOLDS.restarts.unstable) {
    stability = "unstable";
  }

  return {
    recentRestarts,
    avgUptimeBetweenRestarts,
    stability,
    lastRestartAgo,
  };
}

/**
 * Calculate overall risk level from individual indicators
 */
function calculateRiskLevel(
  cpuConcern: TrendAnalysis["concern"],
  ramConcern: TrendAnalysis["concern"],
  uptimeStability: UptimeStability["stability"],
): { level: RiskLevel; score: number } {
  const concernScores: Record<TrendAnalysis["concern"], number> = {
    none: 0,
    low: 15,
    moderate: 35,
    high: 60,
    critical: 90,
  };

  const stabilityScores: Record<UptimeStability["stability"], number> = {
    stable: 0,
    unstable: 40,
    critical: 80,
  };

  // Weight: CPU 35%, RAM 35%, Stability 30%
  const score =
    concernScores[cpuConcern] * 0.35 +
    concernScores[ramConcern] * 0.35 +
    stabilityScores[uptimeStability] * 0.3;

  let level: RiskLevel = "healthy";
  if (score >= 70) level = "critical";
  else if (score >= 45) level = "elevated";
  else if (score >= 20) level = "warning";

  return { level, score: Math.round(score) };
}

/**
 * Generate predictions based on analysis
 */
function generatePredictions(
  cpuTrend: TrendAnalysis | null,
  ramTrend: TrendAnalysis | null,
  uptimeStability: UptimeStability,
): DegradationPrediction[] {
  const predictions: DegradationPrediction[] = [];

  // CPU predictions
  if (cpuTrend) {
    if (cpuTrend.concern === "critical") {
      predictions.push({
        id: "cpu-critical",
        metric: "cpu",
        severity: "critical",
        confidence: 0.9,
        timeToIssue:
          cpuTrend.predictedIn24h >= 95
            ? calculateTimeToThreshold(cpuTrend, 95)
            : 0,
        title: "CPU Critical - Immediate Action Required",
        description: `CPU at ${cpuTrend.currentValue.toFixed(1)}%, ${cpuTrend.trend === "increasing" ? "still rising" : "at critical levels"}.`,
        recommendation:
          "Investigate CPU-intensive processes immediately. Consider restarting or scaling resources.",
      });
    } else if (cpuTrend.concern === "high") {
      const timeToIssue = calculateTimeToThreshold(
        cpuTrend,
        THRESHOLDS.cpu.critical,
      );
      predictions.push({
        id: "cpu-elevated",
        metric: "cpu",
        severity: "elevated",
        confidence: 0.75,
        timeToIssue,
        title: "CPU Trending High",
        description: `CPU at ${cpuTrend.currentValue.toFixed(1)}% and ${cpuTrend.trend}. Predicted to reach ${cpuTrend.predictedIn24h.toFixed(1)}% in 24h.`,
        recommendation: timeToIssue
          ? `Monitor closely. May reach critical levels in ~${timeToIssue.toFixed(0)} hours.`
          : "Monitor CPU usage trends and prepare for intervention.",
      });
    } else if (cpuTrend.acceleration > 0.1 && cpuTrend.slope > 0) {
      predictions.push({
        id: "cpu-accelerating",
        metric: "cpu",
        severity: "warning",
        confidence: 0.6,
        timeToIssue: null,
        title: "CPU Usage Accelerating",
        description: `CPU increase is accelerating. Current: ${cpuTrend.currentValue.toFixed(1)}%, rate increasing.`,
        recommendation: "Investigate cause of increasing CPU demand.",
      });
    }
  }

  // RAM predictions
  if (ramTrend) {
    if (ramTrend.concern === "critical") {
      predictions.push({
        id: "ram-critical",
        metric: "ram",
        severity: "critical",
        confidence: 0.9,
        timeToIssue: 0,
        title: "Memory Critical - OOM Risk",
        description: `RAM at ${ramTrend.currentValue.toFixed(1)}%, risk of out-of-memory condition.`,
        recommendation:
          "Free up memory immediately. Identify memory leaks or restart the service.",
      });
    } else if (ramTrend.concern === "high") {
      const timeToIssue = calculateTimeToThreshold(
        ramTrend,
        THRESHOLDS.ram.critical,
      );
      predictions.push({
        id: "ram-elevated",
        metric: "ram",
        severity: "elevated",
        confidence: 0.75,
        timeToIssue,
        title: "Memory Trending High",
        description: `RAM at ${ramTrend.currentValue.toFixed(1)}%, projected to reach ${ramTrend.predictedIn24h.toFixed(1)}% in 24h.`,
        recommendation: timeToIssue
          ? `Potential memory exhaustion in ~${timeToIssue.toFixed(0)} hours.`
          : "Monitor memory usage and prepare for intervention.",
      });
    } else if (ramTrend.slope > 0.2 && ramTrend.currentValue > 50) {
      predictions.push({
        id: "ram-leak-possible",
        metric: "ram",
        severity: "warning",
        confidence: 0.5,
        timeToIssue: null,
        title: "Possible Memory Leak",
        description: `RAM steadily increasing (${ramTrend.slope.toFixed(2)}%/hr). May indicate memory leak.`,
        recommendation: "Monitor for consistent memory growth pattern.",
      });
    }
  }

  // Uptime predictions
  if (uptimeStability.stability === "critical") {
    predictions.push({
      id: "uptime-critical",
      metric: "uptime",
      severity: "critical",
      confidence: 0.85,
      timeToIssue: null,
      title: "Frequent Restarts Detected",
      description: `${uptimeStability.recentRestarts} restarts in the last 7 days indicates serious instability.`,
      recommendation:
        "Investigate crash logs. Check for hardware issues or software bugs.",
    });
  } else if (uptimeStability.stability === "unstable") {
    predictions.push({
      id: "uptime-unstable",
      metric: "uptime",
      severity: "warning",
      confidence: 0.7,
      timeToIssue: null,
      title: "Node Stability Concern",
      description: `${uptimeStability.recentRestarts} restarts in 7 days. Average uptime: ${uptimeStability.avgUptimeBetweenRestarts.toFixed(0)}h.`,
      recommendation: "Review system logs to identify restart causes.",
    });
  }

  // Sort by severity
  const severityOrder: Record<RiskLevel, number> = {
    critical: 0,
    elevated: 1,
    warning: 2,
    healthy: 3,
  };

  predictions.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return predictions;
}

/**
 * Calculate hours until a threshold is reached
 */
function calculateTimeToThreshold(
  trend: TrendAnalysis,
  threshold: number,
): number | null {
  if (trend.slope <= 0) return null;
  if (trend.currentValue >= threshold) return 0;

  const hoursToThreshold = (threshold - trend.currentValue) / trend.slope;
  return hoursToThreshold > 0 && hoursToThreshold < 168
    ? hoursToThreshold
    : null; // Cap at 1 week
}

/**
 * Main function: Analyze node for degradation indicators
 */
export function predictDegradation(
  cpuHistory: MetricTimeSeries[],
  ramHistory: MetricTimeSeries[],
  uptimeHistory: MetricTimeSeries[],
): DegradationIndicators {
  const cpuTrend = analyzeTrend(cpuHistory, "cpu");
  const ramTrend = analyzeTrend(ramHistory, "ram");
  const uptimeStability = analyzeUptimeStability(uptimeHistory);

  const { level: overallRisk, score: riskScore } = calculateRiskLevel(
    cpuTrend?.concern ?? "none",
    ramTrend?.concern ?? "none",
    uptimeStability.stability,
  );

  const predictions = generatePredictions(cpuTrend, ramTrend, uptimeStability);

  return {
    cpuTrend: cpuTrend ?? {
      slope: 0,
      acceleration: 0,
      currentValue: 0,
      predictedIn24h: 0,
      trend: "stable",
      concern: "none",
    },
    ramTrend: ramTrend ?? {
      slope: 0,
      acceleration: 0,
      currentValue: 0,
      predictedIn24h: 0,
      trend: "stable",
      concern: "none",
    },
    uptimeStability,
    overallRisk,
    riskScore,
    predictions,
  };
}

/**
 * Batch analysis for multiple nodes
 */
export interface NodeDegradationSummary {
  nodeId: number;
  address: string;
  riskLevel: RiskLevel;
  riskScore: number;
  topPrediction: DegradationPrediction | null;
}

export interface NetworkDegradationSummary {
  totalNodes: number;
  byRiskLevel: Record<RiskLevel, number>;
  atRiskNodes: NodeDegradationSummary[];
  criticalAlerts: number;
  elevatedAlerts: number;
  healthyPercentage: number;
}

export function summarizeNetworkDegradation(
  nodeAnalyses: Array<{
    nodeId: number;
    address: string;
    indicators: DegradationIndicators;
  }>,
): NetworkDegradationSummary {
  const byRiskLevel: Record<RiskLevel, number> = {
    healthy: 0,
    warning: 0,
    elevated: 0,
    critical: 0,
  };

  const atRiskNodes: NodeDegradationSummary[] = [];

  nodeAnalyses.forEach(({ nodeId, address, indicators }) => {
    byRiskLevel[indicators.overallRisk]++;

    if (indicators.overallRisk !== "healthy") {
      atRiskNodes.push({
        nodeId,
        address,
        riskLevel: indicators.overallRisk,
        riskScore: indicators.riskScore,
        topPrediction: indicators.predictions[0] ?? null,
      });
    }
  });

  // Sort at-risk nodes by score (highest first)
  atRiskNodes.sort((a, b) => b.riskScore - a.riskScore);

  const totalNodes = nodeAnalyses.length;
  const healthyPercentage =
    totalNodes > 0 ? (byRiskLevel.healthy / totalNodes) * 100 : 100;

  return {
    totalNodes,
    byRiskLevel,
    atRiskNodes: atRiskNodes.slice(0, 20), // Top 20 at-risk
    criticalAlerts: byRiskLevel.critical,
    elevatedAlerts: byRiskLevel.elevated,
    healthyPercentage,
  };
}
