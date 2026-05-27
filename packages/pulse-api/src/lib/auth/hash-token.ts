/**
 * Token Hashing Utility
 *
 * Hashes JWT tokens for secure storage and lookup.
 * Uses SHA-256 to create a deterministic hash that can be stored
 * in the database without exposing the actual token.
 */

import { createHash } from "crypto";

/**
 * Hash a JWT token using SHA-256
 * @param token - The JWT token to hash
 * @returns Hex-encoded SHA-256 hash of the token
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
