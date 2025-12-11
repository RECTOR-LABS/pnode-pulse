/**
 * Rate Limiter for Public API
 *
 * Implements sliding window rate limiting using Redis.
 * Supports different tiers with varying limits.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRedis, isRedisAvailable } from "@/lib/redis";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import {
  RATE_LIMITS,
  type RateLimitTier,
  type RateLimitHeaders,
  type RateLimitResult,
} from "./constants";

// Re-export for convenience (server-side usage)
export { RATE_LIMITS, type RateLimitTier, type RateLimitHeaders, type RateLimitResult };

// Redis key prefixes
const RATE_LIMIT_PREFIX = "rl:";
const WINDOW_SIZE = 60; // 1 minute in seconds

// In-memory fallback for when Redis is unavailable
interface InMemoryLimit {
  count: number;
  resetAt: number;
}
const inMemoryLimits = new Map<string, InMemoryLimit>();

/**
 * Clean up expired in-memory rate limit entries
 */
function cleanupInMemoryLimits(): void {
  const now = Date.now();
  for (const [key, value] of inMemoryLimits.entries()) {
    if (value.resetAt < now) {
      inMemoryLimits.delete(key);
    }
  }
}

/**
 * Check rate limit using in-memory fallback
 * Used when Redis is unavailable to maintain rate limiting
 */
function checkInMemoryRateLimit(
  identifier: string,
  limit: number,
  tier: RateLimitTier,
  apiKeyId: string | undefined
): RateLimitResult {
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);

  // Cleanup periodically (1% chance per request)
  if (Math.random() < 0.01) {
    cleanupInMemoryLimits();
  }

  const entry = inMemoryLimits.get(identifier);

  // No entry or expired - create new
  if (!entry || entry.resetAt < now) {
    inMemoryLimits.set(identifier, {
      count: 1,
      resetAt: now + WINDOW_SIZE * 1000,
    });

    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      reset: nowSeconds + WINDOW_SIZE,
      tier,
      apiKeyId,
    };
  }

  // Check if limit exceeded
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

  // Increment count
  entry.count++;
  const remaining = Math.max(0, limit - entry.count);

  return {
    allowed: true,
    limit,
    remaining,
    reset: Math.floor(entry.resetAt / 1000),
    tier,
    apiKeyId,
  };
}

/**
 * Hash an API key for lookup
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Extract API key from request
 */
export function extractApiKey(request: NextRequest): string | null {
  // Check X-API-Key header
  const xApiKey = request.headers.get("X-API-Key");
  if (xApiKey) return xApiKey;

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check query parameter (less secure, but convenient for testing)
  const apiKey = request.nextUrl.searchParams.get("api_key");
  if (apiKey) return apiKey;

  return null;
}

/**
 * Get client identifier for anonymous rate limiting
 */
function getClientId(request: NextRequest): string {
  // Use IP address as identifier
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

/**
 * Check rate limit and return result
 */
export async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - WINDOW_SIZE;
  const apiKey = extractApiKey(request);

  let tier: RateLimitTier = "ANONYMOUS";
  let identifier: string;
  let apiKeyId: string | undefined;

  // If API key provided, validate it
  if (apiKey) {
    const keyHash = hashApiKey(apiKey);
    const keyRecord = await db.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (keyRecord) {
      tier = keyRecord.tier as RateLimitTier;
      identifier = `key:${keyRecord.id}`;
      apiKeyId = keyRecord.id;
    } else {
      // Invalid key - use anonymous limits
      identifier = getClientId(request);
    }
  } else {
    identifier = getClientId(request);
  }

  const limit = RATE_LIMITS[tier];
  const redisKey = `${RATE_LIMIT_PREFIX}${identifier}`;

  // Check if Redis is available
  const redisAvailable = await isRedisAvailable();

  if (!redisAvailable) {
    // Fallback: use in-memory rate limiting (fail-safe, not fail-open)
    logger.warn("[RateLimit] Redis unavailable, using in-memory fallback");
    return checkInMemoryRateLimit(identifier, limit, tier, apiKeyId);
  }

  const redis = getRedis();

  // Use sliding window with sorted sets
  // Each request adds a timestamp, we count requests in the window
  const multi = redis.multi();

  // Remove old entries outside the window
  multi.zremrangebyscore(redisKey, 0, windowStart);

  // Count current requests in window
  multi.zcard(redisKey);

  // Add current request
  multi.zadd(redisKey, now, `${now}:${Math.random().toString(36).slice(2)}`);

  // Set expiry on the key
  multi.expire(redisKey, WINDOW_SIZE * 2);

  const results = await multi.exec();

  // Get count before adding current request
  const currentCount = (results?.[1]?.[1] as number) || 0;
  const remaining = Math.max(0, limit - currentCount - 1);
  const allowed = currentCount < limit;

  return {
    allowed,
    limit,
    remaining,
    reset: now + WINDOW_SIZE,
    tier,
    apiKeyId,
  };
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };

  if (!result.allowed) {
    headers["Retry-After"] = WINDOW_SIZE.toString();
  }

  return headers;
}

/**
 * Rate limit error response
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  const headers = createRateLimitHeaders(result);

  return NextResponse.json(
    {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded. You are allowed ${result.limit} requests per minute on the ${result.tier} tier.`,
        limit: result.limit,
        tier: result.tier,
        retryAfter: WINDOW_SIZE,
      },
    },
    {
      status: 429,
      headers,
    }
  );
}

/**
 * Track API usage for analytics
 */
export async function trackApiUsage(
  apiKeyId: string | undefined,
  endpoint: string,
  method: string,
  responseTimeMs: number,
  isError: boolean
): Promise<void> {
  if (!apiKeyId) return;

  try {
    // Bucket by hour
    const now = new Date();
    const bucket = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      0,
      0,
      0
    );

    // Upsert usage record
    await db.apiKeyUsage.upsert({
      where: {
        apiKeyId_bucket_endpoint_method: {
          apiKeyId,
          bucket,
          endpoint,
          method,
        },
      },
      create: {
        apiKeyId,
        bucket,
        endpoint,
        method,
        requestCount: 1,
        totalResponseMs: responseTimeMs,
        errorCount: isError ? 1 : 0,
      },
      update: {
        requestCount: { increment: 1 },
        totalResponseMs: { increment: responseTimeMs },
        errorCount: isError ? { increment: 1 } : undefined,
      },
    });

    // Update total request count on the key
    await db.apiKey.update({
      where: { id: apiKeyId },
      data: {
        requestCount: { increment: 1 },
        lastUsedAt: now,
      },
    });
  } catch (error) {
    logger.error("[ApiUsage] Failed to track usage:", error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Middleware wrapper for rate-limited API routes
 */
export function withRateLimit<T extends NextResponse>(
  handler: (request: NextRequest, rateLimitResult: RateLimitResult) => Promise<T>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const result = await checkRateLimit(request);

    if (!result.allowed) {
      return rateLimitExceededResponse(result);
    }

    try {
      const response = await handler(request, result);

      // Add rate limit headers to successful response
      const headers = createRateLimitHeaders(result);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      // Track usage
      const responseTime = Date.now() - startTime;
      const isError = response.status >= 400;
      const endpoint = request.nextUrl.pathname;
      const method = request.method;

      await trackApiUsage(result.apiKeyId, endpoint, method, responseTime, isError);

      return response;
    } catch (error) {
      // Track error
      const responseTime = Date.now() - startTime;
      const endpoint = request.nextUrl.pathname;
      const method = request.method;

      await trackApiUsage(result.apiKeyId, endpoint, method, responseTime, true);

      throw error;
    }
  };
}
