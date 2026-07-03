/**
 * Collector poll-target selection.
 *
 * Only nodes that gossip (get-pods-with-stats) reports as `is_public: true` are
 * worth polling directly — private nodes expose `:6000` to no client and are
 * covered by federation. This keeps the direct-poll set at ~the public-node
 * count instead of every accumulated DB address (most of which are stale/private
 * and fail every run regardless of region).
 */
import { createClient } from "@/lib/prpc";
import type { PodsWithStatsResult } from "@/types/prpc";
import { NODE_TIMEOUT, PRPC_PORT } from "./types";

/**
 * RPC addresses ("ip:6000") of nodes gossip marks `is_public: true`, deduped.
 */
export function publicAddressesFromGossip(
  gossip: PodsWithStatsResult | null,
): string[] {
  if (!gossip) return [];
  const set = new Set<string>();
  for (const p of gossip.pods) {
    if (p.is_public === true) {
      const ip = p.address.split(":")[0];
      set.add(`${ip}:${PRPC_PORT}`);
    }
  }
  return Array.from(set);
}

/**
 * Fetch network-wide gossip from the first responsive seed. Returns null if
 * every seed is unreachable (caller should fall back to known DB nodes).
 */
export async function fetchNetworkGossip(
  seedIps: readonly string[],
): Promise<PodsWithStatsResult | null> {
  for (const ip of seedIps) {
    try {
      const client = createClient(ip, { timeout: NODE_TIMEOUT });
      return await client.getPodsWithStats();
    } catch {
      // Seed unreachable — try the next one.
    }
  }
  return null;
}

/**
 * The RPC addresses to directly poll this cycle: always the seeds, plus the
 * gossip-public nodes. If gossip is unavailable (all seeds down), fall back to
 * the known DB addresses so a full-seed outage doesn't blind the collector.
 */
export function directPollSet(
  seedIps: readonly string[],
  gossip: PodsWithStatsResult | null,
  fallbackAddresses: readonly string[],
): string[] {
  const seeds = seedIps.map((ip) => `${ip}:${PRPC_PORT}`);
  const rest = gossip ? publicAddressesFromGossip(gossip) : fallbackAddresses;
  return Array.from(new Set([...seeds, ...rest]));
}
