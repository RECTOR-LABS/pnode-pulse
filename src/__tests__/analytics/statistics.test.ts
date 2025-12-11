/**
 * Statistical Utilities Tests
 *
 * Tests basic statistical functions including mean, median, standard deviation,
 * z-scores, outlier detection, and value categorization.
 */

import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  stdDev,
  zScore,
  calculateSummary,
  detectOutliers,
  categorizeValue,
  percentileRank,
} from '@/lib/analytics/statistics';

describe('Statistical Utilities - mean()', () => {
  it('should calculate mean of numbers', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('should handle empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('should handle single value', () => {
    expect(mean([42])).toBe(42);
  });

  it('should handle negative numbers', () => {
    expect(mean([-5, -3, -1])).toBe(-3);
  });

  it('should handle decimals', () => {
    expect(mean([1.5, 2.5, 3.5])).toBeCloseTo(2.5);
  });

  it('should handle large datasets', () => {
    const values = Array.from({ length: 1000 }, (_, i) => i + 1);
    expect(mean(values)).toBe(500.5);
  });
});

describe('Statistical Utilities - median()', () => {
  it('should calculate median of odd-length array', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it('should calculate median of even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('should handle empty array', () => {
    expect(median([])).toBe(0);
  });

  it('should handle single value', () => {
    expect(median([42])).toBe(42);
  });

  it('should handle unsorted arrays', () => {
    expect(median([5, 1, 3, 2, 4])).toBe(3);
  });

  it('should handle negative numbers', () => {
    expect(median([-5, -3, -1, 0, 1])).toBe(-1);
  });

  it('should not mutate original array', () => {
    const values = [5, 1, 3];
    median(values);
    expect(values).toEqual([5, 1, 3]);
  });
});

describe('Statistical Utilities - stdDev()', () => {
  it('should calculate standard deviation', () => {
    const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2, 0);
  });

  it('should return 0 for single value', () => {
    expect(stdDev([5])).toBe(0);
  });

  it('should return 0 for identical values', () => {
    expect(stdDev([5, 5, 5, 5])).toBe(0);
  });

  it('should handle empty array', () => {
    expect(stdDev([])).toBe(0);
  });

  it('should handle negative numbers', () => {
    const result = stdDev([-2, -1, 0, 1, 2]);
    expect(result).toBeGreaterThan(0);
  });
});

describe('Statistical Utilities - zScore()', () => {
  it('should calculate z-score', () => {
    const z = zScore(85, 80, 5);
    expect(z).toBe(1);
  });

  it('should return 0 for value at mean', () => {
    expect(zScore(50, 50, 10)).toBe(0);
  });

  it('should return negative z-score for below mean', () => {
    const z = zScore(70, 80, 5);
    expect(z).toBe(-2);
  });

  it('should return 0 when stdDev is 0', () => {
    expect(zScore(100, 50, 0)).toBe(0);
  });

  it('should handle decimals', () => {
    const z = zScore(87.5, 80, 5);
    expect(z).toBeCloseTo(1.5);
  });
});

describe('Statistical Utilities - calculateSummary()', () => {
  it('should calculate full statistical summary', () => {
    const summary = calculateSummary([1, 2, 3, 4, 5]);
    expect(summary.mean).toBe(3);
    expect(summary.median).toBe(3);
    expect(summary.min).toBe(1);
    expect(summary.max).toBe(5);
    expect(summary.count).toBe(5);
    expect(summary.stdDev).toBeGreaterThan(0);
  });

  it('should handle empty array', () => {
    const summary = calculateSummary([]);
    expect(summary.mean).toBe(0);
    expect(summary.median).toBe(0);
    expect(summary.stdDev).toBe(0);
    expect(summary.min).toBe(0);
    expect(summary.max).toBe(0);
    expect(summary.count).toBe(0);
  });

  it('should handle single value', () => {
    const summary = calculateSummary([42]);
    expect(summary.mean).toBe(42);
    expect(summary.median).toBe(42);
    expect(summary.min).toBe(42);
    expect(summary.max).toBe(42);
    expect(summary.count).toBe(1);
  });
});

describe('Statistical Utilities - detectOutliers()', () => {
  it('should detect high outliers with default threshold', () => {
    const values = [1, 2, 3, 4, 5, 100];
    const outliers = detectOutliers(values);
    expect(outliers).toContain(5); // Index of 100
  });

  it('should detect low outliers', () => {
    const values = [50, 51, 52, 53, 54, 1];
    const outliers = detectOutliers(values);
    expect(outliers).toContain(5); // Index of 1
  });

  it('should accept custom threshold', () => {
    const values = [1, 2, 3, 4, 5, 10];
    const outliers = detectOutliers(values, 1.5);
    expect(outliers.length).toBeGreaterThan(0);
  });

  it('should return empty array for uniform data', () => {
    const values = [5, 5, 5, 5, 5];
    const outliers = detectOutliers(values);
    expect(outliers).toEqual([]);
  });

  it('should return empty array for small datasets', () => {
    expect(detectOutliers([1, 2])).toEqual([]);
  });

  it('should handle empty array', () => {
    expect(detectOutliers([])).toEqual([]);
  });
});

describe('Statistical Utilities - categorizeValue()', () => {
  it('should categorize normal values', () => {
    expect(categorizeValue(50, 50, 10)).toBe('normal');
  });

  it('should categorize high values', () => {
    const result = categorizeValue(71, 50, 10); // z > 2
    expect(result).toBe('high');
  });

  it('should categorize very high values', () => {
    const result = categorizeValue(81, 50, 10); // z > 3
    expect(result).toBe('very_high');
  });

  it('should categorize low values', () => {
    const result = categorizeValue(29, 50, 10); // z < -2
    expect(result).toBe('low');
  });

  it('should categorize very low values', () => {
    const result = categorizeValue(19, 50, 10); // z < -3
    expect(result).toBe('very_low');
  });

  it('should return normal when stdDev is 0', () => {
    expect(categorizeValue(100, 50, 0)).toBe('normal');
  });

  it('should handle edge case at boundary', () => {
    const result = categorizeValue(70.1, 50, 10); // z slightly > 2
    expect(result).toBe('high');
  });
});

describe('Statistical Utilities - percentileRank()', () => {
  it('should calculate percentile rank', () => {
    const values = [1, 2, 3, 4, 5];
    expect(percentileRank(3, values)).toBe(40); // 2 values below / 5 total = 40%
  });

  it('should return 0 for lowest value', () => {
    const values = [1, 2, 3, 4, 5];
    expect(percentileRank(1, values)).toBe(0);
  });

  it('should return 100 for highest value', () => {
    const values = [1, 2, 3, 4, 5];
    expect(percentileRank(6, values)).toBe(100);
  });

  it('should handle empty array', () => {
    expect(percentileRank(50, [])).toBe(0);
  });

  it('should handle duplicate values', () => {
    const values = [1, 2, 2, 2, 3];
    const rank = percentileRank(2, values);
    expect(rank).toBe(20); // Only 1 value below
  });
});

describe('Statistical Utilities - Integration', () => {
  it('should work together for complete analysis', () => {
    const cpuUsages = [10, 15, 20, 25, 30, 35, 90]; // One outlier

    // Calculate statistics
    const avg = mean(cpuUsages);
    const med = median(cpuUsages);
    const std = stdDev(cpuUsages);

    expect(avg).toBeGreaterThan(med); // Skewed by outlier
    expect(std).toBeGreaterThan(0);

    // Detect outlier
    const outliers = detectOutliers(cpuUsages);
    expect(outliers).toContain(6); // Index of 90

    // Categorize high value
    const category = categorizeValue(90, avg, std);
    expect(['high', 'very_high']).toContain(category);
  });

  it('should handle real-world node metrics', () => {
    const ramUsages = [45.2, 48.7, 52.1, 49.3, 50.5, 47.8, 51.2];

    const summary = calculateSummary(ramUsages);
    expect(summary.mean).toBeGreaterThan(45);
    expect(summary.mean).toBeLessThan(53);
    expect(summary.stdDev).toBeGreaterThan(0);
    expect(summary.stdDev).toBeLessThan(5);

    // All values should be normal (no outliers)
    ramUsages.forEach(usage => {
      const category = categorizeValue(usage, summary.mean, summary.stdDev);
      expect(category).toBe('normal');
    });
  });

  it('should identify network-wide anomalies', () => {
    // Simulated uptime values (seconds) - healthy nodes clustered around 3 days
    const uptimes = [
      259200, // 3 days
      266400, // 3.08 days
      273600, // 3.17 days
      280800, // 3.25 days
      288000, // 3.33 days
      295200, // 3.42 days
      60,     // 1 minute - anomaly!
    ];

    const avg = mean(uptimes);
    const std = stdDev(uptimes);

    // The anomaly should be categorized as low or very_low
    const anomalyCategory = categorizeValue(60, avg, std);
    expect(['low', 'very_low']).toContain(anomalyCategory);

    const normalCategory = categorizeValue(273600, avg, std);
    expect(normalCategory).toBe('normal');
  });
});
