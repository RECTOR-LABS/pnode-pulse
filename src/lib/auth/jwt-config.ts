/**
 * JWT Configuration
 *
 * Centralized JWT secret management.
 * FAILS FAST if JWT_SECRET is not configured - never use fallback values.
 */

const JWT_SECRET_ENV = process.env.JWT_SECRET;

if (!JWT_SECRET_ENV) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is required but not set. " +
    "Set JWT_SECRET in your .env file before starting the application."
  );
}

export const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_ENV);
export const JWT_ISSUER = "pnode-pulse";
export const JWT_AUDIENCE = "pnode-pulse-app";
export const JWT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
