/**
 * Alert Processor Tests
 *
 * Tests alert rule evaluation logic including metric extraction,
 * condition evaluation, and message generation.
 */

import { describe, it, expect } from 'vitest';
import type { AlertMetric, AlertOperator } from '@prisma/client';

// Metric extraction test data
interface LatestMetric {
  nodeId: number;
  address: string;
  cpuPercent: number | null;
  ramPercent: number | null;
  fileSize: bigint | null;
  uptime: number | null;
  isActive: boolean;
  packetsReceived: number | null;
  packetsSent: number | null;
}

/**
 * Get metric value from node metrics
 * (Extracted logic from alert-processor.ts)
 */
function getMetricValue(metric: AlertMetric, nodeMetric: LatestMetric): number | null {
  switch (metric) {
    case 'CPU_PERCENT':
      return nodeMetric.cpuPercent;
    case 'RAM_PERCENT':
      return nodeMetric.ramPercent;
    case 'STORAGE_SIZE':
      return nodeMetric.fileSize ? Number(nodeMetric.fileSize) : null;
    case 'UPTIME':
      return nodeMetric.uptime;
    case 'NODE_STATUS':
      return nodeMetric.isActive ? 1 : 0;
    case 'PACKETS_RECEIVED':
      return nodeMetric.packetsReceived;
    case 'PACKETS_SENT':
      return nodeMetric.packetsSent;
    default:
      return null;
  }
}

/**
 * Evaluate condition based on operator
 * (Extracted logic from alert-processor.ts)
 */
function evaluateCondition(
  value: number,
  operator: AlertOperator,
  threshold: number
): boolean {
  switch (operator) {
    case 'GT':
      return value > threshold;
    case 'GTE':
      return value >= threshold;
    case 'LT':
      return value < threshold;
    case 'LTE':
      return value <= threshold;
    case 'EQ':
      return value === threshold;
    case 'NEQ':
      return value !== threshold;
    default:
      return false;
  }
}

/**
 * Generate alert message
 * (Extracted logic from alert-processor.ts)
 */
function generateMessage(
  metric: AlertMetric,
  operator: AlertOperator,
  threshold: number,
  nodeAddress: string,
  value: number
): string {
  const metricLabels: Record<AlertMetric, string> = {
    CPU_PERCENT: 'CPU usage',
    RAM_PERCENT: 'RAM usage',
    STORAGE_SIZE: 'Storage size',
    UPTIME: 'Uptime',
    NODE_STATUS: 'Node status',
    PACKETS_RECEIVED: 'Packets received',
    PACKETS_SENT: 'Packets sent',
  };

  const operatorLabels: Record<AlertOperator, string> = {
    GT: 'exceeded',
    GTE: 'reached',
    LT: 'dropped below',
    LTE: 'at or below',
    EQ: 'equals',
    NEQ: 'changed from',
  };

  const metricLabel = metricLabels[metric];
  const operatorLabel = operatorLabels[operator];

  return `${metricLabel} on ${nodeAddress} has ${operatorLabel} ${threshold} (current: ${value.toFixed(2)})`;
}

describe('Metric Extraction', () => {
  const mockNodeMetric: LatestMetric = {
    nodeId: 1,
    address: '192.168.1.1:6000',
    cpuPercent: 45.5,
    ramPercent: 75.2,
    fileSize: BigInt(1000000),
    uptime: 86400, // 1 day in seconds
    isActive: true,
    packetsReceived: 5000,
    packetsSent: 3000,
  };

  it('should extract CPU percentage', () => {
    const value = getMetricValue('CPU_PERCENT', mockNodeMetric);
    expect(value).toBe(45.5);
  });

  it('should extract RAM percentage', () => {
    const value = getMetricValue('RAM_PERCENT', mockNodeMetric);
    expect(value).toBe(75.2);
  });

  it('should extract storage size', () => {
    const value = getMetricValue('STORAGE_SIZE', mockNodeMetric);
    expect(value).toBe(1000000);
  });

  it('should extract uptime', () => {
    const value = getMetricValue('UPTIME', mockNodeMetric);
    expect(value).toBe(86400);
  });

  it('should extract node status as 1 for active', () => {
    const value = getMetricValue('NODE_STATUS', mockNodeMetric);
    expect(value).toBe(1);
  });

  it('should extract node status as 0 for inactive', () => {
    const inactiveNode = { ...mockNodeMetric, isActive: false };
    const value = getMetricValue('NODE_STATUS', inactiveNode);
    expect(value).toBe(0);
  });

  it('should extract packets received', () => {
    const value = getMetricValue('PACKETS_RECEIVED', mockNodeMetric);
    expect(value).toBe(5000);
  });

  it('should extract packets sent', () => {
    const value = getMetricValue('PACKETS_SENT', mockNodeMetric);
    expect(value).toBe(3000);
  });

  it('should return null for missing metric', () => {
    const nodeWithNulls: LatestMetric = {
      nodeId: 1,
      address: '192.168.1.1:6000',
      cpuPercent: null,
      ramPercent: null,
      fileSize: null,
      uptime: null,
      isActive: false,
      packetsReceived: null,
      packetsSent: null,
    };

    expect(getMetricValue('CPU_PERCENT', nodeWithNulls)).toBeNull();
    expect(getMetricValue('RAM_PERCENT', nodeWithNulls)).toBeNull();
    expect(getMetricValue('UPTIME', nodeWithNulls)).toBeNull();
  });
});

describe('Condition Evaluation', () => {
  describe('Greater Than (GT)', () => {
    it('should return true when value exceeds threshold', () => {
      expect(evaluateCondition(90, 'GT', 80)).toBe(true);
    });

    it('should return false when value equals threshold', () => {
      expect(evaluateCondition(80, 'GT', 80)).toBe(false);
    });

    it('should return false when value is below threshold', () => {
      expect(evaluateCondition(70, 'GT', 80)).toBe(false);
    });
  });

  describe('Greater Than or Equal (GTE)', () => {
    it('should return true when value exceeds threshold', () => {
      expect(evaluateCondition(90, 'GTE', 80)).toBe(true);
    });

    it('should return true when value equals threshold', () => {
      expect(evaluateCondition(80, 'GTE', 80)).toBe(true);
    });

    it('should return false when value is below threshold', () => {
      expect(evaluateCondition(70, 'GTE', 80)).toBe(false);
    });
  });

  describe('Less Than (LT)', () => {
    it('should return true when value is below threshold', () => {
      expect(evaluateCondition(70, 'LT', 80)).toBe(true);
    });

    it('should return false when value equals threshold', () => {
      expect(evaluateCondition(80, 'LT', 80)).toBe(false);
    });

    it('should return false when value exceeds threshold', () => {
      expect(evaluateCondition(90, 'LT', 80)).toBe(false);
    });
  });

  describe('Less Than or Equal (LTE)', () => {
    it('should return true when value is below threshold', () => {
      expect(evaluateCondition(70, 'LTE', 80)).toBe(true);
    });

    it('should return true when value equals threshold', () => {
      expect(evaluateCondition(80, 'LTE', 80)).toBe(true);
    });

    it('should return false when value exceeds threshold', () => {
      expect(evaluateCondition(90, 'LTE', 80)).toBe(false);
    });
  });

  describe('Equal (EQ)', () => {
    it('should return true when values match exactly', () => {
      expect(evaluateCondition(80, 'EQ', 80)).toBe(true);
    });

    it('should return false when values do not match', () => {
      expect(evaluateCondition(80, 'EQ', 90)).toBe(false);
    });

    it('should handle floating point comparison', () => {
      expect(evaluateCondition(45.5, 'EQ', 45.5)).toBe(true);
    });
  });

  describe('Not Equal (NEQ)', () => {
    it('should return true when values differ', () => {
      expect(evaluateCondition(80, 'NEQ', 90)).toBe(true);
    });

    it('should return false when values match', () => {
      expect(evaluateCondition(80, 'NEQ', 80)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero threshold', () => {
      expect(evaluateCondition(0, 'GT', 0)).toBe(false);
      expect(evaluateCondition(1, 'GT', 0)).toBe(true);
      expect(evaluateCondition(0, 'EQ', 0)).toBe(true);
    });

    it('should handle negative values', () => {
      expect(evaluateCondition(-10, 'LT', 0)).toBe(true);
      expect(evaluateCondition(-10, 'GT', -20)).toBe(true);
    });

    it('should handle decimal values', () => {
      expect(evaluateCondition(45.67, 'GT', 45.66)).toBe(true);
      expect(evaluateCondition(45.67, 'LT', 45.68)).toBe(true);
    });
  });
});

describe('Alert Message Generation', () => {
  it('should generate message for CPU alert', () => {
    const message = generateMessage('CPU_PERCENT', 'GT', 80, '192.168.1.1:6000', 92.5);
    expect(message).toContain('CPU usage');
    expect(message).toContain('192.168.1.1:6000');
    expect(message).toContain('exceeded');
    expect(message).toContain('80');
    expect(message).toContain('92.50');
  });

  it('should generate message for RAM alert', () => {
    const message = generateMessage('RAM_PERCENT', 'GTE', 90, '10.0.0.1:6000', 91.2);
    expect(message).toContain('RAM usage');
    expect(message).toContain('10.0.0.1:6000');
    expect(message).toContain('reached');
    expect(message).toContain('90');
    expect(message).toContain('91.20');
  });

  it('should generate message for storage alert', () => {
    const message = generateMessage('STORAGE_SIZE', 'LT', 1000000, '172.16.0.1:6000', 500000);
    expect(message).toContain('Storage size');
    expect(message).toContain('dropped below');
  });

  it('should generate message for uptime alert', () => {
    const message = generateMessage('UPTIME', 'LT', 3600, '192.168.1.1:6000', 1800);
    expect(message).toContain('Uptime');
    expect(message).toContain('dropped below');
    expect(message).toContain('3600');
  });

  it('should generate message for node status alert', () => {
    const message = generateMessage('NODE_STATUS', 'EQ', 0, '192.168.1.1:6000', 0);
    expect(message).toContain('Node status');
    expect(message).toContain('equals');
  });

  it('should generate message for packets received alert', () => {
    const message = generateMessage('PACKETS_RECEIVED', 'GT', 10000, '192.168.1.1:6000', 15000);
    expect(message).toContain('Packets received');
    expect(message).toContain('exceeded');
  });

  it('should format decimal values with 2 decimal places', () => {
    const message = generateMessage('CPU_PERCENT', 'GT', 80, '192.168.1.1:6000', 92.567);
    expect(message).toContain('92.57');
  });
});

describe('Alert Rule Evaluation Integration', () => {
  const mockNodeMetric: LatestMetric = {
    nodeId: 1,
    address: '192.168.1.1:6000',
    cpuPercent: 92.5,
    ramPercent: 85.3,
    fileSize: BigInt(500000),
    uptime: 1800,
    isActive: true,
    packetsReceived: 15000,
    packetsSent: 12000,
  };

  it('should trigger alert when CPU exceeds threshold', () => {
    const value = getMetricValue('CPU_PERCENT', mockNodeMetric);
    const conditionMet = value !== null && evaluateCondition(value, 'GT', 80);
    expect(conditionMet).toBe(true);
  });

  it('should not trigger alert when CPU is below threshold', () => {
    const value = getMetricValue('CPU_PERCENT', mockNodeMetric);
    const conditionMet = value !== null && evaluateCondition(value, 'GT', 95);
    expect(conditionMet).toBe(false);
  });

  it('should trigger alert when RAM reaches threshold', () => {
    const value = getMetricValue('RAM_PERCENT', mockNodeMetric);
    const conditionMet = value !== null && evaluateCondition(value, 'GTE', 85);
    expect(conditionMet).toBe(true);
  });

  it('should trigger alert when storage is low', () => {
    const value = getMetricValue('STORAGE_SIZE', mockNodeMetric);
    const conditionMet = value !== null && evaluateCondition(value, 'LT', 1000000);
    expect(conditionMet).toBe(true);
  });

  it('should handle null values gracefully', () => {
    const nodeWithNull: LatestMetric = {
      ...mockNodeMetric,
      cpuPercent: null,
    };

    const value = getMetricValue('CPU_PERCENT', nodeWithNull);
    expect(value).toBeNull();

    // Should not evaluate condition when value is null
    const shouldSkip = value === null;
    expect(shouldSkip).toBe(true);
  });

  it('should create complete alert flow', () => {
    // Extract metric
    const value = getMetricValue('CPU_PERCENT', mockNodeMetric);
    expect(value).toBe(92.5);

    // Evaluate condition
    const threshold = 80;
    const conditionMet = value !== null && evaluateCondition(value, 'GT', threshold);
    expect(conditionMet).toBe(true);

    // Generate message
    if (conditionMet && value !== null) {
      const message = generateMessage(
        'CPU_PERCENT',
        'GT',
        threshold,
        mockNodeMetric.address,
        value
      );

      expect(message).toContain('CPU usage');
      expect(message).toContain('192.168.1.1:6000');
      expect(message).toContain('exceeded');
      expect(message).toContain('80');
      expect(message).toContain('92.50');
    }
  });
});
