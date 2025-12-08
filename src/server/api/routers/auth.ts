/**
 * Auth Router
 *
 * Wallet-based authentication using Solana signature verification.
 * Implements challenge-response authentication flow.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { sign } from "tweetnacl";
import bs58 from "bs58";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";

// JWT secret (should be in env)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "pnode-pulse-jwt-secret-change-in-production"
);
const JWT_ISSUER = "pnode-pulse";
const JWT_AUDIENCE = "pnode-pulse-app";

// Challenge validity period (5 minutes)
const CHALLENGE_VALIDITY_MS = 5 * 60 * 1000;
// JWT validity period (7 days)
const JWT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a secure random nonce
 */
function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate challenge message
 */
function generateChallengeMessage(
  walletAddress: string,
  nonce: string,
  timestamp: Date
): string {
  return `Sign this message to authenticate with pNode Pulse.

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${timestamp.toISOString()}
Domain: ${process.env.NEXT_PUBLIC_APP_URL || "pulse.rectorspace.com"}

This signature will not trigger any blockchain transaction.`;
}

/**
 * Verify Solana signature
 */
function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    return sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Generate JWT token
 */
async function generateToken(userId: string, walletAddress: string): Promise<string> {
  const token = await new SignJWT({
    sub: userId,
    wallet: walletAddress,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify JWT token
 */
async function verifyToken(token: string): Promise<{ userId: string; walletAddress: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return {
      userId: payload.sub as string,
      walletAddress: payload.wallet as string,
    };
  } catch {
    return null;
  }
}

export const authRouter = createTRPCRouter({
  /**
   * Request authentication challenge
   */
  requestChallenge: publicProcedure
    .input(z.object({ walletAddress: z.string().min(32).max(44) }))
    .mutation(async ({ ctx, input }) => {
      // Clean up expired challenges
      await ctx.db.authChallenge.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      // Generate new challenge
      const nonce = generateNonce();
      const timestamp = new Date();
      const expiresAt = new Date(Date.now() + CHALLENGE_VALIDITY_MS);
      const message = generateChallengeMessage(input.walletAddress, nonce, timestamp);

      // Store challenge
      const challenge = await ctx.db.authChallenge.create({
        data: {
          walletAddress: input.walletAddress,
          nonce,
          message,
          expiresAt,
        },
      });

      return {
        challengeId: challenge.id,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
      };
    }),

  /**
   * Verify signature and authenticate
   */
  verifySignature: publicProcedure
    .input(
      z.object({
        challengeId: z.string(),
        walletAddress: z.string().min(32).max(44),
        signature: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find challenge
      const challenge = await ctx.db.authChallenge.findUnique({
        where: { id: input.challengeId },
      });

      if (!challenge) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Challenge not found",
        });
      }

      if (challenge.walletAddress !== input.walletAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Wallet address mismatch",
        });
      }

      if (challenge.expiresAt < new Date()) {
        await ctx.db.authChallenge.delete({ where: { id: input.challengeId } });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Challenge expired",
        });
      }

      // Verify signature
      const isValid = verifySignature(
        challenge.message,
        input.signature,
        input.walletAddress
      );

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid signature",
        });
      }

      // Delete used challenge
      await ctx.db.authChallenge.delete({ where: { id: input.challengeId } });

      // Find or create user
      let user = await ctx.db.user.findUnique({
        where: { walletAddress: input.walletAddress },
      });

      if (!user) {
        user = await ctx.db.user.create({
          data: {
            walletAddress: input.walletAddress,
            lastLoginAt: new Date(),
          },
        });
      } else {
        await ctx.db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      // Generate JWT
      const token = await generateToken(user.id, user.walletAddress);
      const tokenHash = hashToken(token);

      // Create session
      await ctx.db.userSession.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + JWT_VALIDITY_MS),
        },
      });

      return {
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      };
    }),

  /**
   * Verify token and get current user
   */
  me: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        return null;
      }

      // Check session exists
      const tokenHash = hashToken(input.token);
      const session = await ctx.db.userSession.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        return null;
      }

      // Update last used
      await ctx.db.userSession.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });

      // Get user
      const user = await ctx.db.user.findUnique({
        where: { id: verified.userId },
        include: {
          nodeClaims: {
            where: { status: "VERIFIED" },
            select: { nodeId: true, displayName: true },
          },
        },
      });

      if (!user || !user.isActive) {
        return null;
      }

      return {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        preferences: user.preferences,
        claimedNodes: user.nodeClaims,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      };
    }),

  /**
   * Logout (invalidate session)
   */
  logout: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.token);

      await ctx.db.userSession.deleteMany({
        where: { tokenHash },
      });

      return { success: true };
    }),

  /**
   * Logout all sessions
   */
  logoutAll: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      await ctx.db.userSession.deleteMany({
        where: { userId: verified.userId },
      });

      return { success: true };
    }),

  /**
   * Update user profile
   */
  updateProfile: publicProcedure
    .input(
      z.object({
        token: z.string(),
        displayName: z.string().min(1).max(50).optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      const user = await ctx.db.user.update({
        where: { id: verified.userId },
        data: {
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        },
      });

      return {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      };
    }),

  /**
   * Update user preferences
   */
  updatePreferences: publicProcedure
    .input(
      z.object({
        token: z.string(),
        preferences: z.object({
          theme: z.enum(["light", "dark", "system"]).optional(),
          timezone: z.string().optional(),
          dateFormat: z.enum(["US", "EU", "ISO"]).optional(),
          defaultDashboard: z.enum(["network", "portfolio"]).optional(),
          refreshInterval: z.number().min(15).max(300).optional(),
          emailNotifications: z.boolean().optional(),
          showInLeaderboard: z.boolean().optional(),
          publicProfile: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      // Get current preferences
      const user = await ctx.db.user.findUnique({
        where: { id: verified.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Merge preferences
      const currentPrefs = (user.preferences as Record<string, unknown>) || {};
      const newPrefs = { ...currentPrefs, ...input.preferences };

      const updated = await ctx.db.user.update({
        where: { id: verified.userId },
        data: { preferences: newPrefs },
      });

      return {
        preferences: updated.preferences,
      };
    }),

  /**
   * Get active sessions
   */
  sessions: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      const sessions = await ctx.db.userSession.findMany({
        where: {
          userId: verified.userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastUsedAt: "desc" },
      });

      const currentTokenHash = hashToken(input.token);

      return sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        isCurrent: s.tokenHash === currentTokenHash,
      }));
    }),

  /**
   * Revoke specific session
   */
  revokeSession: publicProcedure
    .input(z.object({ token: z.string(), sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      await ctx.db.userSession.deleteMany({
        where: {
          id: input.sessionId,
          userId: verified.userId,
        },
      });

      return { success: true };
    }),
});
