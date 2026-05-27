/**
 * API-key authentication + rate limiting for the public REST surface
 * (/v1/public/*). Ported from src/lib/api/rate-limiter.ts in the monolith.
 *
 * Tiers:
 *   - ANONYMOUS  no key → IP-based limit
 *   - FREE / PRO / ENTERPRISE  per-key limits
 *
 * Storage:
 *   - Redis (sorted-set sliding window) when available
 *   - In-memory fallback otherwise (fail-safe, not fail-open)
 */

import { createHash } from "node:crypto";
import type { ApiKeyTier } from "@pulse/types";
import { getDb } from "./db";
import { getRedis, isRedisAvailable } from "./redis";
import { logger } from "./logger";

export const RATE_LIMITS: Record<ApiKeyTier | "ANONYMOUS", number> = {
  ANONYMOUS: 30,
  FREE: 120,
  PRO: 600,
  ENTERPRISE: 3000,
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  tier: ApiKeyTier | "ANONYMOUS";
  apiKeyId?: string;
}

const RATE_LIMIT_PREFIX = "rl:";
const WINDOW_SIZE = 60;

interface InMemoryLimit {
  count: number;
  resetAt: number;
}
const inMemory = new Map<string, InMemoryLimit>();

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function extractApiKey(
  headers: Headers,
  queryParam?: string | null,
): string | null {
  const xKey = headers.get("x-api-key");
  if (xKey) return xKey.trim();
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  if (queryParam) return queryParam.trim();
  return null;
}

function getClientId(headers: Headers, fallbackIp: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || fallbackIp || "unknown";
  return `ip:${ip}`;
}

function checkInMemory(
  identifier: string,
  limit: number,
  tier: RateLimitResult["tier"],
  apiKeyId?: string,
): RateLimitResult {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  // Probabilistic cleanup to keep map bounded under sustained load.
  if (Math.random() < 0.01) {
    for (const [k, v] of inMemory.entries()) {
      if (v.resetAt < now) inMemory.delete(k);
    }
  }

  const entry = inMemory.get(identifier);
  if (!entry || entry.resetAt < now) {
    inMemory.set(identifier, { count: 1, resetAt: now + WINDOW_SIZE * 1000 });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      reset: nowSec + WINDOW_SIZE,
      tier,
      apiKeyId,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: Math.floor(entry.resetAt / 1000),
      tier,
      apiKeyId,
    };
  }
  entry.count++;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - entry.count),
    reset: Math.floor(entry.resetAt / 1000),
    tier,
    apiKeyId,
  };
}

export async function checkRateLimit(
  headers: Headers,
  fallbackIp: string,
  queryApiKey?: string | null,
): Promise<RateLimitResult> {
  const apiKey = extractApiKey(headers, queryApiKey);
  let tier: RateLimitResult["tier"] = "ANONYMOUS";
  let identifier: string;
  let apiKeyId: string | undefined;

  if (apiKey) {
    const db = getDb();
    const record = await db.apiKey.findFirst({
      where: {
        keyHash: hashApiKey(apiKey),
        isActive: true,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (record) {
      tier = record.tier as ApiKeyTier;
      identifier = `key:${record.id}`;
      apiKeyId = record.id;
    } else {
      identifier = getClientId(headers, fallbackIp);
    }
  } else {
    identifier = getClientId(headers, fallbackIp);
  }

  const limit = RATE_LIMITS[tier];
  const redisKey = `${RATE_LIMIT_PREFIX}${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - WINDOW_SIZE;

  if (!(await isRedisAvailable())) {
    logger.warn(
      { identifier },
      "rate-limit redis unavailable, using in-memory fallback",
    );
    return checkInMemory(identifier, limit, tier, apiKeyId);
  }

  const redis = getRedis();
  const multi = redis.multi();
  multi.zremrangebyscore(redisKey, 0, windowStart);
  multi.zcard(redisKey);
  multi.zadd(redisKey, now, `${now}:${Math.random().toString(36).slice(2)}`);
  multi.expire(redisKey, WINDOW_SIZE * 2);
  const results = await multi.exec();
  const currentCount = (results?.[1]?.[1] as number) ?? 0;

  return {
    allowed: currentCount < limit,
    limit,
    remaining: Math.max(0, limit - currentCount - 1),
    reset: now + WINDOW_SIZE,
    tier,
    apiKeyId,
  };
}

export async function trackUsage(opts: {
  apiKeyId?: string;
  endpoint: string;
  method: string;
  responseTimeMs: number;
  isError: boolean;
}): Promise<void> {
  if (!opts.apiKeyId) return;
  try {
    const db = getDb();
    const now = new Date();
    const bucket = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      0,
      0,
      0,
    );

    await db.apiKeyUsage.upsert({
      where: {
        apiKeyId_bucket_endpoint_method: {
          apiKeyId: opts.apiKeyId,
          bucket,
          endpoint: opts.endpoint,
          method: opts.method,
        },
      },
      create: {
        apiKeyId: opts.apiKeyId,
        bucket,
        endpoint: opts.endpoint,
        method: opts.method,
        requestCount: 1,
        totalResponseMs: opts.responseTimeMs,
        errorCount: opts.isError ? 1 : 0,
      },
      update: {
        requestCount: { increment: 1 },
        totalResponseMs: { increment: opts.responseTimeMs },
        errorCount: opts.isError ? { increment: 1 } : undefined,
      },
    });
    await db.apiKey.update({
      where: { id: opts.apiKeyId },
      data: { requestCount: { increment: 1 }, lastUsedAt: now },
    });
  } catch (err) {
    logger.error({ err }, "failed to track api key usage");
  }
}
