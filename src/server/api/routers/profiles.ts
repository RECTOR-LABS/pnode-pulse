/**
 * Operator Profile Router
 *
 * tRPC router for managing public operator profiles.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { verifyToken } from "@/lib/auth";

// Input schemas
const updateProfileInput = z.object({
  token: z.string(),
  displayName: z.string().min(3).max(32).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  links: z.array(z.object({
    type: z.enum(["website", "twitter", "discord", "github", "telegram"]),
    url: z.string().url(),
  })).max(5).optional(),
  isPublic: z.boolean().optional(),
  showNodeStats: z.boolean().optional(),
  showBadges: z.boolean().optional(),
});

export const profilesRouter = createTRPCRouter({
  /**
   * Get current user's profile
   */
  getMyProfile: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload.valid || !payload.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: payload.error || "Invalid token" });
      }

      const profile = await ctx.db.operatorProfile.findUnique({
        where: { userId: payload.userId },
        include: {
          badges: {
            include: { badge: true },
            orderBy: { earnedAt: "desc" },
          },
        },
      });

      if (!profile) {
        // Return null - profile not created yet
        return null;
      }

      return profile;
    }),

  /**
   * Get public profile by display name
   */
  getByName: publicProcedure
    .input(z.object({ displayName: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.operatorProfile.findFirst({
        where: {
          displayName: input.displayName,
          isPublic: true,
        },
        include: {
          badges: {
            where: { isFeatured: true },
            include: { badge: true },
            take: 6,
          },
        },
      });

      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }

      // Don't expose private fields
      return {
        id: profile.id,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        links: profile.links,
        totalNodes: profile.showNodeStats ? profile.totalNodes : null,
        totalUptime: profile.showNodeStats ? profile.totalUptime : null,
        totalStorage: profile.showNodeStats ? profile.totalStorage : null,
        avgCpuEfficiency: profile.showNodeStats ? profile.avgCpuEfficiency : null,
        rank: profile.rank,
        badges: profile.showBadges ? profile.badges : [],
        createdAt: profile.createdAt,
      };
    }),

  /**
   * Create operator profile
   */
  create: publicProcedure
    .input(z.object({
      token: z.string(),
      displayName: z.string().min(3).max(32),
      bio: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload.valid || !payload.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: payload.error || "Invalid token" });
      }

      const userId = payload.userId;

      // Check if profile already exists
      const existing = await ctx.db.operatorProfile.findUnique({
        where: { userId },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Profile already exists",
        });
      }

      // Check if display name is taken
      const nameTaken = await ctx.db.operatorProfile.findFirst({
        where: { displayName: input.displayName },
      });

      if (nameTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Display name is already taken",
        });
      }

      // Get user's node stats
      const claims = await ctx.db.nodeClaim.findMany({
        where: {
          userId,
          status: "VERIFIED",
        },
        select: { nodeId: true },
      });

      const nodeIds = claims.map((c) => c.nodeId);
      let totalNodes = 0;
      let totalUptime = BigInt(0);
      let totalStorage = BigInt(0);
      let avgCpu = 0;

      if (nodeIds.length > 0) {
        const nodeStats = await ctx.db.$queryRaw<
          Array<{
            node_count: number;
            total_uptime: bigint;
            total_storage: bigint;
            avg_cpu: number;
          }>
        >`
          SELECT
            COUNT(DISTINCT n.id) as node_count,
            COALESCE(SUM(m.uptime), 0) as total_uptime,
            COALESCE(SUM(m."fileSize"), 0) as total_storage,
            COALESCE(AVG(m."cpuPercent"), 0) as avg_cpu
          FROM "Node" n
          LEFT JOIN (
            SELECT DISTINCT ON ("nodeId") *
            FROM "NodeMetric"
            ORDER BY "nodeId", time DESC
          ) m ON m."nodeId" = n.id
          WHERE n.id = ANY(${nodeIds})
        `;

        if (nodeStats[0]) {
          totalNodes = nodeStats[0].node_count;
          totalUptime = nodeStats[0].total_uptime;
          totalStorage = nodeStats[0].total_storage;
          avgCpu = nodeStats[0].avg_cpu;
        }
      }

      // Create profile
      const profile = await ctx.db.operatorProfile.create({
        data: {
          userId,
          displayName: input.displayName,
          bio: input.bio,
          totalNodes,
          totalUptime,
          totalStorage,
          avgCpuEfficiency: avgCpu,
        },
      });

      return profile;
    }),

  /**
   * Update operator profile
   */
  update: publicProcedure
    .input(updateProfileInput)
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload.valid || !payload.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: payload.error || "Invalid token" });
      }

      const profile = await ctx.db.operatorProfile.findUnique({
        where: { userId: payload.userId },
      });

      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }

      // Check if new display name is taken
      if (input.displayName && input.displayName !== profile.displayName) {
        const nameTaken = await ctx.db.operatorProfile.findFirst({
          where: { displayName: input.displayName },
        });

        if (nameTaken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Display name is already taken",
          });
        }
      }

      const updated = await ctx.db.operatorProfile.update({
        where: { userId: payload.userId },
        data: {
          displayName: input.displayName,
          bio: input.bio,
          avatarUrl: input.avatarUrl,
          links: input.links,
          isPublic: input.isPublic,
          showNodeStats: input.showNodeStats,
          showBadges: input.showBadges,
        },
      });

      return updated;
    }),

  /**
   * Get leaderboard of top operators
   */
  leaderboard: publicProcedure
    .input(z.object({
      metric: z.enum(["uptime", "nodes", "storage"]).default("uptime"),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const orderBy = {
        uptime: { totalUptime: "desc" as const },
        nodes: { totalNodes: "desc" as const },
        storage: { totalStorage: "desc" as const },
      }[input.metric];

      const profiles = await ctx.db.operatorProfile.findMany({
        where: { isPublic: true },
        orderBy,
        take: input.limit,
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          totalNodes: true,
          totalUptime: true,
          totalStorage: true,
          rank: true,
          badges: {
            where: { isFeatured: true },
            include: { badge: true },
            take: 3,
          },
        },
      });

      return profiles.map((p, i) => ({
        ...p,
        rank: i + 1,
      }));
    }),

  /**
   * Refresh profile stats (call periodically)
   */
  refreshStats: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload.valid || !payload.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: payload.error || "Invalid token" });
      }

      // Get verified node claims
      const claims = await ctx.db.nodeClaim.findMany({
        where: {
          userId: payload.userId,
          status: "VERIFIED",
        },
        select: { nodeId: true },
      });

      const nodeIds = claims.map((c) => c.nodeId);

      if (nodeIds.length === 0) {
        return { updated: false, message: "No verified nodes" };
      }

      // Calculate stats
      const nodeStats = await ctx.db.$queryRaw<
        Array<{
          node_count: number;
          total_uptime: bigint;
          total_storage: bigint;
          avg_cpu: number;
        }>
      >`
        SELECT
          COUNT(DISTINCT n.id) as node_count,
          COALESCE(SUM(m.uptime), 0) as total_uptime,
          COALESCE(SUM(m."fileSize"), 0) as total_storage,
          COALESCE(AVG(m."cpuPercent"), 0) as avg_cpu
        FROM "Node" n
        LEFT JOIN (
          SELECT DISTINCT ON ("nodeId") *
          FROM "NodeMetric"
          ORDER BY "nodeId", time DESC
        ) m ON m."nodeId" = n.id
        WHERE n.id = ANY(${nodeIds})
      `;

      if (nodeStats[0]) {
        await ctx.db.operatorProfile.update({
          where: { userId: payload.userId },
          data: {
            totalNodes: nodeStats[0].node_count,
            totalUptime: nodeStats[0].total_uptime,
            totalStorage: nodeStats[0].total_storage,
            avgCpuEfficiency: nodeStats[0].avg_cpu,
          },
        });
      }

      return { updated: true };
    }),
});
