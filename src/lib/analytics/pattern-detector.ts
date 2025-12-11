/**
 * Pattern Detector for Anomaly Detection
 *
 * Detects deviations from historical patterns/baselines.
 * Uses rolling statistics and adaptive thresholds.
 */

import { mean, stdDev, calculateSummary, type StatisticalSummary } from "./statistics";

export interface NodeBaseline {
  nodeId: number;
  metric: PatternMetric;
  period: BaselinePeriod;
  stats: StatisticalSummary;
  hourlyPattern: number[]; // 24 values, one per hour
  dayOfWeekPattern: number[]; // 7 values, one per day
  updatedAt: Date;
}

export type PatternMetric = "cpu" | "ram" | "uptime" | "packets_received" | "packets_sent";
export type BaselinePeriod = "7d" | "14d" | "30d";

export interface PatternDeviation {
  nodeId: number;
  metric: PatternMetric;
  currentValue: number;
  baselineValue: number;
  deviation: number; // Percentage deviation
  deviationType: DeviationType;
  severity: DeviationSeverity;
  timestamp: Date;
  message: string;
}

export type DeviationType = "above_baseline" | "below_baseline" | "pattern_break";
export type DeviationSeverity = "info" | "warning" | "critical";

/**
 * Thresholds for deviation severity
 */
export const DEVIATION_THRESHOLDS = {
  // Percentage deviation from baseline
  warning: 50, // 50% deviation
  critical: 100, // 100% deviation (2x baseline)
  // Minimum baseline value to consider (avoid division by zero issues)
  minBaseline: 1,
} as const;

/**
 * Calculate baseline statistics from historical data
 */
export function calculateBaseline(
  values: Array<{ value: number; timestamp: Date }>,
  _period: BaselinePeriod
): NodeBaseline["stats"] & { hourlyPattern: number[]; dayOfWeekPattern: number[] } {
  if (values.length === 0) {
    return {
      ...calculateSummary([]),
      hourlyPattern: new Array(24).fill(0),
      dayOfWeekPattern: new Array(7).fill(0),
    };
  }

  const numericValues = values.map((v) => v.value);
  const stats = calculateSummary(numericValues);

  // Calculate hourly pattern (average value per hour of day)
  const hourlyBuckets: number[][] = Array.from({ length: 24 }, () => []);
  values.forEach((v) => {
    const hour = v.timestamp.getUTCHours();
    hourlyBuckets[hour].push(v.value);
  });
  const hourlyPattern = hourlyBuckets.map((bucket) =>
    bucket.length > 0 ? mean(bucket) : stats.mean
  );

  // Calculate day-of-week pattern (average value per day)
  const dowBuckets: number[][] = Array.from({ length: 7 }, () => []);
  values.forEach((v) => {
    const dow = v.timestamp.getUTCDay();
    dowBuckets[dow].push(v.value);
  });
  const dayOfWeekPattern = dowBuckets.map((bucket) =>
    bucket.length > 0 ? mean(bucket) : stats.mean
  );

  return {
    ...stats,
    hourlyPattern,
    dayOfWeekPattern,
  };
}

/**
 * Get expected value based on time patterns
 */
export function getExpectedValue(
  baseline: NodeBaseline,
  timestamp: Date
): number {
  const hour = timestamp.getUTCHours();
  const dow = timestamp.getUTCDay();

  // Weighted combination: 60% hourly pattern, 30% day-of-week, 10% overall mean
  const hourlyValue = baseline.hourlyPattern[hour] ?? baseline.stats.mean;
  const dowValue = baseline.dayOfWeekPattern[dow] ?? baseline.stats.mean;

  return (
    hourlyValue * 0.6 +
    dowValue * 0.3 +
    baseline.stats.mean * 0.1
  );
}

/**
 * Calculate deviation from baseline
 */
export function calculateDeviation(
  currentValue: number,
  expectedValue: number,
  baselineStats: StatisticalSummary
): { deviation: number; deviationType: DeviationType; severity: DeviationSeverity } {
  // Handle edge cases
  if (baselineStats.count === 0 || expectedValue < DEVIATION_THRESHOLDS.minBaseline) {
    return {
      deviation: 0,
      deviationType: "above_baseline",
      severity: "info",
    };
  }

  // Calculate percentage deviation
  const deviation = ((currentValue - expectedValue) / expectedValue) * 100;
  const absDeviation = Math.abs(deviation);

  // Determine type
  const deviationType: DeviationType = deviation > 0 ? "above_baseline" : "below_baseline";

  // Determine severity
  let severity: DeviationSeverity = "info";
  if (absDeviation >= DEVIATION_THRESHOLDS.critical) {
    severity = "critical";
  } else if (absDeviation >= DEVIATION_THRESHOLDS.warning) {
    severity = "warning";
  }

  return { deviation, deviationType, severity };
}

/**
 * Detect pattern deviations for a node
 */
export function detectPatternDeviation(
  nodeId: number,
  metric: PatternMetric,
  currentValue: number,
  baseline: NodeBaseline,
  timestamp: Date = new Date()
): PatternDeviation | null {
  const expectedValue = getExpectedValue(baseline, timestamp);
  const { deviation, deviationType, severity } = calculateDeviation(
    currentValue,
    expectedValue,
    baseline.stats
  );

  // Only report significant deviations (warning or critical)
  if (severity === "info") {
    return null;
  }

  const metricLabel = {
    cpu: "CPU usage",
    ram: "RAM usage",
    uptime: "Uptime",
    packets_received: "Packets received",
    packets_sent: "Packets sent",
  }[metric];

  const message = deviation > 0
    ? `${metricLabel} is ${Math.abs(deviation).toFixed(1)}% above baseline (current: ${currentValue.toFixed(1)}, expected: ${expectedValue.toFixed(1)})`
    : `${metricLabel} is ${Math.abs(deviation).toFixed(1)}% below baseline (current: ${currentValue.toFixed(1)}, expected: ${expectedValue.toFixed(1)})`;

  return {
    nodeId,
    metric,
    currentValue,
    baselineValue: expectedValue,
    deviation,
    deviationType,
    severity,
    timestamp,
    message,
  };
}

/**
 * Detect sudden changes (spikes/drops)
 * Compares current value against recent window
 */
export function detectSuddenChange(
  recentValues: number[],
  currentValue: number,
  metric: PatternMetric
): {
  isSpike: boolean;
  isDrop: boolean;
  changePercent: number;
  message: string;
} | null {
  if (recentValues.length < 5) {
    return null; // Not enough data
  }

  const recentMean = mean(recentValues);
  const recentStd = stdDev(recentValues);

  // Avoid false positives on stable metrics
  if (recentStd < 0.5) {
    return null;
  }

  const zScore = recentStd > 0 ? (currentValue - recentMean) / recentStd : 0;
  const changePercent = recentMean > 0
    ? ((currentValue - recentMean) / recentMean) * 100
    : 0;

  const isSpike = zScore > 3;
  const isDrop = zScore < -3;

  if (!isSpike && !isDrop) {
    return null;
  }

  const metricLabel = {
    cpu: "CPU usage",
    ram: "RAM usage",
    uptime: "Uptime",
    packets_received: "Packets received",
    packets_sent: "Packets sent",
  }[metric];

  const message = isSpike
    ? `Sudden spike in ${metricLabel}: ${changePercent.toFixed(1)}% increase from recent average`
    : `Sudden drop in ${metricLabel}: ${Math.abs(changePercent).toFixed(1)}% decrease from recent average`;

  return { isSpike, isDrop, changePercent, message };
}

/**
 * Generate deviation summary for a set of nodes
 */
export function summarizeDeviations(
  deviations: PatternDeviation[]
): {
  total: number;
  bySeverity: { info: number; warning: number; critical: number };
  byMetric: Record<PatternMetric, number>;
  topDeviations: PatternDeviation[];
} {
  const bySeverity = { info: 0, warning: 0, critical: 0 };
  const byMetric: Record<PatternMetric, number> = {
    cpu: 0,
    ram: 0,
    uptime: 0,
    packets_received: 0,
    packets_sent: 0,
  };

  deviations.forEach((d) => {
    bySeverity[d.severity]++;
    byMetric[d.metric]++;
  });

  // Sort by absolute deviation and take top 10
  const topDeviations = [...deviations]
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, 10);

  return {
    total: deviations.length,
    bySeverity,
    byMetric,
    topDeviations,
  };
}
