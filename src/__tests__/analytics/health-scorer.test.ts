/**
 * Health Scorer Tests
 *
 * Tests health score calculations for nodes including weighted scoring,
 * component scores, grade assignment, and network health aggregation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNodeHealth,
  calculateNetworkHealth,
  HEALTH_WEIGHTS,
  HEALTH_THRESHOLDS,
  type NodeMetrics,
  type NetworkStats,
  type HealthScore,
} from '@/lib/analytics/health-scorer';

describe('Health Score Weights', () => {
  it('should have correct weight distribution', () => {
    expect(HEALTH_WEIGHTS.uptime).toBe(0.35);
    expect(HEALTH_WEIGHTS.cpu).toBe(0.20);
    expect(HEALTH_WEIGHTS.ram).toBe(0.20);
    expect(HEALTH_WEIGHTS.connectivity).toBe(0.15);
    expect(HEALTH_WEIGHTS.version).toBe(0.10);
  });

  it('should sum to 1.0', () => {
    const sum = Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('should prioritize uptime', () => {
    expect(HEALTH_WEIGHTS.uptime).toBeGreaterThan(HEALTH_WEIGHTS.cpu);
    expect(HEALTH_WEIGHTS.uptime).toBeGreaterThan(HEALTH_WEIGHTS.ram);
    expect(HEALTH_WEIGHTS.uptime).toBeGreaterThan(HEALTH_WEIGHTS.connectivity);
    expect(HEALTH_WEIGHTS.uptime).toBeGreaterThan(HEALTH_WEIGHTS.version);
  });
});

describe('Health Thresholds', () => {
  it('should have uptime thresholds', () => {
    expect(HEALTH_THRESHOLDS.uptime.excellent).toBe(7 * 24 * 60 * 60); // 7 days
    expect(HEALTH_THRESHOLDS.uptime.good).toBe(24 * 60 * 60); // 1 day
    expect(HEALTH_THRESHOLDS.uptime.fair).toBe(60 * 60); // 1 hour
  });

  it('should have CPU thresholds', () => {
    expect(HEALTH_THRESHOLDS.cpu.excellent).toBe(20);
    expect(HEALTH_THRESHOLDS.cpu.good).toBe(50);
    expect(HEALTH_THRESHOLDS.cpu.fair).toBe(80);
  });

  it('should have RAM thresholds', () => {
    expect(HEALTH_THRESHOLDS.ram.excellent).toBe(40);
    expect(HEALTH_THRESHOLDS.ram.good).toBe(70);
    expect(HEALTH_THRESHOLDS.ram.fair).toBe(90);
  });

  it('should have connectivity thresholds', () => {
    expect(HEALTH_THRESHOLDS.connectivity.excellent).toBe(20);
    expect(HEALTH_THRESHOLDS.connectivity.good).toBe(10);
    expect(HEALTH_THRESHOLDS.connectivity.fair).toBe(5);
  });
});

describe('calculateNodeHealth() - Healthy Node', () => {
  const mockNetworkStats: NetworkStats = {
    latestVersion: '0.6.0',
    avgCpu: 50,
    avgRam: 60,
    avgUptime: 86400,
    cpuStdDev: 10,
    ramStdDev: 15,
    uptimeStdDev: 10000,
  };

  it('should give high score to excellent node', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 15,       // Excellent
      ramPercent: 35,       // Excellent
      uptime: 604800,       // 7 days - Excellent
      peerCount: 25,        // Excellent
      version: '0.6.0',     // Latest
      isActive: true,
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);

    expect(health.overall).toBeGreaterThan(90);
    expect(health.grade).toBe('A');
    expect(health.components.uptime).toBe(100);
    expect(health.components.cpu).toBe(100);
    expect(health.components.ram).toBe(100);
    expect(health.components.connectivity).toBe(100);
    expect(health.components.version).toBe(100);
  });

  it('should calculate realistic healthy node', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 35,       // Good
      ramPercent: 55,       // Good
      uptime: 172800,       // 2 days - Good
      peerCount: 15,        // Good
      version: '0.6.0',     // Latest
      isActive: true,
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);

    expect(health.overall).toBeGreaterThan(70);
    expect(health.overall).toBeLessThan(100);
    expect(['A', 'B', 'C']).toContain(health.grade);
  });
});

describe('calculateNodeHealth() - Inactive Node', () => {
  const mockNetworkStats: NetworkStats = {
    latestVersion: '0.6.0',
    avgCpu: 50,
    avgRam: 60,
    avgUptime: 86400,
    cpuStdDev: 10,
    ramStdDev: 15,
    uptimeStdDev: 10000,
  };

  it('should give F grade to offline node', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 0,
      ramPercent: 0,
      uptime: 0,
      isActive: false, // Offline
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);

    expect(health.overall).toBe(0);
    expect(health.grade).toBe('F');
    expect(health.components.uptime).toBe(0);
    expect(health.components.cpu).toBe(0);
    expect(health.components.ram).toBe(0);
    expect(health.details.uptimeStatus).toBe('Offline');
  });
});

describe('calculateNodeHealth() - Component Scores', () => {
  const mockNetworkStats: NetworkStats = {
    latestVersion: '0.6.0',
    avgCpu: 50,
    avgRam: 60,
    avgUptime: 86400,
    cpuStdDev: 10,
    ramStdDev: 15,
    uptimeStdDev: 10000,
  };

  it('should score uptime component correctly', () => {
    const testCases = [
      { uptime: 604800, expectedMin: 95 },   // 7 days - Excellent
      { uptime: 86400, expectedMin: 75 },    // 1 day - Good
      { uptime: 3600, expectedMin: 50 },     // 1 hour - Fair
      { uptime: 600, expectedMin: 0 },       // 10 minutes - Poor
    ];

    testCases.forEach(({ uptime, expectedMin }) => {
      const metrics: NodeMetrics = {
        cpuPercent: 50,
        ramPercent: 50,
        uptime,
        peerCount: 10,
        version: '0.6.0',
        isActive: true,
      };

      const health = calculateNodeHealth(metrics, mockNetworkStats);
      expect(health.components.uptime).toBeGreaterThanOrEqual(expectedMin);
    });
  });

  it('should score CPU component correctly (lower is better)', () => {
    const testCases = [
      { cpu: 15, expectedMin: 95 },   // Excellent
      { cpu: 40, expectedMin: 75 },   // Good
      { cpu: 70, expectedMin: 50 },   // Fair
      { cpu: 95, expectedMin: 0 },    // Poor
    ];

    testCases.forEach(({ cpu, expectedMin }) => {
      const metrics: NodeMetrics = {
        cpuPercent: cpu,
        ramPercent: 50,
        uptime: 86400,
        peerCount: 10,
        version: '0.6.0',
        isActive: true,
      };

      const health = calculateNodeHealth(metrics, mockNetworkStats);
      expect(health.components.cpu).toBeGreaterThanOrEqual(expectedMin);
    });
  });

  it('should score RAM component correctly (lower is better)', () => {
    const testCases = [
      { ram: 30, expectedMin: 95 },   // Excellent
      { ram: 60, expectedMin: 75 },   // Good
      { ram: 85, expectedMin: 50 },   // Fair
      { ram: 98, expectedMin: 0 },    // Poor
    ];

    testCases.forEach(({ ram, expectedMin }) => {
      const metrics: NodeMetrics = {
        cpuPercent: 50,
        ramPercent: ram,
        uptime: 86400,
        peerCount: 10,
        version: '0.6.0',
        isActive: true,
      };

      const health = calculateNodeHealth(metrics, mockNetworkStats);
      expect(health.components.ram).toBeGreaterThanOrEqual(expectedMin);
    });
  });

  it('should score connectivity component correctly', () => {
    const testCases = [
      { peers: 25, expectedMin: 95 },       // Excellent
      { peers: 15, expectedMin: 75 },       // Good
      { peers: 7, expectedMin: 50 },        // Fair
      { peers: 2, expectedMin: 0 },         // Poor
      { peers: undefined, expected: 50 },   // Unknown
    ];

    testCases.forEach(({ peers, expectedMin, expected }) => {
      const metrics: NodeMetrics = {
        cpuPercent: 50,
        ramPercent: 50,
        uptime: 86400,
        peerCount: peers,
        version: '0.6.0',
        isActive: true,
      };

      const health = calculateNodeHealth(metrics, mockNetworkStats);
      if (expected !== undefined) {
        expect(health.components.connectivity).toBe(expected);
      } else {
        expect(health.components.connectivity).toBeGreaterThanOrEqual(expectedMin!);
      }
    });
  });

  it('should score version component correctly', () => {
    const testCases = [
      { version: '0.6.0', latest: '0.6.0', expected: 100 },     // Up to date
      { version: '0.5.9', latest: '0.6.0', expectedMin: 60 },   // 1 minor behind
      { version: '0.4.0', latest: '0.6.0', expectedMin: 20 },   // 2 minor behind
      { version: undefined, latest: '0.6.0', expected: 50 },    // Unknown
    ];

    testCases.forEach(({ version, latest, expected, expectedMin }) => {
      const metrics: NodeMetrics = {
        cpuPercent: 50,
        ramPercent: 50,
        uptime: 86400,
        peerCount: 10,
        version,
        isActive: true,
      };

      const networkStats = { ...mockNetworkStats, latestVersion: latest };
      const health = calculateNodeHealth(metrics, networkStats);

      if (expected !== undefined) {
        expect(health.components.version).toBe(expected);
      } else {
        expect(health.components.version).toBeGreaterThanOrEqual(expectedMin!);
      }
    });
  });
});

describe('calculateNodeHealth() - Grade Assignment', () => {
  const mockNetworkStats: NetworkStats = {
    latestVersion: '0.6.0',
    avgCpu: 50,
    avgRam: 60,
    avgUptime: 86400,
    cpuStdDev: 10,
    ramStdDev: 15,
    uptimeStdDev: 10000,
  };

  it('should assign grade A for score >= 90', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 10,
      ramPercent: 30,
      uptime: 604800,
      peerCount: 25,
      version: '0.6.0',
      isActive: true,
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);
    expect(health.overall).toBeGreaterThanOrEqual(90);
    expect(health.grade).toBe('A');
  });

  it('should assign grade F for score < 60', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 95,
      ramPercent: 95,
      uptime: 300,  // 5 minutes
      peerCount: 1,
      version: '0.3.0',
      isActive: true,
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);
    expect(health.overall).toBeLessThan(60);
    expect(health.grade).toBe('F');
  });
});

describe('calculateNodeHealth() - Outlier Detection', () => {
  const mockNetworkStats: NetworkStats = {
    latestVersion: '0.6.0',
    avgCpu: 50,
    avgRam: 60,
    avgUptime: 86400,
    cpuStdDev: 10,
    ramStdDev: 15,
    uptimeStdDev: 10000,
  };

  it('should detect high CPU outlier', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 90,  // Much higher than avg 50, outside 2 stdDev
      ramPercent: 60,
      uptime: 86400,
      peerCount: 10,
      version: '0.6.0',
      isActive: true,
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);
    expect(['high', 'very_high']).toContain(health.outliers.cpu);
  });

  it('should detect low uptime outlier', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 50,
      ramPercent: 60,
      uptime: 3600,  // Much lower than avg 86400
      peerCount: 10,
      version: '0.6.0',
      isActive: true,
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);
    expect(['low', 'very_low']).toContain(health.outliers.uptime);
  });

  it('should mark normal values as normal', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 50,  // At average
      ramPercent: 60,  // At average
      uptime: 86400,   // At average
      peerCount: 10,
      version: '0.6.0',
      isActive: true,
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);
    expect(health.outliers.cpu).toBe('normal');
    expect(health.outliers.ram).toBe('normal');
    expect(health.outliers.uptime).toBe('normal');
  });
});

describe('calculateNetworkHealth()', () => {
  it('should calculate network-wide health summary', () => {
    const nodeScores = [
      { overall: 95, grade: 'A' as const, components: { uptime: 100, cpu: 90, ram: 95, connectivity: 100, version: 100 }, details: {}, outliers: {} },
      { overall: 85, grade: 'B' as const, components: { uptime: 80, cpu: 85, ram: 90, connectivity: 85, version: 90 }, details: {}, outliers: {} },
      { overall: 75, grade: 'C' as const, components: { uptime: 70, cpu: 75, ram: 80, connectivity: 75, version: 80 }, details: {}, outliers: {} },
      { overall: 65, grade: 'D' as const, components: { uptime: 60, cpu: 65, ram: 70, connectivity: 65, version: 70 }, details: {}, outliers: {} },
      { overall: 55, grade: 'F' as const, components: { uptime: 50, cpu: 55, ram: 60, connectivity: 55, version: 60 }, details: {}, outliers: {} },
    ] as unknown as HealthScore[];

    const networkHealth = calculateNetworkHealth(nodeScores);

    expect(networkHealth.avgScore).toBe(75);
    expect(networkHealth.grade).toBe('C');
    expect(networkHealth.distribution.A).toBe(1);
    expect(networkHealth.distribution.B).toBe(1);
    expect(networkHealth.distribution.C).toBe(1);
    expect(networkHealth.distribution.D).toBe(1);
    expect(networkHealth.distribution.F).toBe(1);
    expect(networkHealth.healthyPercentage).toBe(60); // A+B+C = 3/5 = 60%
  });

  it('should handle empty node array', () => {
    const networkHealth = calculateNetworkHealth([]);

    expect(networkHealth.avgScore).toBe(0);
    expect(networkHealth.grade).toBe('F');
    expect(networkHealth.healthyPercentage).toBe(0);
  });

  it('should calculate healthy percentage correctly', () => {
    const nodeScores = [
      { overall: 95, grade: 'A' as const, components: {}, details: {}, outliers: {} },
      { overall: 85, grade: 'B' as const, components: {}, details: {}, outliers: {} },
      { overall: 75, grade: 'C' as const, components: {}, details: {}, outliers: {} },
      { overall: 85, grade: 'B' as const, components: {}, details: {}, outliers: {} },
    ] as unknown as HealthScore[];

    const networkHealth = calculateNetworkHealth(nodeScores);

    expect(networkHealth.healthyPercentage).toBe(100); // All A, B, C
  });

  it('should handle all failing nodes', () => {
    const nodeScores = [
      { overall: 55, grade: 'F' as const, components: {}, details: {}, outliers: {} },
      { overall: 45, grade: 'F' as const, components: {}, details: {}, outliers: {} },
      { overall: 50, grade: 'F' as const, components: {}, details: {}, outliers: {} },
    ] as unknown as HealthScore[];

    const networkHealth = calculateNetworkHealth(nodeScores);

    expect(networkHealth.healthyPercentage).toBe(0);
    expect(networkHealth.grade).toBe('F');
  });
});

describe('calculateNodeHealth() - Status Messages', () => {
  const mockNetworkStats: NetworkStats = {
    latestVersion: '0.6.0',
    avgCpu: 50,
    avgRam: 60,
    avgUptime: 86400,
    cpuStdDev: 10,
    ramStdDev: 15,
    uptimeStdDev: 10000,
  };

  it('should include descriptive status messages', () => {
    const metrics: NodeMetrics = {
      cpuPercent: 15,
      ramPercent: 35,
      uptime: 604800,
      peerCount: 25,
      version: '0.6.0',
      isActive: true,
    };

    const health = calculateNodeHealth(metrics, mockNetworkStats);

    expect(health.details.uptimeStatus).toContain('Excellent');
    expect(health.details.cpuStatus).toContain('Excellent');
    expect(health.details.ramStatus).toContain('Excellent');
    expect(health.details.connectivityStatus).toContain('25');
    expect(health.details.versionStatus).toContain('Up to date');
  });
});
