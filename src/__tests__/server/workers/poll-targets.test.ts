/**
 * Tests for collector poll-target selection.
 *
 * The collector should directly poll ONLY the nodes gossip reports as
 * `is_public: true` (plus seeds), not every accumulated DB address — private
 * nodes are unreachable by any client and are covered by federation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PodsWithStatsResult, PodWithStats } from "@/types/prpc";

vi.mock("@/lib/prpc", () => ({
  createClient: vi.fn(),
}));
import { createClient } from "@/lib/prpc";
import {
  publicAddressesFromGossip,
  fetchNetworkGossip,
  directPollSet,
} from "@/server/workers/collector/poll-targets";

type MockClient = ReturnType<typeof createClient>;

function pod(address: string, is_public: boolean | null): PodWithStats {
  return {
    address,
    is_public,
    last_seen_timestamp: 1765000000,
    pubkey: null,
    rpc_port: 6000,
    storage_committed: null,
    storage_usage_percent: null,
    storage_used: null,
    uptime: 100,
    version: "0.7.3",
  };
}
function gossip(pods: PodWithStats[]): PodsWithStatsResult {
  return { pods, total_count: pods.length };
}

describe("publicAddressesFromGossip", () => {
  it("returns only is_public===true nodes, as :6000 RPC addresses", () => {
    const g = gossip([
      pod("1.1.1.1:9001", true),
      pod("2.2.2.2:9001", false),
      pod("3.3.3.3:9001", null),
      pod("4.4.4.4:9001", true),
    ]);
    expect(publicAddressesFromGossip(g).sort()).toEqual([
      "1.1.1.1:6000",
      "4.4.4.4:6000",
    ]);
  });

  it("deduplicates repeated public addresses", () => {
    const g = gossip([pod("5.5.5.5:9001", true), pod("5.5.5.5:9001", true)]);
    expect(publicAddressesFromGossip(g)).toEqual(["5.5.5.5:6000"]);
  });

  it("returns [] for null gossip or empty pods", () => {
    expect(publicAddressesFromGossip(null)).toEqual([]);
    expect(publicAddressesFromGossip(gossip([]))).toEqual([]);
  });
});

describe("fetchNetworkGossip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns gossip from the first responsive seed", async () => {
    const good = gossip([pod("9.9.9.9:9001", true)]);
    vi.mocked(createClient)
      .mockReturnValueOnce({
        getPodsWithStats: vi.fn().mockRejectedValue(new Error("refused")),
      } as unknown as MockClient)
      .mockReturnValueOnce({
        getPodsWithStats: vi.fn().mockResolvedValue(good),
      } as unknown as MockClient);

    const result = await fetchNetworkGossip(["1.1.1.1", "2.2.2.2"]);
    expect(result).toBe(good);
    expect(createClient).toHaveBeenCalledTimes(2); // stopped after the 2nd succeeded
  });

  it("returns null when every seed fails", async () => {
    vi.mocked(createClient).mockReturnValue({
      getPodsWithStats: vi.fn().mockRejectedValue(new Error("down")),
    } as unknown as MockClient);

    const result = await fetchNetworkGossip(["1.1.1.1", "2.2.2.2", "3.3.3.3"]);
    expect(result).toBeNull();
    expect(createClient).toHaveBeenCalledTimes(3);
  });
});

describe("directPollSet", () => {
  it("polls seeds + gossip-public when gossip is present (ignores DB fallback)", () => {
    const g = gossip([pod("10.0.0.1:9001", true), pod("10.0.0.2:9001", false)]);
    const set = directPollSet(["1.2.3.4"], g, ["9.9.9.9:6000"]);
    expect(set.sort()).toEqual(["1.2.3.4:6000", "10.0.0.1:6000"].sort());
    expect(set).not.toContain("9.9.9.9:6000"); // fallback ignored when gossip present
  });

  it("falls back to seeds + known DB addresses when gossip is null", () => {
    const set = directPollSet(["1.2.3.4"], null, [
      "9.9.9.9:6000",
      "8.8.8.8:6000",
    ]);
    expect(set.sort()).toEqual([
      "1.2.3.4:6000",
      "8.8.8.8:6000",
      "9.9.9.9:6000",
    ]);
  });

  it("dedupes a seed that also appears as gossip-public", () => {
    const g = gossip([pod("1.2.3.4:9001", true)]);
    expect(directPollSet(["1.2.3.4"], g, [])).toEqual(["1.2.3.4:6000"]);
  });
});
