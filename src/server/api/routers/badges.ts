/**
 * Achievement Badges Router
 *
 * tRPC router for managing achievement badges.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { verifyToken } from "@/lib/auth";

// Badge criteria types
interface UptimeCriteria {
  type: "uptime";
  threshold: number; // seconds
}

interface NodeCountCriteria {
  type: "node_count";
  threshold: number;
}

interface StorageCriteria {
  type: "storage";
  threshold: number; // bytes
}

interface EarlyAdopterCriteria {
  type: "early_adopter";
  beforeDate: string; // ISO date
}

interface CpuEfficiencyCriteria {
  type: "cpu_efficiency";
  threshold: number; // max CPU percent
  minUptime: number; // minimum uptime in seconds
}

type BadgeCriteria =
  | UptimeCriteria
  | NodeCountCriteria
  | StorageCriteria
  | EarlyAdopterCriteria
  | CpuEfficiencyCriteria;

export const badgesRouter = createTRPCRouter({
  /**
   * List all available badges
   */
  list: publicProcedure
    .input(z.object({
      tier: z.enum(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const badges = await ctx.db.badge.findMany({
        where: {
          isActive: true,
          tier: input?.tier,
        },
        orderBy: [
          { tier: "asc" },
          { displayOrder: "asc" },
        ],
      });

      return badges;
    }),

  /**
   * Get badge by slug
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const badge = await ctx.db.badge.findUnique({
        where: { slug: input.slug },
        include: {
          operators: {
            include: {
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { earnedAt: "asc" },
            take: 10,
          },
          _count: {
            select: { operators: true },
          },
        },
      });

      if (!badge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge not found" });
      }

      return badge;
    }),

  /**
   * Get user's earned badges
   */
  getMyBadges: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token" });
      }

      const profile = await ctx.db.operatorProfile.findUnique({
        where: { userId: payload.userId },
      });

      if (!profile) {
        return [];
      }

      const badges = await ctx.db.operatorBadge.findMany({
        where: { profileId: profile.id },
        include: { badge: true },
        orderBy: { earnedAt: "desc" },
      });

      return badges;
    }),

  /**
   * Toggle featured status of a badge
   */
  toggleFeatured: publicProcedure
    .input(z.object({
      token: z.string(),
      badgeId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token" });
      }

      const profile = await ctx.db.operatorProfile.findUnique({
        where: { userId: payload.userId },
      });

      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }

      const operatorBadge = await ctx.db.operatorBadge.findFirst({
        where: {
          profileId: profile.id,
          badgeId: input.badgeId,
        },
      });

      if (!operatorBadge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge not found" });
      }

      // Limit featured badges to 6
      if (!operatorBadge.isFeatured) {
        const featuredCount = await ctx.db.operatorBadge.count({
          where: {
            profileId: profile.id,
            isFeatured: true,
          },
        });

        if (featuredCount >= 6) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum 6 badges can be featured",
          });
        }
      }

      const updated = await ctx.db.operatorBadge.update({
        where: { id: operatorBadge.id },
        data: { isFeatured: !operatorBadge.isFeatured },
        include: { badge: true },
      });

      return updated;
    }),

  /**
   * Check and award badges for a user
   */
  checkAndAward: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token" });
      }

      const profile = await ctx.db.operatorProfile.findUnique({
        where: { userId: payload.userId },
        include: { badges: true },
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Create a profile first",
        });
      }

      // Get user's claimed nodes
      const claims = await ctx.db.nodeClaim.findMany({
        where: {
          userId: payload.userId,
          status: "VERIFIED",
        },
        select: { nodeId: true },
      });

      const nodeIds = claims.map((c) => c.nodeId);

      // Get user's stats
      let userStats = {
        totalUptime: 0,
        totalStorage: 0,
        nodeCount: nodeIds.length,
        avgCpu: 0,
      };

      if (nodeIds.length > 0) {
        const stats = await ctx.db.$queryRaw<
          Array<{
            total_uptime: bigint;
            total_storage: bigint;
            avg_cpu: number;
          }>
        >`
          SELECT
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

        if (stats[0]) {
          userStats = {
            totalUptime: Number(stats[0].total_uptime),
            totalStorage: Number(stats[0].total_storage),
            nodeCount: nodeIds.length,
            avgCpu: stats[0].avg_cpu,
          };
        }
      }

      // Get all badges user hasn't earned
      const earnedBadgeIds = profile.badges.map((b) => b.badgeId);
      const availableBadges = await ctx.db.badge.findMany({
        where: {
          isActive: true,
          id: { notIn: earnedBadgeIds },
        },
      });

      const newlyEarned: string[] = [];

      for (const badge of availableBadges) {
        const criteria = badge.criteria as unknown as BadgeCriteria;
        let earned = false;
        let achievementValue = 0;

        switch (criteria.type) {
          case "uptime":
            if (userStats.totalUptime >= criteria.threshold) {
              earned = true;
              achievementValue = userStats.totalUptime;
            }
            break;

          case "node_count":
            if (userStats.nodeCount >= criteria.threshold) {
              earned = true;
              achievementValue = userStats.nodeCount;
            }
            break;

          case "storage":
            if (userStats.totalStorage >= criteria.threshold) {
              earned = true;
              achievementValue = userStats.totalStorage;
            }
            break;

          case "early_adopter":
            if (profile.createdAt < new Date(criteria.beforeDate)) {
              earned = true;
            }
            break;

          case "cpu_efficiency":
            if (
              userStats.avgCpu <= criteria.threshold &&
              userStats.totalUptime >= criteria.minUptime
            ) {
              earned = true;
              achievementValue = userStats.avgCpu;
            }
            break;
        }

        if (earned) {
          await ctx.db.operatorBadge.create({
            data: {
              profileId: profile.id,
              badgeId: badge.id,
              achievementValue,
            },
          });

          // Update badge earned count
          await ctx.db.badge.update({
            where: { id: badge.id },
            data: { earnedCount: { increment: 1 } },
          });

          newlyEarned.push(badge.name);
        }
      }

      return {
        newBadges: newlyEarned,
        message:
          newlyEarned.length > 0
            ? `Congratulations! You earned: ${newlyEarned.join(", ")}`
            : "No new badges earned",
      };
    }),

  /**
   * Seed initial badges (admin only - for setup)
   */
  seedBadges: publicProcedure.mutation(async ({ ctx }) => {
    // Default badges
    const badges = [
      // Common badges
      {
        slug: "first_node",
        name: "First Node",
        description: "Verify ownership of your first pNode",
        icon: "<1",
        tier: "COMMON" as const,
        criteria: { type: "node_count", threshold: 1 },
        displayOrder: 1,
      },
      {
        slug: "getting_started",
        name: "Getting Started",
        description: "Achieve 24 hours of total uptime",
        icon: "ð",
        tier: "COMMON" as const,
        criteria: { type: "uptime", threshold: 86400 },
        displayOrder: 2,
      },
      // Uncommon badges
      {
        slug: "node_collector",
        name: "Node Collector",
        description: "Verify ownership of 5 pNodes",
        icon: "<¯",
        tier: "UNCOMMON" as const,
        criteria: { type: "node_count", threshold: 5 },
        displayOrder: 10,
      },
      {
        slug: "week_warrior",
        name: "Week Warrior",
        description: "Achieve 7 days of total uptime",
        icon: "=Å",
        tier: "UNCOMMON" as const,
        criteria: { type: "uptime", threshold: 604800 },
        displayOrder: 11,
      },
      {
        slug: "storage_starter",
        name: "Storage Starter",
        description: "Contribute 100GB of storage",
        icon: "=¾",
        tier: "UNCOMMON" as const,
        criteria: { type: "storage", threshold: 107374182400 },
        displayOrder: 12,
      },
      // Rare badges
      {
        slug: "fleet_commander",
        name: "Fleet Commander",
        description: "Verify ownership of 10 pNodes",
        icon: "=€",
        tier: "RARE" as const,
        criteria: { type: "node_count", threshold: 10 },
        displayOrder: 20,
      },
      {
        slug: "month_master",
        name: "Month Master",
        description: "Achieve 30 days of total uptime",
        icon: "=Ó",
        tier: "RARE" as const,
        criteria: { type: "uptime", threshold: 2592000 },
        displayOrder: 21,
      },
      {
        slug: "efficiency_expert",
        name: "Efficiency Expert",
        description: "Maintain below 5% avg CPU with 7+ days uptime",
        icon: "¡",
        tier: "RARE" as const,
        criteria: { type: "cpu_efficiency", threshold: 5, minUptime: 604800 },
        displayOrder: 22,
      },
      // Epic badges
      {
        slug: "data_center",
        name: "Data Center",
        description: "Contribute 1TB of storage",
        icon: "<í",
        tier: "EPIC" as const,
        criteria: { type: "storage", threshold: 1099511627776 },
        displayOrder: 30,
      },
      {
        slug: "quarter_champ",
        name: "Quarter Champion",
        description: "Achieve 90 days of total uptime",
        icon: "<Æ",
        tier: "EPIC" as const,
        criteria: { type: "uptime", threshold: 7776000 },
        displayOrder: 31,
      },
      // Legendary badges
      {
        slug: "network_pillar",
        name: "Network Pillar",
        description: "Achieve 365 days of total uptime",
        icon: "=Q",
        tier: "LEGENDARY" as const,
        criteria: { type: "uptime", threshold: 31536000 },
        displayOrder: 40,
      },
      {
        slug: "early_adopter",
        name: "Early Adopter",
        description: "Created profile before 2025",
        icon: "<",
        tier: "LEGENDARY" as const,
        criteria: { type: "early_adopter", beforeDate: "2025-01-01" },
        displayOrder: 41,
      },
    ];

    let created = 0;
    for (const badge of badges) {
      const existing = await ctx.db.badge.findUnique({
        where: { slug: badge.slug },
      });

      if (!existing) {
        await ctx.db.badge.create({ data: badge });
        created++;
      }
    }

    return { created, total: badges.length };
  }),
});
