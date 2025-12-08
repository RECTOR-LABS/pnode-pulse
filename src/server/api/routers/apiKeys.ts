/**
 * API Keys Router
 *
 * Manage API keys for public REST API access.
 * Keys are hashed before storage - the full key is only shown once at creation.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "crypto";
import { jwtVerify } from "jose";

// JWT secret (must match auth router)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "pnode-pulse-jwt-secret-change-in-production"
);
const JWT_ISSUER = "pnode-pulse";
const JWT_AUDIENCE = "pnode-pulse-app";

// API key configuration
const KEY_PREFIX = "pk_live_";
const KEY_LENGTH = 32; // bytes (256 bits)

// Rate limits by tier (requests per minute)
export const RATE_LIMITS = {
  ANONYMOUS: 30,
  FREE: 100,
  PRO: 1000,
  ENTERPRISE: 10000,
} as const;

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

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  const randomPart = randomBytes(KEY_LENGTH).toString("base64url");
  return `${KEY_PREFIX}${randomPart}`;
}

/**
 * Hash an API key for storage
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Extract prefix from API key (for display)
 */
function getKeyPrefix(key: string): string {
  // Return first 16 characters for identification
  return key.substring(0, 16);
}

export const apiKeysRouter = createTRPCRouter({
  /**
   * List all API keys for the authenticated user
   */
  list: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      const keys = await ctx.db.apiKey.findMany({
        where: { userId: verified.userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          tier: true,
          lastUsedAt: true,
          requestCount: true,
          isActive: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
      });

      return keys.map((key) => ({
        ...key,
        requestCount: Number(key.requestCount),
      }));
    }),

  /**
   * Create a new API key
   */
  create: publicProcedure
    .input(
      z.object({
        token: z.string(),
        name: z.string().min(1).max(100),
        scopes: z.array(z.enum(["read", "write", "admin"])).default(["read"]),
        expiresAt: z.date().optional(),
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

      // Check key limit (max 5 active keys for free tier)
      const activeKeyCount = await ctx.db.apiKey.count({
        where: {
          userId: verified.userId,
          isActive: true,
          revokedAt: null,
        },
      });

      if (activeKeyCount >= 5) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Maximum of 5 active API keys allowed. Please revoke an existing key first.",
        });
      }

      // Generate new key
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);
      const prefix = getKeyPrefix(apiKey);

      // Create key record
      const keyRecord = await ctx.db.apiKey.create({
        data: {
          userId: verified.userId,
          name: input.name,
          prefix,
          keyHash,
          scopes: input.scopes,
          tier: "FREE",
          expiresAt: input.expiresAt,
        },
      });

      // Return the full key - this is the ONLY time it will be shown
      return {
        id: keyRecord.id,
        name: keyRecord.name,
        key: apiKey, // Full key - only shown once!
        prefix: keyRecord.prefix,
        scopes: keyRecord.scopes,
        tier: keyRecord.tier,
        expiresAt: keyRecord.expiresAt,
        createdAt: keyRecord.createdAt,
      };
    }),

  /**
   * Get API key details (without the actual key)
   */
  get: publicProcedure
    .input(z.object({ token: z.string(), keyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      const key = await ctx.db.apiKey.findFirst({
        where: {
          id: input.keyId,
          userId: verified.userId,
        },
        include: {
          usageLogs: {
            orderBy: { bucket: "desc" },
            take: 168, // Last 7 days (hourly buckets)
          },
        },
      });

      if (!key) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      // Aggregate usage stats
      const totalRequests = key.usageLogs.reduce((sum, log) => sum + log.requestCount, 0);
      const totalErrors = key.usageLogs.reduce((sum, log) => sum + log.errorCount, 0);
      const avgResponseTime =
        key.usageLogs.length > 0
          ? key.usageLogs.reduce((sum, log) => sum + log.totalResponseMs, 0) / totalRequests
          : 0;

      // Group by endpoint
      const endpointStats = key.usageLogs.reduce(
        (acc, log) => {
          const endpoint = log.endpoint;
          if (!acc[endpoint]) {
            acc[endpoint] = { requests: 0, errors: 0 };
          }
          acc[endpoint].requests += log.requestCount;
          acc[endpoint].errors += log.errorCount;
          return acc;
        },
        {} as Record<string, { requests: number; errors: number }>
      );

      return {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        tier: key.tier,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        requestCount: Number(key.requestCount),
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
        stats: {
          totalRequests,
          totalErrors,
          avgResponseTime: Math.round(avgResponseTime),
          endpointStats,
        },
      };
    }),

  /**
   * Update API key name or scopes
   */
  update: publicProcedure
    .input(
      z.object({
        token: z.string(),
        keyId: z.string(),
        name: z.string().min(1).max(100).optional(),
        scopes: z.array(z.enum(["read", "write", "admin"])).optional(),
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

      const key = await ctx.db.apiKey.findFirst({
        where: {
          id: input.keyId,
          userId: verified.userId,
        },
      });

      if (!key) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      if (key.revokedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot update a revoked key",
        });
      }

      const updated = await ctx.db.apiKey.update({
        where: { id: input.keyId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.scopes !== undefined && { scopes: input.scopes }),
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        prefix: updated.prefix,
        scopes: updated.scopes,
        tier: updated.tier,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      };
    }),

  /**
   * Revoke an API key
   */
  revoke: publicProcedure
    .input(z.object({ token: z.string(), keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      const key = await ctx.db.apiKey.findFirst({
        where: {
          id: input.keyId,
          userId: verified.userId,
        },
      });

      if (!key) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      if (key.revokedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Key is already revoked",
        });
      }

      await ctx.db.apiKey.update({
        where: { id: input.keyId },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });

      return { success: true };
    }),

  /**
   * Rotate an API key (revoke old, create new with same settings)
   */
  rotate: publicProcedure
    .input(z.object({ token: z.string(), keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      const oldKey = await ctx.db.apiKey.findFirst({
        where: {
          id: input.keyId,
          userId: verified.userId,
        },
      });

      if (!oldKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      if (oldKey.revokedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot rotate a revoked key",
        });
      }

      // Generate new key
      const newApiKey = generateApiKey();
      const keyHash = hashApiKey(newApiKey);
      const prefix = getKeyPrefix(newApiKey);

      // Use transaction to revoke old and create new
      const [, newKeyRecord] = await ctx.db.$transaction([
        // Revoke old key
        ctx.db.apiKey.update({
          where: { id: input.keyId },
          data: {
            isActive: false,
            revokedAt: new Date(),
          },
        }),
        // Create new key with same settings
        ctx.db.apiKey.create({
          data: {
            userId: verified.userId,
            name: `${oldKey.name} (rotated)`,
            prefix,
            keyHash,
            scopes: oldKey.scopes as string[],
            tier: oldKey.tier,
            expiresAt: oldKey.expiresAt,
          },
        }),
      ]);

      return {
        id: newKeyRecord.id,
        name: newKeyRecord.name,
        key: newApiKey, // Full key - only shown once!
        prefix: newKeyRecord.prefix,
        scopes: newKeyRecord.scopes,
        tier: newKeyRecord.tier,
        oldKeyId: oldKey.id,
        createdAt: newKeyRecord.createdAt,
      };
    }),

  /**
   * Get usage statistics for a key
   */
  usage: publicProcedure
    .input(
      z.object({
        token: z.string(),
        keyId: z.string(),
        range: z.enum(["24h", "7d", "30d"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const verified = await verifyToken(input.token);

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      const key = await ctx.db.apiKey.findFirst({
        where: {
          id: input.keyId,
          userId: verified.userId,
        },
      });

      if (!key) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      // Calculate time range
      const hoursMap = { "24h": 24, "7d": 168, "30d": 720 };
      const hours = hoursMap[input.range];
      const fromTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const usageLogs = await ctx.db.apiKeyUsage.findMany({
        where: {
          apiKeyId: input.keyId,
          bucket: { gte: fromTime },
        },
        orderBy: { bucket: "asc" },
      });

      // Build time series data
      const timeSeries = usageLogs.map((log) => ({
        time: log.bucket.toISOString(),
        requests: log.requestCount,
        errors: log.errorCount,
        avgLatency:
          log.requestCount > 0 ? Math.round(log.totalResponseMs / log.requestCount) : 0,
      }));

      // Aggregate totals
      const totals = usageLogs.reduce(
        (acc, log) => ({
          requests: acc.requests + log.requestCount,
          errors: acc.errors + log.errorCount,
          totalMs: acc.totalMs + log.totalResponseMs,
        }),
        { requests: 0, errors: 0, totalMs: 0 }
      );

      // Group by endpoint
      const byEndpoint = usageLogs.reduce(
        (acc, log) => {
          if (!acc[log.endpoint]) {
            acc[log.endpoint] = { requests: 0, errors: 0 };
          }
          acc[log.endpoint].requests += log.requestCount;
          acc[log.endpoint].errors += log.errorCount;
          return acc;
        },
        {} as Record<string, { requests: number; errors: number }>
      );

      return {
        keyId: input.keyId,
        range: input.range,
        summary: {
          totalRequests: totals.requests,
          totalErrors: totals.errors,
          errorRate: totals.requests > 0 ? (totals.errors / totals.requests) * 100 : 0,
          avgLatency: totals.requests > 0 ? Math.round(totals.totalMs / totals.requests) : 0,
        },
        timeSeries,
        byEndpoint: Object.entries(byEndpoint).map(([endpoint, stats]) => ({
          endpoint,
          ...stats,
        })),
      };
    }),
});
