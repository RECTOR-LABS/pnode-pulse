/**
 * Redis Configuration Constants
 *
 * Centralized Redis configuration for all Redis clients.
 * Used by: redis/index.ts, redis/pubsub.ts, queue/index.ts
 */

/**
 * Default Redis port (non-standard to avoid conflicts)
 */
export const DEFAULT_REDIS_PORT = 6381;

/**
 * Get Redis host from environment
 * - Development: allows localhost fallback
 * - Production: requires explicit REDIS_HOST
 */
export function getRedisHost(): string {
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

/**
 * Get Redis port from environment
 */
export function getRedisPort(): number {
  return parseInt(process.env.REDIS_PORT || String(DEFAULT_REDIS_PORT), 10);
}

/**
 * Base Redis connection config
 * Individual clients may extend this with specific options
 */
export interface RedisConnectionConfig {
  host: string;
  port: number;
}

/**
 * Get base Redis connection config
 */
export function getRedisConnectionConfig(): RedisConnectionConfig {
  return {
    host: getRedisHost(),
    port: getRedisPort(),
  };
}
