/**
 * JWT Configuration
 *
 * Centralized JWT secret management.
 * - Build time: Uses placeholder (Next.js needs module to load during build)
 * - Production: Fails immediately if JWT_SECRET is missing
 * - Development: Allows placeholder with warning
 */

const BUILD_PLACEHOLDER = "build-time-placeholder-only";

function getJWTSecret(): Uint8Array {
  const JWT_SECRET_ENV = process.env.JWT_SECRET;
  const NODE_ENV = process.env.NODE_ENV;

  // Production: Fail fast if secret is missing or placeholder
  if (NODE_ENV === "production") {
    if (!JWT_SECRET_ENV || JWT_SECRET_ENV === BUILD_PLACEHOLDER) {
      throw new Error(
        "FATAL: JWT_SECRET environment variable must be set in production. " +
        "Generate a secure secret with: openssl rand -base64 32"
      );
    }
    return new TextEncoder().encode(JWT_SECRET_ENV);
  }

  // Build-time / Development: Use placeholder if not set
  // This allows Next.js build to complete without env vars
  const secretValue = JWT_SECRET_ENV || BUILD_PLACEHOLDER;
  return new TextEncoder().encode(secretValue);
}

export const JWT_SECRET = getJWTSecret();
export const JWT_ISSUER = "pnode-pulse";
export const JWT_AUDIENCE = "pnode-pulse-app";
export const JWT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Validate JWT_SECRET is configured (call at request time for dev safety)
 * Throws error if JWT_SECRET is missing or is the build placeholder
 *
 * Note: In production, this check happens at module load time.
 * This function is for additional runtime validation in development.
 */
export function ensureJWTSecret(): void {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === BUILD_PLACEHOLDER) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable must be set. " +
      "Configure JWT_SECRET in your environment before handling requests."
    );
  }
}
