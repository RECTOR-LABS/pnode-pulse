/**
 * JWT Configuration
 *
 * Centralized JWT secret management.
 * Uses placeholder during build, validates at runtime.
 */

function getJWTSecret(): Uint8Array {
  const JWT_SECRET_ENV = process.env.JWT_SECRET;

  // For build-time (when Next.js is collecting page data), use placeholder
  // At actual runtime, this will fail with proper error if not set
  const secretValue = JWT_SECRET_ENV || "build-time-placeholder-only";

  return new TextEncoder().encode(secretValue);
}

export const JWT_SECRET = getJWTSecret();
export const JWT_ISSUER = "pnode-pulse";
export const JWT_AUDIENCE = "pnode-pulse-app";
export const JWT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Validate JWT_SECRET is configured (call at request time, not module load)
 * Throws error if JWT_SECRET is missing or is the build placeholder
 */
export function ensureJWTSecret(): void {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === "build-time-placeholder-only") {
    throw new Error(
      "FATAL: JWT_SECRET environment variable must be set. " +
      "Configure JWT_SECRET in your environment before handling requests."
    );
  }
}
