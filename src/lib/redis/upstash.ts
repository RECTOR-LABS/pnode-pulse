/**
 * Upstash Redis (REST) client + rate-limiter factory.
 *
 * Upstash speaks HTTP, so it works from Vercel Functions without a persistent
 * connection (unlike ioredis). The client is created lazily and only when the
 * UPSTASH_* env vars are present — so importing this module is build-safe, and
 * callers can fall back to in-memory limiting when Upstash is not configured.
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let cachedRedis: Redis | null | undefined;

/** The Upstash REST client, or null when UPSTASH_* env vars are absent. */
export function getUpstashRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  cachedRedis = url && token ? new Redis({ url, token }) : null;
  return cachedRedis;
}

const limiters = new Map<string, Ratelimit>();

/**
 * A sliding-window limiter allowing `perMinute` requests per 60s, namespaced by
 * `name` (used as the Redis key prefix). Returns null when Upstash is not
 * configured, so callers can fall back to in-memory limiting.
 */
export function getSlidingWindowLimiter(
  name: string,
  perMinute: number,
): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;

  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(perMinute, "60 s"),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}
