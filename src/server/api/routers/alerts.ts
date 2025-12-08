/**
 * Alerts Router
 *
 * API endpoints for the alerting system:
 * - Alert rules CRUD
 * - Notification channels management
 * - Alert history and acknowledgment
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  generateVerificationCode,
  sendVerificationEmail,
  testDiscordWebhook,
} from "@/lib/notifications/service";

// Validation schemas
const alertRuleInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  targetType: z.enum(["ALL_NODES", "SPECIFIC_NODES", "BOOKMARKED"]).default("ALL_NODES"),
  nodeIds: z.array(z.number()).default([]),
  metric: z.enum([
    "CPU_PERCENT",
    "RAM_PERCENT",
    "STORAGE_SIZE",
    "UPTIME",
    "NODE_STATUS",
    "PACKETS_RECEIVED",
    "PACKETS_SENT",
  ]),
  operator: z.enum(["GT", "GTE", "LT", "LTE", "EQ", "NEQ"]),
  threshold: z.number(),
  duration: z.number().int().min(0).optional(),
  channels: z.array(z.string()).default([]),
  cooldown: z.number().int().min(60).max(86400).default(300),
});

export const alertsRouter = createTRPCRouter({
  // ============================================
  // Alert Rules
  // ============================================

  /**
   * List all alert rules for the current session/user
   */
  rules: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        userId: z.string().optional(),
        includeDisabled: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      // If userId is provided, use it; otherwise fall back to sessionId
      const whereClause = input.userId
        ? { userId: input.userId }
        : { sessionId: input.sessionId };

      const rules = await ctx.db.alertRule.findMany({
        where: {
          ...whereClause,
          ...(input.includeDisabled ? {} : { isEnabled: true }),
        },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { alerts: true },
          },
        },
      });

      return rules;
    }),

  /**
   * Get a single alert rule by ID
   */
  ruleById: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const rule = await ctx.db.alertRule.findFirst({
        where: {
          id: input.id,
          sessionId: input.sessionId,
        },
        include: {
          alerts: {
            orderBy: { triggeredAt: "desc" },
            take: 10,
          },
        },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert rule not found",
        });
      }

      return rule;
    }),

  /**
   * Create a new alert rule
   */
  createRule: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        userId: z.string().optional(),
        rule: alertRuleInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate node IDs if specific nodes selected
      if (input.rule.targetType === "SPECIFIC_NODES" && input.rule.nodeIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Must select at least one node for SPECIFIC_NODES target",
        });
      }

      const rule = await ctx.db.alertRule.create({
        data: {
          name: input.rule.name,
          description: input.rule.description,
          targetType: input.rule.targetType,
          nodeIds: input.rule.nodeIds,
          metric: input.rule.metric,
          operator: input.rule.operator,
          threshold: input.rule.threshold,
          duration: input.rule.duration,
          channels: input.rule.channels,
          cooldown: input.rule.cooldown,
          sessionId: input.sessionId,
          userId: input.userId,
        },
      });

      return rule;
    }),

  /**
   * Update an existing alert rule
   */
  updateRule: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        rule: alertRuleInput.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const existing = await ctx.db.alertRule.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert rule not found",
        });
      }

      const updated = await ctx.db.alertRule.update({
        where: { id: input.id },
        data: {
          ...input.rule,
          updatedAt: new Date(),
        },
      });

      return updated;
    }),

  /**
   * Toggle alert rule enabled/disabled
   */
  toggleRule: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.alertRule.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert rule not found",
        });
      }

      const updated = await ctx.db.alertRule.update({
        where: { id: input.id },
        data: { isEnabled: input.enabled },
      });

      return updated;
    }),

  /**
   * Delete an alert rule
   */
  deleteRule: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.alertRule.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert rule not found",
        });
      }

      await ctx.db.alertRule.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // ============================================
  // Notification Channels
  // ============================================

  /**
   * List notification channels for the current session
   */
  channels: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const channels = await ctx.db.notificationChannel.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: "desc" },
      });

      // Hide sensitive data
      return channels.map((ch) => ({
        ...ch,
        config: ch.type === "EMAIL"
          ? { address: (ch.config as { address: string }).address }
          : ch.type === "DISCORD"
          ? { serverName: (ch.config as { serverName?: string }).serverName }
          : { username: (ch.config as { username?: string }).username },
        verificationCode: undefined,
      }));
    }),

  /**
   * Add email notification channel
   */
  addEmail: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string().min(1).max(50),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists for this session
      const existing = await ctx.db.notificationChannel.findFirst({
        where: {
          sessionId: input.sessionId,
          type: "EMAIL",
          config: { path: ["address"], equals: input.email },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already added",
        });
      }

      const code = generateVerificationCode();
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const channel = await ctx.db.notificationChannel.create({
        data: {
          type: "EMAIL",
          name: input.name,
          config: { address: input.email },
          sessionId: input.sessionId,
          verificationCode: code,
          verificationExpiry: expiry,
        },
      });

      // Send verification email
      await sendVerificationEmail(input.email, code);

      return {
        id: channel.id,
        message: "Verification code sent to your email",
      };
    }),

  /**
   * Verify email channel
   */
  verifyEmail: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        sessionId: z.string(),
        code: z.string().length(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.notificationChannel.findFirst({
        where: {
          id: input.channelId,
          sessionId: input.sessionId,
          type: "EMAIL",
        },
      });

      if (!channel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel not found",
        });
      }

      if (channel.isVerified) {
        return { success: true, message: "Email already verified" };
      }

      if (!channel.verificationCode || !channel.verificationExpiry) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No verification pending",
        });
      }

      if (new Date() > channel.verificationExpiry) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code expired",
        });
      }

      if (channel.verificationCode !== input.code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }

      await ctx.db.notificationChannel.update({
        where: { id: input.channelId },
        data: {
          isVerified: true,
          verificationCode: null,
          verificationExpiry: null,
        },
      });

      return { success: true, message: "Email verified successfully" };
    }),

  /**
   * Add Discord webhook channel
   */
  addDiscord: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string().min(1).max(50),
        webhookUrl: z.string().url().startsWith("https://discord.com/api/webhooks/"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Test the webhook first
      const isValid = await testDiscordWebhook(input.webhookUrl);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Discord webhook URL or webhook is not responding",
        });
      }

      const channel = await ctx.db.notificationChannel.create({
        data: {
          type: "DISCORD",
          name: input.name,
          config: { webhookUrl: input.webhookUrl },
          sessionId: input.sessionId,
          isVerified: true, // Auto-verified since we tested it
        },
      });

      return { id: channel.id, message: "Discord webhook added successfully" };
    }),

  /**
   * Add Telegram channel (simplified - just stores chat ID)
   */
  addTelegram: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string().min(1).max(50),
        chatId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.notificationChannel.create({
        data: {
          type: "TELEGRAM",
          name: input.name,
          config: { chatId: input.chatId },
          sessionId: input.sessionId,
          isVerified: true, // Will verify on first message
        },
      });

      return { id: channel.id, message: "Telegram channel added" };
    }),

  /**
   * Delete a notification channel
   */
  deleteChannel: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.notificationChannel.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel not found",
        });
      }

      await ctx.db.notificationChannel.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // ============================================
  // Alert History
  // ============================================

  /**
   * Get alert history
   */
  history: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        status: z.enum(["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "SUPPRESSED", "ALL"]).default("ALL"),
        nodeId: z.number().optional(),
        ruleId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // First get rule IDs owned by this session
      const ownedRules = await ctx.db.alertRule.findMany({
        where: { sessionId: input.sessionId },
        select: { id: true },
      });
      const ruleIds = ownedRules.map((r) => r.id);

      if (ruleIds.length === 0) {
        return { alerts: [], total: 0 };
      }

      const where = {
        ruleId: input.ruleId ? input.ruleId : { in: ruleIds },
        ...(input.status !== "ALL" ? { status: input.status } : {}),
        ...(input.nodeId ? { nodeId: input.nodeId } : {}),
      };

      const [alerts, total] = await Promise.all([
        ctx.db.alert.findMany({
          where,
          orderBy: { triggeredAt: "desc" },
          take: input.limit,
          skip: input.offset,
          include: {
            rule: { select: { name: true } },
            node: { select: { address: true } },
          },
        }),
        ctx.db.alert.count({ where }),
      ]);

      return { alerts, total };
    }),

  /**
   * Acknowledge an alert
   */
  acknowledge: publicProcedure
    .input(
      z.object({
        alertId: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through rule
      const alert = await ctx.db.alert.findFirst({
        where: { id: input.alertId },
        include: { rule: { select: { sessionId: true } } },
      });

      if (!alert || alert.rule.sessionId !== input.sessionId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert not found",
        });
      }

      const updated = await ctx.db.alert.update({
        where: { id: input.alertId },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date(),
          acknowledgedBy: input.sessionId,
        },
      });

      return updated;
    }),

  /**
   * Resolve an alert
   */
  resolve: publicProcedure
    .input(
      z.object({
        alertId: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.db.alert.findFirst({
        where: { id: input.alertId },
        include: { rule: { select: { sessionId: true } } },
      });

      if (!alert || alert.rule.sessionId !== input.sessionId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert not found",
        });
      }

      const updated = await ctx.db.alert.update({
        where: { id: input.alertId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });

      return updated;
    }),

  /**
   * Get alert statistics for the session
   */
  stats: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rules = await ctx.db.alertRule.findMany({
        where: { sessionId: input.sessionId },
        select: { id: true },
      });
      const ruleIds = rules.map((r) => r.id);

      if (ruleIds.length === 0) {
        return {
          totalRules: 0,
          enabledRules: 0,
          totalAlerts: 0,
          activeAlerts: 0,
          acknowledgedAlerts: 0,
          resolvedAlerts: 0,
        };
      }

      const [ruleStats, alertStats] = await Promise.all([
        ctx.db.alertRule.aggregate({
          where: { sessionId: input.sessionId },
          _count: { id: true },
        }),
        ctx.db.alert.groupBy({
          by: ["status"],
          where: { ruleId: { in: ruleIds } },
          _count: { id: true },
        }),
      ]);

      const enabledRules = await ctx.db.alertRule.count({
        where: { sessionId: input.sessionId, isEnabled: true },
      });

      const statusCounts = alertStats.reduce(
        (acc, s) => {
          acc[s.status] = s._count.id;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalRules: ruleStats._count.id,
        enabledRules,
        totalAlerts: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        activeAlerts: statusCounts["ACTIVE"] || 0,
        acknowledgedAlerts: statusCounts["ACKNOWLEDGED"] || 0,
        resolvedAlerts: statusCounts["RESOLVED"] || 0,
      };
    }),

  // ============================================
  // Escalation Policies
  // ============================================

  /**
   * List escalation policies
   */
  escalationPolicies: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const policies = await ctx.db.escalationPolicy.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: "desc" },
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
          _count: { select: { rules: true } },
        },
      });

      return policies;
    }),

  /**
   * Get a single escalation policy
   */
  escalationPolicyById: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const policy = await ctx.db.escalationPolicy.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
          rules: { select: { id: true, name: true } },
        },
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Escalation policy not found",
        });
      }

      return policy;
    }),

  /**
   * Create an escalation policy
   */
  createEscalationPolicy: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        steps: z.array(
          z.object({
            delayMinutes: z.number().int().min(1),
            channels: z.array(z.string()).min(1),
            repeatIntervalMinutes: z.number().int().min(5).optional(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.escalationPolicy.create({
        data: {
          name: input.name,
          description: input.description,
          sessionId: input.sessionId,
          steps: {
            create: input.steps.map((step, idx) => ({
              stepOrder: idx + 1,
              delayMinutes: step.delayMinutes,
              channels: step.channels,
              repeatIntervalMinutes: step.repeatIntervalMinutes,
            })),
          },
        },
        include: { steps: true },
      });

      return policy;
    }),

  /**
   * Update an escalation policy
   */
  updateEscalationPolicy: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        steps: z.array(
          z.object({
            delayMinutes: z.number().int().min(1),
            channels: z.array(z.string()).min(1),
            repeatIntervalMinutes: z.number().int().min(5).optional(),
          })
        ).min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.escalationPolicy.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Escalation policy not found",
        });
      }

      // If steps are provided, replace all existing steps
      if (input.steps) {
        await ctx.db.escalationStep.deleteMany({
          where: { policyId: input.id },
        });
      }

      const updated = await ctx.db.escalationPolicy.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          ...(input.steps && {
            steps: {
              create: input.steps.map((step, idx) => ({
                stepOrder: idx + 1,
                delayMinutes: step.delayMinutes,
                channels: step.channels,
                repeatIntervalMinutes: step.repeatIntervalMinutes,
              })),
            },
          }),
        },
        include: { steps: true },
      });

      return updated;
    }),

  /**
   * Delete an escalation policy
   */
  deleteEscalationPolicy: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.escalationPolicy.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Escalation policy not found",
        });
      }

      // Remove policy reference from rules first
      await ctx.db.alertRule.updateMany({
        where: { escalationPolicyId: input.id },
        data: { escalationPolicyId: null },
      });

      await ctx.db.escalationPolicy.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Assign escalation policy to a rule
   */
  assignEscalationPolicy: publicProcedure
    .input(
      z.object({
        ruleId: z.string(),
        policyId: z.string().nullable(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify rule ownership
      const rule = await ctx.db.alertRule.findFirst({
        where: { id: input.ruleId, sessionId: input.sessionId },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert rule not found",
        });
      }

      // Verify policy ownership if assigning
      if (input.policyId) {
        const policy = await ctx.db.escalationPolicy.findFirst({
          where: { id: input.policyId, sessionId: input.sessionId },
        });

        if (!policy) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Escalation policy not found",
          });
        }
      }

      const updated = await ctx.db.alertRule.update({
        where: { id: input.ruleId },
        data: { escalationPolicyId: input.policyId },
      });

      return updated;
    }),

  /**
   * Migrate session alerts to user account
   * Called when a user logs in to associate existing alerts with their account
   */
  migrateToUser: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update all alert rules from this session to the user
      const rulesResult = await ctx.db.alertRule.updateMany({
        where: {
          sessionId: input.sessionId,
          userId: null, // Only migrate rules not already associated
        },
        data: { userId: input.userId },
      });

      // Update all notification channels from this session to the user
      const channelsResult = await ctx.db.notificationChannel.updateMany({
        where: {
          sessionId: input.sessionId,
          userId: null,
        },
        data: { userId: input.userId },
      });

      // Update escalation policies
      const policiesResult = await ctx.db.escalationPolicy.updateMany({
        where: {
          sessionId: input.sessionId,
          userId: null,
        },
        data: { userId: input.userId },
      });

      return {
        migratedRules: rulesResult.count,
        migratedChannels: channelsResult.count,
        migratedPolicies: policiesResult.count,
      };
    }),
});
