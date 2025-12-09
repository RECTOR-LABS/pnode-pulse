/**
 * Redis Client
 *
 * Singleton Redis client for rate limiting and caching.
 * Uses the same Redis instance as BullMQ queues.
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";

// Redis connection config (matches queue config)
function getRedisHost(): string {
  const host = process.env.REDIS_HOST;

  // Development: allow localhost fallback
  if (!host && process.env.NODE_ENV === "development") {
    return "localhost";
  }

  // Production/Test: require explicit configuration
  if (!host) {
    throw new Error("REDIS_HOST environment variable is required in production");
  }

  return host;
}

const REDIS_CONFIG = {
  host: getRedisHost(),
  port: parseInt(process.env.REDIS_PORT || "6381"),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) return null; // Stop retrying
    return Math.min(times * 100, 3000);
  },
};

// Singleton instance
let redisClient: Redis | null = null;

/**
 * Get or create the Redis client
 */
export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_CONFIG);

    redisClient.on("error", (err) => {
      logger.error("[Redis] Connection error:", err);
    });

    redisClient.on("connect", () => {
      logger.info("[Redis] Connected successfully");
    });
  }
  return redisClient;
}

/**
 * Close the Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = getRedis();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
