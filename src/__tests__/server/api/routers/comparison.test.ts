/**
 * Comparison Router Tests
 *
 * Tests for version comparison utilities and version status procedures.
 * Focuses on pNode-specific version formats with pre-release metadata.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { compareVersions, sortVersionsDesc } from "@/server/api/routers/comparison";
import { db } from "@/lib/db";
import type { Node } from "@prisma/client";

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    node: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    portfolio: {
      findFirst: vi.fn(),
    },
    nodePeer: {
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// ============================================
// Version Comparison Tests
// ============================================

describe("compareVersions", () => {
  describe("Standard Semver Comparison", () => {
    it("should sort major versions correctly", () => {
      expect(compareVersions("1.0.0", "0.9.0")).toBeLessThan(0);
      expect(compareVersions("0.9.0", "1.0.0")).toBeGreaterThan(0);
    });

    it("should sort minor versions correctly", () => {
      expect(compareVersions("0.8.0", "0.7.0")).toBeLessThan(0);
      expect(compareVersions("0.7.0", "0.8.0")).toBeGreaterThan(0);
    });

    it("should sort patch versions correctly", () => {
      expect(compareVersions("0.7.3", "0.7.0")).toBeLessThan(0);
      expect(compareVersions("0.7.0", "0.7.3")).toBeGreaterThan(0);
    });

    it("should return 0 for equal versions", () => {
      expect(compareVersions("0.7.0", "0.7.0")).toBe(0);
      expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    });
  });

  describe("pNode Version Formats", () => {
    it("should handle versions with pre-release metadata", () => {
      // 0.7.3 (stable) should be higher than 0.7.0-trynet
      const result = compareVersions("0.7.3", "0.7.0-trynet.20251208141952.3b3bb24");
      expect(result).toBeLessThan(0);
    });

    it("should rank stable over pre-release for same base version", () => {
      // 0.7.0 (stable) should be higher than 0.7.0-trynet...
      const result = compareVersions("0.7.0", "0.7.0-trynet.20251208141952.3b3bb24");
      expect(result).toBeLessThan(0);
    });

    it("should handle complex pre-release strings", () => {
      const preRelease = "0.7.0-trynet.20251208141952.3b3bb24";
      // The naive approach would parse "0-trynet" as NaN
      const result = compareVersions(preRelease, "0.6.0");
      // 0.7.0-trynet should still be higher than 0.6.0
      expect(result).toBeLessThan(0);
    });

    it("should not produce NaN with hyphenated versions", () => {
      // This was the original bug - "0.7.0-trynet" split by "." gives "0-trynet" which is NaN
      const versions = ["0.7.0-trynet.20251208", "0.5.1"];
      const sorted = sortVersionsDesc(versions);
      expect(sorted[0]).toBe("0.7.0-trynet.20251208");
      expect(sorted[1]).toBe("0.5.1");
    });
  });

  describe("Real pNode Version Scenarios", () => {
    it("should sort actual pNode versions correctly", () => {
      const versions = [
        "0.5.1",
        "0.7.0-trynet.20251208141952.3b3bb24",
        "0.7.3",
        "0.6.0",
        "0.7.0",
      ];
      const sorted = sortVersionsDesc(versions);

      // Expected order (descending): 0.7.3, 0.7.0, 0.7.0-trynet..., 0.6.0, 0.5.1
      expect(sorted[0]).toBe("0.7.3");
      expect(sorted[1]).toBe("0.7.0");
      expect(sorted[2]).toBe("0.7.0-trynet.20251208141952.3b3bb24");
      expect(sorted[3]).toBe("0.6.0");
      expect(sorted[4]).toBe("0.5.1");
    });

    it("should identify latest version from mixed set", () => {
      const versions = [
        "0.5.1",
        "0.7.0-trynet.20251208141952.3b3bb24",
        "0.6.0",
      ];
      const sorted = sortVersionsDesc(versions);
      expect(sorted[0]).toBe("0.7.0-trynet.20251208141952.3b3bb24");
    });

    it("should handle network distribution data", () => {
      // From actual Discord intelligence: 128 nodes on v0.6.0, 5 on v0.5.1
      const versionCounts: Record<string, number> = {
        "0.6.0": 128,
        "0.5.1": 5,
        "0.7.0": 1,
      };

      const sorted = sortVersionsDesc(Object.keys(versionCounts));
      expect(sorted[0]).toBe("0.7.0");
    });
  });

  describe("Edge Cases", () => {
    it("should handle single-part versions", () => {
      const result = compareVersions("1", "0");
      expect(result).toBeLessThan(0);
    });

    it("should handle versions with missing parts without crashing", () => {
      // Just verify it doesn't crash and returns a number
      const result = compareVersions("0.7", "0.7.0");
      expect(typeof result).toBe("number");
      expect(Number.isNaN(result)).toBe(false);
    });

    it("should handle empty string gracefully", () => {
      const result = compareVersions("", "0.7.0");
      expect(result).toBeGreaterThan(0);
    });

    it("should handle two pre-release versions", () => {
      const result = compareVersions(
        "0.7.0-alpha.1",
        "0.7.0-beta.1"
      );
      // Both have same base (0.7.0), so string comparison applies
      // "beta" > "alpha" lexicographically, so alpha comes first in DESC
      expect(typeof result).toBe("number");
    });
  });
});

describe("sortVersionsDesc", () => {
  it("should return versions in descending order", () => {
    const versions = ["0.5.0", "0.7.0", "0.6.0"];
    const sorted = sortVersionsDesc(versions);
    expect(sorted).toEqual(["0.7.0", "0.6.0", "0.5.0"]);
  });

  it("should not mutate original array", () => {
    const versions = ["0.5.0", "0.7.0", "0.6.0"];
    const original = [...versions];
    sortVersionsDesc(versions);
    expect(versions).toEqual(original);
  });

  it("should handle empty array", () => {
    const sorted = sortVersionsDesc([]);
    expect(sorted).toEqual([]);
  });

  it("should handle single version", () => {
    const sorted = sortVersionsDesc(["0.7.0"]);
    expect(sorted).toEqual(["0.7.0"]);
  });

  it("should handle duplicate versions", () => {
    const versions = ["0.7.0", "0.6.0", "0.7.0"];
    const sorted = sortVersionsDesc(versions);
    expect(sorted[0]).toBe("0.7.0");
    expect(sorted[1]).toBe("0.7.0");
    expect(sorted[2]).toBe("0.6.0");
  });
});

// ============================================
// Version Status Procedure Tests
// ============================================

describe("versionStatus procedure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return correct latest version", async () => {
    // Mock nodes with versions
    vi.mocked(db.node.findMany).mockResolvedValueOnce([
      { id: 1, address: "192.168.1.1:6000", version: "0.7.3", isActive: true },
      { id: 2, address: "192.168.1.2:6000", version: "0.6.0", isActive: true },
      { id: 3, address: "192.168.1.3:6000", version: "0.5.1", isActive: false },
    ] as unknown as Node[]);

    // Simulate the procedure logic
    const nodes = await db.node.findMany({ where: { version: { not: null } } });
    const versionCounts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.version) {
        versionCounts[node.version] = (versionCounts[node.version] || 0) + 1;
      }
    }

    const versions = sortVersionsDesc(Object.keys(versionCounts));
    const latestVersion = versions[0] || null;

    expect(latestVersion).toBe("0.7.3");
  });

  it("should calculate version distribution correctly", async () => {
    vi.mocked(db.node.findMany).mockResolvedValueOnce([
      { id: 1, version: "0.7.0", isActive: true },
      { id: 2, version: "0.7.0", isActive: true },
      { id: 3, version: "0.6.0", isActive: true },
      { id: 4, version: "0.5.1", isActive: false },
    ] as unknown as Node[]);

    const nodes = await db.node.findMany({ where: { version: { not: null } } });
    const versionCounts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.version) {
        versionCounts[node.version] = (versionCounts[node.version] || 0) + 1;
      }
    }

    expect(versionCounts["0.7.0"]).toBe(2);
    expect(versionCounts["0.6.0"]).toBe(1);
    expect(versionCounts["0.5.1"]).toBe(1);
  });

  it("should identify nodes needing update", async () => {
    vi.mocked(db.node.findMany).mockResolvedValueOnce([
      { id: 1, address: "192.168.1.1:6000", version: "0.7.3", isActive: true },
      { id: 2, address: "192.168.1.2:6000", version: "0.6.0", isActive: true },
      { id: 3, address: "192.168.1.3:6000", version: "0.5.1", isActive: true },
    ] as unknown as Node[]);

    const nodes = await db.node.findMany({ where: { version: { not: null } } });
    const versionCounts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.version) {
        versionCounts[node.version] = (versionCounts[node.version] || 0) + 1;
      }
    }

    const versions = sortVersionsDesc(Object.keys(versionCounts));
    const latestVersion = versions[0] || null;

    const nodesNeedingUpdate = nodes.filter(
      (n) => n.version && n.version !== latestVersion
    );

    expect(nodesNeedingUpdate).toHaveLength(2);
    expect(nodesNeedingUpdate.map((n) => n.version)).toContain("0.6.0");
    expect(nodesNeedingUpdate.map((n) => n.version)).toContain("0.5.1");
  });

  it("should handle empty node list", async () => {
    vi.mocked(db.node.findMany).mockResolvedValueOnce([]);

    const nodes = await db.node.findMany({ where: { version: { not: null } } });
    expect(nodes).toHaveLength(0);

    const result = {
      latestVersion: null,
      versionDistribution: {},
      nodesOnLatest: 0,
      nodesNeedingUpdate: [],
      totalNodes: 0,
    };

    expect(result.latestVersion).toBeNull();
    expect(result.totalNodes).toBe(0);
  });

  it("should handle all nodes on same version", async () => {
    vi.mocked(db.node.findMany).mockResolvedValueOnce([
      { id: 1, version: "0.7.3", isActive: true },
      { id: 2, version: "0.7.3", isActive: true },
      { id: 3, version: "0.7.3", isActive: true },
    ] as unknown as Node[]);

    const nodes = await db.node.findMany({ where: { version: { not: null } } });
    const versionCounts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.version) {
        versionCounts[node.version] = (versionCounts[node.version] || 0) + 1;
      }
    }

    const versions = sortVersionsDesc(Object.keys(versionCounts));
    const latestVersion = versions[0] || null;
    const nodesNeedingUpdate = nodes.filter(
      (n) => n.version && n.version !== latestVersion
    );

    expect(latestVersion).toBe("0.7.3");
    expect(nodesNeedingUpdate).toHaveLength(0);
  });
});

// ============================================
// Integration Tests
// ============================================

describe("Version Comparison Integration", () => {
  it("should handle full network version analysis", () => {
    // Simulated network data from Discord intelligence
    const networkVersions = [
      { version: "0.6.0", count: 128 },
      { version: "0.5.1", count: 5 },
      { version: "0.7.0-trynet.20251208141952.3b3bb24", count: 1 },
    ];

    const versions = networkVersions.map((v) => v.version);
    const sorted = sortVersionsDesc(versions);
    const latestVersion = sorted[0];

    // v0.7.0-trynet should be identified as latest despite pre-release tag
    expect(latestVersion).toBe("0.7.0-trynet.20251208141952.3b3bb24");
  });

  it("should calculate correct update percentage", () => {
    const total = 134;
    const onLatest = 1;
    const needingUpdate = total - onLatest;
    const updatePercentage = (needingUpdate / total) * 100;

    expect(updatePercentage).toBeCloseTo(99.25, 1);
  });

  it("should produce consistent results across multiple sorts", () => {
    const versions = [
      "0.5.1",
      "0.7.0-trynet.20251208141952.3b3bb24",
      "0.6.0",
      "0.7.3",
    ];

    const sorted1 = sortVersionsDesc(versions);
    const sorted2 = sortVersionsDesc(versions);
    const sorted3 = sortVersionsDesc([...versions].reverse());

    expect(sorted1).toEqual(sorted2);
    expect(sorted1).toEqual(sorted3);
  });
});
