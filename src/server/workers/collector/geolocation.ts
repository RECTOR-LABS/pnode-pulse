/**
 * Geolocation
 *
 * Updates node geolocation data using IP lookup.
 */

import { db } from "@/lib/db";
import { fetchGeolocationBatch } from "@/lib/geolocation";
import { logger } from "@/lib/logger";

/**
 * Update geolocation for nodes that don't have it
 * Runs once per collection cycle to populate lat/lng for new nodes
 */
export async function updateNodeGeolocation() {
  // Get nodes without geolocation (limit to 100 per cycle to respect rate limits)
  const nodesWithoutGeo = await db.node.findMany({
    where: {
      latitude: null,
      isActive: true,
    },
    select: {
      id: true,
      address: true,
    },
    take: 100,
  });

  if (nodesWithoutGeo.length === 0) return;

  // Extract IPs from addresses
  const ipToNodeId = new Map<string, number>();
  const ips: string[] = [];

  for (const node of nodesWithoutGeo) {
    const ip = node.address.split(":")[0];
    ipToNodeId.set(ip, node.id);
    ips.push(ip);
  }

  // Fetch geolocation data
  const geoData = await fetchGeolocationBatch(ips);

  // Update nodes with geolocation
  let updated = 0;
  for (const [ip, geo] of geoData) {
    const nodeId = ipToNodeId.get(ip);
    if (nodeId && geo) {
      await db.node.update({
        where: { id: nodeId },
        data: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          country: geo.country,
          city: geo.city,
        },
      });
      updated++;
    }
  }

  if (updated > 0) {
    logger.info("Updated node geolocation", {
      updated,
      total: nodesWithoutGeo.length,
    });
  }
}
