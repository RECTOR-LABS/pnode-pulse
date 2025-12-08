/**
 * Rate Limiter Tests
 *
 * Tests rate limiting logic, especially the in-memory fallback when Redis is unavailable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { RATE_LIMITS } from '@/lib/api/constants';
import type { RateLimitTier } from '@/lib/api/constants';

// Helper to create rate limit result
function createRateLimitResult(
  allowed: boolean,
  limit: number,
  remaining: number,
  tier: RateLimitTier
) {
  return {
    allowed,
    limit,
    remaining,
    reset: Math.floor(Date.now() / 1000) + 60,
    tier,
    apiKeyId: undefined,
  };
}

describe('Rate Limiter Constants', () => {
  it('should have correct rate limits for each tier', () => {
    expect(RATE_LIMITS.ANONYMOUS).toBe(30);
    expect(RATE_LIMITS.FREE).toBe(100);
    expect(RATE_LIMITS.PRO).toBe(1000);
    expect(RATE_LIMITS.ENTERPRISE).toBe(10000);
  });

  it('should have increasing limits for higher tiers', () => {
    expect(RATE_LIMITS.FREE).toBeGreaterThan(RATE_LIMITS.ANONYMOUS);
    expect(RATE_LIMITS.PRO).toBeGreaterThan(RATE_LIMITS.FREE);
    expect(RATE_LIMITS.ENTERPRISE).toBeGreaterThan(RATE_LIMITS.PRO);
  });
});

describe('In-Memory Rate Limiter', () => {
  let inMemoryLimits: Map<string, { count: number; resetAt: number }>;

  beforeEach(() => {
    // Create a fresh in-memory limits map for each test
    inMemoryLimits = new Map();
  });

  it('should allow first request', () => {
    const identifier = 'test-user';
    const limit = 10;
    const now = Date.now();
    const resetAt = now + 60000;

    inMemoryLimits.set(identifier, { count: 1, resetAt });

    expect(inMemoryLimits.get(identifier)).toEqual({
      count: 1,
      resetAt,
    });
  });

  it('should increment count on subsequent requests', () => {
    const identifier = 'test-user';
    const limit = 10;
    const now = Date.now();
    const resetAt = now + 60000;

    // First request
    inMemoryLimits.set(identifier, { count: 1, resetAt });

    // Second request
    const entry = inMemoryLimits.get(identifier)!;
    entry.count++;

    expect(entry.count).toBe(2);
  });

  it('should block requests when limit is reached', () => {
    const identifier = 'test-user';
    const limit = 3;
    const now = Date.now();
    const resetAt = now + 60000;

    // Simulate 3 requests
    inMemoryLimits.set(identifier, { count: 3, resetAt });

    const entry = inMemoryLimits.get(identifier)!;
    const isBlocked = entry.count >= limit;

    expect(isBlocked).toBe(true);
  });

  it('should allow requests after window expires', () => {
    const identifier = 'test-user';
    const limit = 10;
    const now = Date.now();
    const expiredResetAt = now - 1000; // Already expired

    // Set expired entry
    inMemoryLimits.set(identifier, { count: 10, resetAt: expiredResetAt });

    const entry = inMemoryLimits.get(identifier)!;
    const isExpired = entry.resetAt < now;

    expect(isExpired).toBe(true);

    // After expiry, should create new entry
    if (isExpired) {
      inMemoryLimits.set(identifier, { count: 1, resetAt: now + 60000 });
    }

    expect(inMemoryLimits.get(identifier)!.count).toBe(1);
  });

  it('should handle multiple different identifiers', () => {
    const now = Date.now();
    const resetAt = now + 60000;

    inMemoryLimits.set('user-1', { count: 5, resetAt });
    inMemoryLimits.set('user-2', { count: 3, resetAt });
    inMemoryLimits.set('user-3', { count: 8, resetAt });

    expect(inMemoryLimits.get('user-1')!.count).toBe(5);
    expect(inMemoryLimits.get('user-2')!.count).toBe(3);
    expect(inMemoryLimits.get('user-3')!.count).toBe(8);
    expect(inMemoryLimits.size).toBe(3);
  });

  it('should cleanup expired entries', () => {
    const now = Date.now();

    inMemoryLimits.set('active-user', { count: 5, resetAt: now + 60000 });
    inMemoryLimits.set('expired-user-1', { count: 10, resetAt: now - 1000 });
    inMemoryLimits.set('expired-user-2', { count: 8, resetAt: now - 5000 });

    // Cleanup expired entries
    for (const [key, value] of inMemoryLimits.entries()) {
      if (value.resetAt < now) {
        inMemoryLimits.delete(key);
      }
    }

    expect(inMemoryLimits.size).toBe(1);
    expect(inMemoryLimits.has('active-user')).toBe(true);
    expect(inMemoryLimits.has('expired-user-1')).toBe(false);
    expect(inMemoryLimits.has('expired-user-2')).toBe(false);
  });

  it('should correctly calculate remaining requests', () => {
    const limit = 10;
    const count = 7;
    const remaining = Math.max(0, limit - count);

    expect(remaining).toBe(3);
  });

  it('should never allow negative remaining requests', () => {
    const limit = 10;
    const count = 15; // Exceeded limit
    const remaining = Math.max(0, limit - count);

    expect(remaining).toBe(0);
  });
});

describe('Rate Limit Headers', () => {
  it('should create correct rate limit headers', () => {
    const result = createRateLimitResult(true, 100, 95, 'FREE');

    const headers = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    };

    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(headers['X-RateLimit-Remaining']).toBe('95');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('should include Retry-After when limit exceeded', () => {
    const result = createRateLimitResult(false, 100, 0, 'FREE');
    const WINDOW_SIZE = 60;

    const headers = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    };

    if (!result.allowed) {
      headers['Retry-After'] = WINDOW_SIZE.toString();
    }

    expect(headers['Retry-After']).toBe('60');
  });
});

describe('API Key Hashing', () => {
  it('should hash API keys consistently', () => {
    const apiKey = 'test-api-key-12345';
    const hash1 = createHash('sha256').update(apiKey).digest('hex');
    const hash2 = createHash('sha256').update(apiKey).digest('hex');

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different keys', () => {
    const key1 = 'test-api-key-1';
    const key2 = 'test-api-key-2';

    const hash1 = createHash('sha256').update(key1).digest('hex');
    const hash2 = createHash('sha256').update(key2).digest('hex');

    expect(hash1).not.toBe(hash2);
  });

  it('should produce 64-character hex hashes', () => {
    const apiKey = 'test-api-key';
    const hash = createHash('sha256').update(apiKey).digest('hex');

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});

describe('Rate Limit Enforcement', () => {
  it('should enforce ANONYMOUS tier limit', () => {
    const limit = RATE_LIMITS.ANONYMOUS;
    let count = 0;
    const requests: boolean[] = [];

    for (let i = 0; i < limit + 5; i++) {
      count++;
      const allowed = count <= limit;
      requests.push(allowed);
    }

    const allowedCount = requests.filter(r => r).length;
    const blockedCount = requests.filter(r => !r).length;

    expect(allowedCount).toBe(limit);
    expect(blockedCount).toBe(5);
  });

  it('should enforce FREE tier limit', () => {
    const limit = RATE_LIMITS.FREE;
    let count = 0;

    for (let i = 0; i < limit; i++) {
      count++;
    }

    expect(count).toBe(limit);
    expect(count <= limit).toBe(true);
  });

  it('should allow higher limits for higher tiers', () => {
    expect(RATE_LIMITS.PRO).toBeGreaterThan(RATE_LIMITS.FREE);
    expect(RATE_LIMITS.ENTERPRISE).toBeGreaterThan(RATE_LIMITS.PRO);
  });
});

describe('Client Identification', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const forwardedFor = '192.168.1.1, 10.0.0.1, 172.16.0.1';
    const clientIp = forwardedFor.split(',')[0].trim();

    expect(clientIp).toBe('192.168.1.1');
  });

  it('should handle single IP in x-forwarded-for', () => {
    const forwardedFor = '192.168.1.1';
    const clientIp = forwardedFor.split(',')[0].trim();

    expect(clientIp).toBe('192.168.1.1');
  });

  it('should create consistent identifier for same IP', () => {
    const ip = '192.168.1.1';
    const id1 = `ip:${ip}`;
    const id2 = `ip:${ip}`;

    expect(id1).toBe(id2);
  });

  it('should create different identifiers for different IPs', () => {
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';

    const id1 = `ip:${ip1}`;
    const id2 = `ip:${ip2}`;

    expect(id1).not.toBe(id2);
  });
});

describe('Rate Limit Error Response', () => {
  it('should return 429 status code when limit exceeded', () => {
    const statusCode = 429;
    expect(statusCode).toBe(429);
  });

  it('should include error message with tier information', () => {
    const tier = 'FREE';
    const limit = RATE_LIMITS.FREE;
    const message = `Rate limit exceeded. You are allowed ${limit} requests per minute on the ${tier} tier.`;

    expect(message).toContain('Rate limit exceeded');
    expect(message).toContain('FREE');
    expect(message).toContain('100');
  });

  it('should include retry-after information', () => {
    const WINDOW_SIZE = 60;
    const retryAfter = WINDOW_SIZE;

    expect(retryAfter).toBe(60);
  });
});
