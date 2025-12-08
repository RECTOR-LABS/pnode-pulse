/**
 * Server-side JWT Token Verification
 *
 * Verifies JWT tokens issued during authentication.
 * Used by protected API routes.
 */

import { jwtVerify } from "jose";
import { db } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

export interface TokenPayload {
  userId: string;
  walletAddress: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface VerifyTokenResult {
  valid: boolean;
  userId?: string;
  walletAddress?: string;
  error?: string;
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(token: string): Promise<VerifyTokenResult> {
  try {
    // Verify JWT signature and expiration
    const { payload } = await jwtVerify(token, JWT_SECRET) as { payload: TokenPayload };

    // Check if session exists and is valid
    const session = await db.userSession.findFirst({
      where: {
        userId: payload.userId,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            isActive: true,
          },
        },
      },
    });

    if (!session) {
      return { valid: false, error: "Session not found or expired" };
    }

    if (!session.user.isActive) {
      return { valid: false, error: "User account is disabled" };
    }

    // Update last used timestamp
    await db.userSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      valid: true,
      userId: payload.userId,
      walletAddress: payload.walletAddress,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        return { valid: false, error: "Token expired" };
      }
      return { valid: false, error: error.message };
    }
    return { valid: false, error: "Invalid token" };
  }
}

/**
 * Get user from token (convenience wrapper)
 */
export async function getUserFromToken(token: string) {
  const result = await verifyToken(token);

  if (!result.valid || !result.userId) {
    return null;
  }

  return db.user.findUnique({
    where: { id: result.userId },
    include: {
      nodeClaims: {
        where: { status: "VERIFIED" },
        select: { nodeId: true, displayName: true },
      },
    },
  });
}
