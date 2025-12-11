/**
 * API Constants
 *
 * Shared constants for API rate limiting and configuration.
 * This file should NOT import any server-only modules.
 */

// Rate limits by tier (requests per minute)
export const RATE_LIMITS = {
  ANONYMOUS: 30,
  FREE: 100,
  PRO: 1000,
  ENTERPRISE: 10000,
} as const;

export type RateLimitTier = keyof typeof RATE_LIMITS;

// Rate limit headers type
export type RateLimitHeaders = Record<string, string>;

// Rate limit result type
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  tier: RateLimitTier;
  apiKeyId?: string;
}
