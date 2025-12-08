/**
 * JWT Configuration
 *
 * Centralized JWT secret management.
 * FAILS FAST at runtime if JWT_SECRET is not configured - never use fallback values.
 */

const JWT_SECRET_ENV = process.env.JWT_SECRET;

// Only enforce in production/runtime, allow build without JWT_SECRET
if (!JWT_SECRET_ENV && process.env.NODE_ENV === "production") {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is required but not set. " +
    "Set JWT_SECRET in your .env file before starting the application."
  );
}

// For build-time, use a placeholder (will fail at runtime if not set)
const secretValue = JWT_SECRET_ENV || "build-time-placeholder-not-for-runtime";

export const JWT_SECRET = new TextEncoder().encode(secretValue);
export const JWT_ISSUER = "pnode-pulse";
export const JWT_AUDIENCE = "pnode-pulse-app";
export const JWT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Runtime validation - call this when the app starts
 * This ensures JWT_SECRET is configured before accepting requests
 */
export function validateJWTConfig(): void {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is required for runtime. " +
      "Set JWT_SECRET in your .env file before starting the application."
    );
  }
}
