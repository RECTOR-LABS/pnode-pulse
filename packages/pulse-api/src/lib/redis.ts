import Redis from "ioredis";
import { loadConfig } from "../config";

let cached: Redis | null = null;

export function getRedis(): Redis {
  if (cached) return cached;
  const env = loadConfig();
  if (env.REDIS_URL) {
    cached = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
  } else if (env.REDIS_HOST) {
    cached = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT ?? 6379,
      password: env.REDIS_PASSWORD,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
  } else {
    throw new Error("Redis not configured: set REDIS_URL or REDIS_HOST");
  }
  return cached;
}

export async function isRedisAvailable(): Promise<boolean> {
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (cached) {
    cached.disconnect();
    cached = null;
  }
}
