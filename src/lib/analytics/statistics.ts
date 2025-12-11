/**
 * Statistical Utilities for Analytics
 *
 * Provides basic statistical functions for outlier detection
 * and data analysis.
 */

export interface StatisticalSummary {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Calculate mean of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate median of an array of numbers
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate standard deviation
 */
export function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squaredDiffs));
}

/**
 * Calculate z-score for a value given mean and standard deviation
 */
export function zScore(value: number, avg: number, std: number): number {
  if (std === 0) return 0;
  return (value - avg) / std;
}

/**
 * Calculate statistical summary for an array of numbers
 */
export function calculateSummary(values: number[]): StatisticalSummary {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, count: 0 };
  }
  return {
    mean: mean(values),
    median: median(values),
    stdDev: stdDev(values),
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  };
}

/**
 * Detect outliers using z-score method
 * Returns indices of outliers
 */
export function detectOutliers(
  values: number[],
  threshold: number = 2.0
): number[] {
  if (values.length < 3) return [];

  const avg = mean(values);
  const std = stdDev(values);

  if (std === 0) return [];

  return values
    .map((v, i) => ({ index: i, z: Math.abs(zScore(v, avg, std)) }))
    .filter((item) => item.z > threshold)
    .map((item) => item.index);
}

/**
 * Categorize a value based on z-score
 */
export type OutlierCategory = "normal" | "high" | "very_high" | "low" | "very_low";

export function categorizeValue(
  value: number,
  avg: number,
  std: number
): OutlierCategory {
  if (std === 0) return "normal";

  const z = zScore(value, avg, std);

  if (z > 3) return "very_high";
  if (z > 2) return "high";
  if (z < -3) return "very_low";
  if (z < -2) return "low";
  return "normal";
}

/**
 * Calculate percentile rank
 */
export function percentileRank(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v < value).length;
  return (below / values.length) * 100;
}
