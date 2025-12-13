/**
 * IP Geolocation Service
 *
 * Uses ip-api.com batch API (free tier: 45 requests/minute, 100 IPs per batch)
 * Returns latitude, longitude, country, and city for IP addresses.
 */

import { logger } from "@/lib/logger";

interface GeoResult {
  ip: string;
  status: "success" | "fail";
  country?: string;
  countryCode?: string;
  city?: string;
  lat?: number;
  lon?: number;
  message?: string;
}

interface GeoData {
  latitude: number;
  longitude: number;
  country: string;
  city: string;
}

// Cache to avoid re-fetching same IPs
const geoCache = new Map<string, GeoData | null>();

/**
 * Fetch geolocation for multiple IPs using batch API
 * @param ips Array of IP addresses (max 100 per call)
 * @returns Map of IP to geo data
 */
export async function fetchGeolocationBatch(ips: string[]): Promise<Map<string, GeoData | null>> {
  const results = new Map<string, GeoData | null>();

  if (ips.length === 0) return results;

  // Check cache first
  const uncachedIps: string[] = [];
  for (const ip of ips) {
    if (geoCache.has(ip)) {
      results.set(ip, geoCache.get(ip)!);
    } else {
      uncachedIps.push(ip);
    }
  }

  if (uncachedIps.length === 0) return results;

  // Batch API endpoint (POST with JSON array of IPs)
  // Free tier: 45 req/min, 100 IPs per batch
  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < uncachedIps.length; i += batchSize) {
    batches.push(uncachedIps.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      const response = await fetch("http://ip-api.com/batch?fields=status,message,country,countryCode,city,lat,lon,query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch.map(ip => ({ query: ip }))),
      });

      if (!response.ok) {
        logger.warn("Geolocation batch request failed", { status: response.status });
        // Cache as null to avoid re-fetching failed IPs
        for (const ip of batch) {
          geoCache.set(ip, null);
          results.set(ip, null);
        }
        continue;
      }

      const data: GeoResult[] = await response.json();

      for (const result of data) {
        const ip = result.ip || batch[data.indexOf(result)];

        if (result.status === "success" && result.lat && result.lon) {
          const geoData: GeoData = {
            latitude: result.lat,
            longitude: result.lon,
            country: result.countryCode || result.country || "Unknown",
            city: result.city || "Unknown",
          };
          geoCache.set(ip, geoData);
          results.set(ip, geoData);
        } else {
          geoCache.set(ip, null);
          results.set(ip, null);
        }
      }

      // Rate limiting: wait 1.5 seconds between batches (45 req/min = ~1.3s between requests)
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      logger.warn("Geolocation fetch error", { error: error instanceof Error ? error.message : String(error) });
      for (const ip of batch) {
        geoCache.set(ip, null);
        results.set(ip, null);
      }
    }
  }

  return results;
}

/**
 * Fetch geolocation for a single IP
 */
export async function fetchGeolocation(ip: string): Promise<GeoData | null> {
  const results = await fetchGeolocationBatch([ip]);
  return results.get(ip) ?? null;
}

/**
 * Clear the geolocation cache
 */
export function clearGeoCache() {
  geoCache.clear();
}
