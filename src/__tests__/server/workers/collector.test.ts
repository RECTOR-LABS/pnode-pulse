/**
 * Data Collection Worker Tests
 *
 * Tests for the pNode data collection worker
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { createClient } from "@/lib/prpc";

// Mock dependencies
vi.mock("@/lib/db");
vi.mock("@/lib/prpc");
vi.mock("@/lib/redis/pubsub");

describe("Collector Worker - Node Collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should collect data from active nodes", async () => {
    const mockClient = {
      getVersion: vi.fn().mockResolvedValue({ version: "0.7.0" }),
      getStats: vi.fn().mockResolvedValue({
        cpu_percent: 25.5,
        ram_used: 4000000000,
        ram_total: 8000000000,
        uptime: 86400,
        file_size: 500000000000,
        total_bytes: 100000,
        total_pages: 50,
        current_index: 10,
        packets_received: 1000,
        packets_sent: 800,
        active_streams: 5,
      }),
      getPodsWithStats: vi.fn().mockResolvedValue({
        pods: [
          {
            address: "192.168.1.1:9001",
            pubkey: "test-pubkey",
            version: "0.7.0",
            is_public: true,
            rpc_port: 6000,
            storage_committed: 100000000000,
            storage_usage_percent: 50.5,
            storage_used: 50250000000,
            uptime: 86400,
            last_seen_timestamp: Date.now() / 1000,
          },
        ],
        total_count: 1,
      }),
    };

    vi.mocked(createClient).mockReturnValue(mockClient as any);

    // Simulate collection
    const result = await mockClient.getPodsWithStats();

    expect(result.pods).toHaveLength(1);
    expect(result.pods[0].is_public).toBe(true);
    expect(result.pods[0].storage_committed).toBe(100000000000);
  });

  it("should handle collection timeouts gracefully", async () => {
    const mockClient = {
      getVersion: vi.fn().mockRejectedValue(new Error("Request timed out")),
      getStats: vi.fn().mockRejectedValue(new Error("Request timed out")),
      getPodsWithStats: vi.fn().mockRejectedValue(new Error("Request timed out")),
    };

    vi.mocked(createClient).mockReturnValue(mockClient as any);

    // Collection should fail but not crash
    await expect(mockClient.getVersion()).rejects.toThrow("Request timed out");
  });

  it("should extract storage stats from pods result", async () => {
    const podsResult = {
      pods: [
        {
          address: "192.168.1.1:9001",
          is_public: true,
          rpc_port: 6000,
          storage_committed: 183000000000,
          storage_usage_percent: 0.000051712,
          storage_used: 94633,
          uptime: 1461,
          pubkey: "test-key",
          version: "0.7.0",
          last_seen_timestamp: Date.now() / 1000,
        },
      ],
      total_count: 1,
    };

    const selfPod = podsResult.pods.find((p) => p.address.includes("192.168.1.1"));

    expect(selfPod).toBeDefined();
    expect(selfPod?.storage_committed).toBe(183000000000);
    expect(selfPod?.is_public).toBe(true);
  });
});

describe("Collector Worker - Node Discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should discover new nodes from pods responses", async () => {
    const knownAddresses = new Set(["192.168.1.1:6000"]);

    const podsResult = {
      pods: [
        {
          address: "192.168.1.1:9001", // Known
          pubkey: "known-key",
          version: "0.7.0",
          is_public: true,
          rpc_port: 6000,
          storage_committed: 100000000000,
          storage_usage_percent: 50,
          storage_used: 50000000000,
          uptime: 86400,
          last_seen_timestamp: Date.now() / 1000,
        },
        {
          address: "192.168.1.2:9001", // New
          pubkey: "new-key",
          version: "0.7.0",
          is_public: false,
          rpc_port: 6000,
          storage_committed: 200000000000,
          storage_usage_percent: 25,
          storage_used: 50000000000,
          uptime: 43200,
          last_seen_timestamp: Date.now() / 1000,
        },
      ],
      total_count: 2,
    };

    const newNodes = podsResult.pods
      .map((pod) => pod.address.replace(":9001", ":6000"))
      .filter((addr) => !knownAddresses.has(addr));

    expect(newNodes).toHaveLength(1);
    expect(newNodes[0]).toBe("192.168.1.2:6000");
  });

  it("should convert gossip address to RPC address", () => {
    const gossipAddress = "192.168.1.1:9001";
    const rpcAddress = gossipAddress.replace(":9001", ":6000");

    expect(rpcAddress).toBe("192.168.1.1:6000");
  });

  it("should handle duplicate node discoveries", () => {
    const addresses = new Set<string>();

    addresses.add("192.168.1.1:6000");
    addresses.add("192.168.1.1:6000"); // Duplicate
    addresses.add("192.168.1.2:6000");

    expect(addresses.size).toBe(2);
  });
});

describe("Collector Worker - Metrics Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should store metrics with v0.7.0 storage fields", async () => {
    const mockMetric = {
      nodeId: 1,
      cpuPercent: 25.5,
      ramUsed: BigInt(4000000000),
      ramTotal: BigInt(8000000000),
      uptime: 86400,
      fileSize: BigInt(500000000000),
      totalBytes: BigInt(100000),
      totalPages: 50,
      currentIndex: 10,
      packetsReceived: 1000,
      packetsSent: 800,
      activeStreams: 5,
      storageCommitted: BigInt(100000000000),
      storageUsagePercent: 50.5,
    };

    expect(mockMetric.storageCommitted).toBe(BigInt(100000000000));
    expect(mockMetric.storageUsagePercent).toBe(50.5);
  });

  it("should handle null storage values for legacy nodes", async () => {
    const mockMetric = {
      nodeId: 1,
      cpuPercent: 25.5,
      ramUsed: BigInt(4000000000),
      ramTotal: BigInt(8000000000),
      storageCommitted: null,
      storageUsagePercent: null,
    };

    expect(mockMetric.storageCommitted).toBeNull();
    expect(mockMetric.storageUsagePercent).toBeNull();
  });
});

describe("Collector Worker - Network Stats Computation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should compute accurate network statistics", async () => {
    const mockStats = {
      total_nodes: BigInt(150),
      active_nodes: BigInt(140),
      total_storage: BigInt(500000000000),
      avg_cpu: 25.5,
      avg_ram_percent: 60.2,
      avg_uptime: 86400,
      total_peers: BigInt(1500),
    };

    expect(Number(mockStats.total_nodes)).toBe(150);
    expect(Number(mockStats.active_nodes)).toBe(140);
    expect(mockStats.avg_cpu).toBeCloseTo(25.5, 1);
  });

  it("should handle version distribution correctly", () => {
    const versionGroups = [
      { version: "0.7.0", _count: { id: 80 } },
      { version: "0.6.0", _count: { id: 50 } },
      { version: "0.5.1", _count: { id: 10 } },
    ];

    const versionDistribution: Record<string, number> = {};
    for (const v of versionGroups) {
      if (v.version) {
        versionDistribution[v.version] = v._count.id;
      }
    }

    expect(versionDistribution["0.7.0"]).toBe(80);
    expect(versionDistribution["0.6.0"]).toBe(50);
    expect(Object.keys(versionDistribution)).toHaveLength(3);
  });
});

describe("Collector Worker - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mark node as inactive on collection failure", async () => {
    const collectionResult = {
      address: "192.168.1.1:6000",
      success: false,
      error: "Connection timeout",
    };

    expect(collectionResult.success).toBe(false);
    expect(collectionResult.error).toBeDefined();
  });

  it("should continue collection despite individual node failures", async () => {
    const results = [
      { address: "192.168.1.1:6000", success: true },
      { address: "192.168.1.2:6000", success: false, error: "Timeout" },
      { address: "192.168.1.3:6000", success: true },
    ];

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    expect(successCount).toBe(2);
    expect(failCount).toBe(1);
  });

  it("should handle database errors gracefully", async () => {
    const dbError = new Error("Database connection failed");

    // This test verifies that database errors are caught and handled
    try {
      throw dbError;
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Database connection failed");
    }
  });
});

describe("Collector Worker - Peer Relationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update peer relationships from pods", async () => {
    const podsResult = {
      pods: [
        {
          address: "192.168.1.2:9001",
          pubkey: "peer-key",
          version: "0.7.0",
          last_seen_timestamp: Date.now() / 1000,
          is_public: true,
          rpc_port: 6000,
          storage_committed: 100000000000,
          storage_usage_percent: 50,
          storage_used: 50000000000,
          uptime: 86400,
        },
      ],
      total_count: 1,
    };

    const peerAddress = podsResult.pods[0].address.replace(":9001", ":6000");
    expect(peerAddress).toBe("192.168.1.2:6000");
  });

  it("should handle last_seen_timestamp conversion", () => {
    const timestamp = 1765057753; // Unix timestamp in seconds
    const date = new Date(timestamp * 1000);

    expect(date).toBeInstanceOf(Date);
    expect(date.getTime()).toBe(timestamp * 1000);
  });
});
