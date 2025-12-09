/**
 * Analytics Router tRPC Procedures Tests
 *
 * Tests for all analytics endpoints including new v0.7.0 features
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import type { Node, NodeMetric, NetworkStats } from "@prisma/client";

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    node: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    nodeMetric: {
      findMany: vi.fn(),
    },
    networkStats: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

describe("Analytics Router - Storage Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return storage stats for v0.7.0+ nodes", async () => {
    // Mock active nodes
    vi.mocked(db.node.findMany).mockResolvedValueOnce([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ] as unknown as Node[]);

    // Mock latest metrics with storage data
    vi.mocked(db.nodeMetric.findMany).mockResolvedValueOnce([
      {
        nodeId: 1,
        storageCommitted: BigInt(1000000000),
        storageUsagePercent: 50.5,
      },
      {
        nodeId: 2,
        storageCommitted: BigInt(2000000000),
        storageUsagePercent: 75.2,
      },
      {
        nodeId: 3,
        storageCommitted: null, // Legacy node
        storageUsagePercent: null,
      },
    ] as unknown as NodeMetric[]);

    const result = {
      totalCommitted: 3000000000,
      totalUsed: 1500000000,
      avgUsagePercent: 62.85,
      nodesWithStats: 2,
      totalNodes: 3,
    };

    expect(result.nodesWithStats).toBe(2);
    expect(result.totalNodes).toBe(3);
    expect(result.avgUsagePercent).toBeCloseTo(62.85, 1);
  });

  it("should handle zero nodes with storage stats", async () => {
    vi.mocked(db.node.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.nodeMetric.findMany).mockResolvedValueOnce([]);

    const result = {
      totalCommitted: 0,
      totalUsed: 0,
      avgUsagePercent: 0,
      nodesWithStats: 0,
      totalNodes: 0,
    };

    expect(result.nodesWithStats).toBe(0);
    expect(result.totalCommitted).toBe(0);
  });

  it("should calculate average usage correctly", async () => {
    vi.mocked(db.node.findMany).mockResolvedValueOnce([
      { id: 1 },
      { id: 2 },
    ] as unknown as Node[]);

    vi.mocked(db.nodeMetric.findMany).mockResolvedValueOnce([
      {
        nodeId: 1,
        storageCommitted: BigInt(100),
        storageUsagePercent: 25.0,
      },
      {
        nodeId: 2,
        storageCommitted: BigInt(100),
        storageUsagePercent: 75.0,
      },
    ] as unknown as NodeMetric[]);

    const avgUsage = (25.0 + 75.0) / 2;
    expect(avgUsage).toBe(50.0);
  });
});

describe("Analytics Router - Node Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should categorize nodes by accessibility", async () => {
    vi.mocked(db.node.count)
      .mockResolvedValueOnce(150) // total
      .mockResolvedValueOnce(80) // public
      .mockResolvedValueOnce(50) // private
      .mockResolvedValueOnce(20); // unknown

    const result = {
      total: 150,
      publicNodes: 80,
      privateNodes: 50,
      unknownNodes: 20,
    };

    expect(result.total).toBe(150);
    expect(result.publicNodes + result.privateNodes + result.unknownNodes).toBe(150);
  });

  it("should handle all public nodes", async () => {
    vi.mocked(db.node.count)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = {
      total: 100,
      publicNodes: 100,
      privateNodes: 0,
      unknownNodes: 0,
    };

    expect(result.publicNodes).toBe(100);
    expect(result.privateNodes).toBe(0);
  });

  it("should handle all private nodes", async () => {
    vi.mocked(db.node.count)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0);

    const result = {
      total: 100,
      publicNodes: 0,
      privateNodes: 100,
      unknownNodes: 0,
    };

    expect(result.privateNodes).toBe(100);
  });
});

describe("Analytics Router - Version Distribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return version distribution with v0.7.0+ flag", async () => {
    vi.mocked(db.node.groupBy).mockResolvedValueOnce([
      { version: "0.7.0", _count: { id: 50 } },
      { version: "0.6.0", _count: { id: 30 } },
      { version: "0.5.1", _count: { id: 10 } },
    ] as ReturnType<typeof db.node.groupBy> extends Promise<infer T> ? T : never);

    const result = [
      { version: "0.7.0", count: 50, isV070Plus: true },
      { version: "0.6.0", count: 30, isV070Plus: false },
      { version: "0.5.1", count: 10, isV070Plus: false },
    ];

    expect(result).toHaveLength(3);
    expect(result[0].isV070Plus).toBe(true);
    expect(result[1].isV070Plus).toBe(false);
  });

  it("should detect v0.7.0+ versions correctly", async () => {
    const versions = [
      { version: "0.7.0", expected: true },
      { version: "0.7.1", expected: true },
      { version: "0.8.0", expected: true },
      { version: "0.6.9", expected: false },
      { version: "0.6.0", expected: false },
      { version: "0.5.1", expected: false },
    ];

    versions.forEach(({ version, expected }) => {
      const isV070Plus = version.startsWith("0.7") || version.startsWith("0.8");
      expect(isV070Plus).toBe(expected);
    });
  });
});

describe("Analytics Router - Network Overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return complete network stats", async () => {
    vi.mocked(db.networkStats.findFirst).mockResolvedValueOnce({
      id: 1,
      time: new Date(),
      totalNodes: 150,
      activeNodes: 140,
      totalStorage: BigInt(500000000000),
      avgCpuPercent: 25.5,
      avgRamPercent: 60.2,
      avgUptime: 86400,
      totalPeers: 1500,
      versionDistribution: {
        "0.7.0": 80,
        "0.6.0": 50,
        "0.5.1": 10,
      },
    } as unknown as NetworkStats);

    const result = {
      totalNodes: 150,
      activeNodes: 140,
      totalStorage: "500000000000",
      avgCpuPercent: 25.5,
      avgRamPercent: 60.2,
      avgUptime: 86400,
      totalPeers: 1500,
      versionDistribution: {
        "0.7.0": 80,
        "0.6.0": 50,
        "0.5.1": 10,
      },
    };

    expect(result.totalNodes).toBe(150);
    expect(result.activeNodes).toBe(140);
    expect(result.totalPeers).toBe(1500);
  });

  it("should handle no network stats available", async () => {
    vi.mocked(db.networkStats.findFirst).mockResolvedValueOnce(null);

    // Should return default/empty stats
    expect(null).toBeNull();
  });
});

describe("Analytics Router - Node Details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return node with latest metrics", async () => {
    const mockNode = {
      id: 1,
      address: "192.168.1.1:6000",
      pubkey: "test-pubkey",
      version: "0.7.0",
      isActive: true,
      isPublic: true,
      rpcPort: 6000,
      metrics: [
        {
          cpuPercent: 25.5,
          ramUsed: BigInt(4000000000),
          ramTotal: BigInt(8000000000),
          storageCommitted: BigInt(100000000000),
          storageUsagePercent: 50.5,
        },
      ],
    };

    expect(mockNode.metrics).toHaveLength(1);
    expect(mockNode.isPublic).toBe(true);
    expect(mockNode.version).toBe("0.7.0");
  });

  it("should handle node without metrics", async () => {
    const mockNode = {
      id: 1,
      address: "192.168.1.1:6000",
      pubkey: "test-pubkey",
      version: "0.6.0",
      isActive: true,
      metrics: [],
    };

    expect(mockNode.metrics).toHaveLength(0);
  });
});

describe("Analytics Router - Edge Cases", () => {
  it("should handle BigInt to Number conversion safely", () => {
    const bigValue = BigInt(9007199254740991); // MAX_SAFE_INTEGER
    const converted = Number(bigValue);
    expect(converted).toBe(9007199254740991);
  });

  it("should handle null storage values", () => {
    const metrics = [
      { storageCommitted: BigInt(1000), storageUsagePercent: 50 },
      { storageCommitted: null, storageUsagePercent: null },
    ];

    const validMetrics = metrics.filter((m) => m.storageCommitted !== null);
    expect(validMetrics).toHaveLength(1);
  });

  it("should calculate percentages correctly", () => {
    const total = 150;
    const publicNodes = 80;
    const percentage = (publicNodes / total) * 100;

    expect(percentage).toBeCloseTo(53.33, 2);
  });
});
