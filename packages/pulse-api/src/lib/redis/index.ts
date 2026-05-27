/**
 * Redis Client
 *
 * Singleton Redis client for rate limiting and caching.
 * Uses the same Redis instance as BullMQ queues.
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";
import { getRedisConnectionConfig } from "@/lib/constants/redis";

// Redis connection config
function getRedisConfig() {
  return {
    ...getRedisConnectionConfig(),
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) return null; // Stop retrying
      return Math.min(times * 100, 3000);
    },
  };
}

// Singleton instance
let redisClient: Redis | null = null;

/**
 * Get or create the Redis client
 */
export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(getRedisConfig());

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
