/**
 * JWT verification + session lookup.
 *
 * Mirrors src/lib/auth/verify-token.ts from the monolith. JWT is signed
 * with HS256; we additionally check the matching UserSession row so
 * revoked tokens fail even if the JWT itself is still valid.
 */

import { createHash } from "node:crypto";
import { jwtVerify } from "jose";
import { getDb } from "./db";
import { loadConfig } from "../config";

interface VerifiedPrincipal {
  userId: string;
  walletAddress: string;
  sessionId: string;
}

export interface VerifyResult {
  valid: boolean;
  principal?: VerifiedPrincipal;
  error?: string;
}

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(loadConfig().JWT_SECRET);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function verifyToken(token: string): Promise<VerifyResult> {
  try {
    const env = loadConfig();
    const { payload } = await jwtVerify(token, jwtSecret(), {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return { valid: false, error: "Token missing subject" };

    const db = getDb();
    const session = await db.userSession.findFirst({
      where: {
        tokenHash: hashToken(token),
        userId,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, walletAddress: true, isActive: true } },
      },
    });

    if (!session)
      return { valid: false, error: "Session not found or expired" };
    if (!session.user.isActive)
      return { valid: false, error: "User account is disabled" };

    // Fire-and-forget last-used update; failures should not break auth.
    void db.userSession
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return {
      valid: true,
      principal: {
        userId,
        walletAddress: session.user.walletAddress,
        sessionId: session.id,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    if (message.includes("expired"))
      return { valid: false, error: "Token expired" };
    return { valid: false, error: message };
  }
}
