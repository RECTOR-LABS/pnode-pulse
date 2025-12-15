/**
 * JWT Configuration
 *
 * Centralized JWT secret management.
 * - Build time: Uses placeholder (Next.js needs module to load during build)
 * - Production runtime: Fails on first use if JWT_SECRET is missing
 * - Development: Allows placeholder with warning
 */

const BUILD_PLACEHOLDER = "build-time-placeholder-only";

/**
 * Check if we're in Next.js build phase
 * NEXT_PHASE is set to "phase-production-build" during `next build`
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function getJWTSecret(): Uint8Array {
  const JWT_SECRET_ENV = process.env.JWT_SECRET;

  // During build phase, always use placeholder to allow build to succeed
  // The actual secret validation happens at runtime via ensureJWTSecret()
  if (isBuildPhase()) {
    return new TextEncoder().encode(BUILD_PLACEHOLDER);
  }

  // Runtime: Use actual secret or placeholder for dev
  const secretValue = JWT_SECRET_ENV || BUILD_PLACEHOLDER;
  return new TextEncoder().encode(secretValue);
}

export const JWT_SECRET = getJWTSecret();
export const JWT_ISSUER = "pnode-pulse";
export const JWT_AUDIENCE = "pnode-pulse-app";
export const JWT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Validate JWT_SECRET is configured at runtime
 * Call this before any JWT operations to ensure proper configuration
 *
 * Throws error if:
 * - JWT_SECRET is not set
 * - JWT_SECRET is the build placeholder
 * - In production without a real secret
 */
export function ensureJWTSecret(): void {
  // Skip validation during build phase
  if (isBuildPhase()) {
    return;
  }

  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (!secret || secret === BUILD_PLACEHOLDER) {
    if (isProduction) {
      throw new Error(
        "FATAL: JWT_SECRET environment variable must be set in production. " +
        "Generate a secure secret with: openssl rand -base64 32"
      );
    }
    // In development, warn but don't crash (allows testing without env setup)
    console.warn(
      "[JWT] Warning: Using placeholder secret. Set JWT_SECRET for production."
    );
  }
}
