/**
 * Reports Router
 *
 * API endpoints for scheduled report management:
 * - Create/update/delete scheduled reports
 * - List reports and delivery history
 * - Manual report generation
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { getReportQueue } from "@/lib/queue";

const ReportTypeSchema = z.enum(["WEEKLY_SUMMARY", "DAILY_DIGEST", "MONTHLY_SLA", "CUSTOM"]);
const ReportScheduleSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]);
const ReportScopeSchema = z.enum(["ALL_NODES", "PORTFOLIO"]);

/**
 * Calculate next send time based on schedule configuration
 */
function calculateNextSendAt(
  schedule: "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM",
  hour: number,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  timezone: string = "UTC"
): Date {
  const now = new Date();
  const next = new Date(now);

  // Set the hour
  next.setUTCHours(hour, 0, 0, 0);

  switch (schedule) {
    case "DAILY":
      // If we've passed today's send time, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case "WEEKLY":
      // dayOfWeek: 0 = Sunday, 1 = Monday, etc.
      const targetDay = dayOfWeek ?? 1; // Default Monday
      const currentDay = next.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      next.setDate(next.getDate() + daysUntil);
      break;

    case "MONTHLY":
      // dayOfMonth: 1-28
      const targetDate = dayOfMonth ?? 1;
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;

    case "CUSTOM":
      // For custom, just use the next occurrence (default daily behavior)
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
  }

  return next;
}

export const reportsRouter = createTRPCRouter({
  /**
   * List scheduled reports for session
   */
  list: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const reports = await ctx.db.scheduledReport.findMany({
        where: { sessionId: input.sessionId },
        include: {
          portfolio: { select: { id: true, name: true } },
          deliveries: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return reports.map((r) => ({
        id: r.id,
        name: r.name,
        reportType: r.reportType,
        schedule: r.schedule,
        timezone: r.timezone,
        sendHour: r.sendHour,
        sendDayOfWeek: r.sendDayOfWeek,
        sendDayOfMonth: r.sendDayOfMonth,
        recipients: r.recipients as string[],
        scope: r.scope,
        portfolio: r.portfolio,
        isEnabled: r.isEnabled,
        lastSentAt: r.lastSentAt,
        nextSendAt: r.nextSendAt,
        recentDeliveries: r.deliveries.map((d) => ({
          id: d.id,
          status: d.status,
          scheduledFor: d.scheduledFor,
          sentAt: d.sentAt,
          error: d.error,
        })),
        createdAt: r.createdAt,
      }));
    }),

  /**
   * Get single report details
   */
  get: publicProcedure
    .input(z.object({ id: z.string(), sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const report = await ctx.db.scheduledReport.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
        include: {
          portfolio: { select: { id: true, name: true } },
          deliveries: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!report) return null;

      return {
        ...report,
        recipients: report.recipients as string[],
        recentDeliveries: report.deliveries,
      };
    }),

  /**
   * Create a new scheduled report
   */
  create: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string().min(1).max(100),
        reportType: ReportTypeSchema,
        schedule: ReportScheduleSchema,
        timezone: z.string().default("UTC"),
        sendHour: z.number().min(0).max(23).default(9),
        sendDayOfWeek: z.number().min(0).max(6).optional(),
        sendDayOfMonth: z.number().min(1).max(28).optional(),
        recipients: z.array(z.string().email()).min(1),
        channelIds: z.array(z.string()).default([]),
        scope: ReportScopeSchema.default("PORTFOLIO"),
        portfolioId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get or create portfolio if scope is PORTFOLIO
      let portfolioId = input.portfolioId;
      if (input.scope === "PORTFOLIO" && !portfolioId) {
        const portfolio = await ctx.db.portfolio.findFirst({
          where: { sessionId: input.sessionId },
        });
        portfolioId = portfolio?.id;
      }

      const nextSendAt = calculateNextSendAt(
        input.schedule,
        input.sendHour,
        input.sendDayOfWeek,
        input.sendDayOfMonth,
        input.timezone
      );

      const report = await ctx.db.scheduledReport.create({
        data: {
          name: input.name,
          reportType: input.reportType,
          schedule: input.schedule,
          timezone: input.timezone,
          sendHour: input.sendHour,
          sendDayOfWeek: input.sendDayOfWeek,
          sendDayOfMonth: input.sendDayOfMonth,
          recipients: input.recipients,
          channelIds: input.channelIds,
          scope: input.scope,
          portfolioId,
          sessionId: input.sessionId,
          nextSendAt,
        },
      });

      return report;
    }),

  /**
   * Update a scheduled report
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        name: z.string().min(1).max(100).optional(),
        schedule: ReportScheduleSchema.optional(),
        timezone: z.string().optional(),
        sendHour: z.number().min(0).max(23).optional(),
        sendDayOfWeek: z.number().min(0).max(6).nullable().optional(),
        sendDayOfMonth: z.number().min(1).max(28).nullable().optional(),
        recipients: z.array(z.string().email()).optional(),
        channelIds: z.array(z.string()).optional(),
        scope: ReportScopeSchema.optional(),
        portfolioId: z.string().nullable().optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db.scheduledReport.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!existing) {
        throw new Error("Report not found");
      }

      // Calculate new next send time if schedule changed
      let nextSendAt = existing.nextSendAt;
      if (input.schedule || input.sendHour !== undefined || input.sendDayOfWeek !== undefined || input.sendDayOfMonth !== undefined) {
        nextSendAt = calculateNextSendAt(
          input.schedule ?? existing.schedule,
          input.sendHour ?? existing.sendHour,
          input.sendDayOfWeek !== undefined ? input.sendDayOfWeek : existing.sendDayOfWeek,
          input.sendDayOfMonth !== undefined ? input.sendDayOfMonth : existing.sendDayOfMonth,
          input.timezone ?? existing.timezone
        );
      }

      const report = await ctx.db.scheduledReport.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.schedule && { schedule: input.schedule }),
          ...(input.timezone && { timezone: input.timezone }),
          ...(input.sendHour !== undefined && { sendHour: input.sendHour }),
          ...(input.sendDayOfWeek !== undefined && { sendDayOfWeek: input.sendDayOfWeek }),
          ...(input.sendDayOfMonth !== undefined && { sendDayOfMonth: input.sendDayOfMonth }),
          ...(input.recipients && { recipients: input.recipients }),
          ...(input.channelIds && { channelIds: input.channelIds }),
          ...(input.scope && { scope: input.scope }),
          ...(input.portfolioId !== undefined && { portfolioId: input.portfolioId }),
          ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
          nextSendAt,
        },
      });

      return report;
    }),

  /**
   * Delete a scheduled report
   */
  delete: publicProcedure
    .input(z.object({ id: z.string(), sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.scheduledReport.deleteMany({
        where: { id: input.id, sessionId: input.sessionId },
      });
      return { success: true };
    }),

  /**
   * Toggle report enabled status
   */
  toggle: publicProcedure
    .input(z.object({ id: z.string(), sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.scheduledReport.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!existing) {
        throw new Error("Report not found");
      }

      const report = await ctx.db.scheduledReport.update({
        where: { id: input.id },
        data: { isEnabled: !existing.isEnabled },
      });

      return report;
    }),

  /**
   * Send report immediately (manual trigger)
   */
  sendNow: publicProcedure
    .input(z.object({ id: z.string(), sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.scheduledReport.findFirst({
        where: { id: input.id, sessionId: input.sessionId },
      });

      if (!report) {
        throw new Error("Report not found");
      }

      // Create delivery record
      const delivery = await ctx.db.reportDelivery.create({
        data: {
          reportId: report.id,
          status: "PENDING",
          recipients: report.recipients as string[],
          scheduledFor: new Date(),
        },
      });

      // Queue report generation
      const queue = getReportQueue();
      await queue.add("generate_report", {
        type: "generate_report",
        reportId: report.id,
        sessionId: input.sessionId,
      });

      return { deliveryId: delivery.id, queued: true };
    }),

  /**
   * Get delivery history for a report
   */
  deliveryHistory: publicProcedure
    .input(
      z.object({
        reportId: z.string(),
        sessionId: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const report = await ctx.db.scheduledReport.findFirst({
        where: { id: input.reportId, sessionId: input.sessionId },
      });

      if (!report) {
        return null;
      }

      const skip = (input.page - 1) * input.pageSize;

      const [deliveries, total] = await Promise.all([
        ctx.db.reportDelivery.findMany({
          where: { reportId: input.reportId },
          orderBy: { createdAt: "desc" },
          skip,
          take: input.pageSize,
        }),
        ctx.db.reportDelivery.count({
          where: { reportId: input.reportId },
        }),
      ]);

      return {
        deliveries: deliveries.map((d) => ({
          ...d,
          recipients: d.recipients as string[],
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Get available timezones (subset of common ones)
   */
  timezones: publicProcedure.query(() => {
    return [
      { value: "UTC", label: "UTC" },
      { value: "America/New_York", label: "Eastern Time (US)" },
      { value: "America/Chicago", label: "Central Time (US)" },
      { value: "America/Denver", label: "Mountain Time (US)" },
      { value: "America/Los_Angeles", label: "Pacific Time (US)" },
      { value: "Europe/London", label: "London" },
      { value: "Europe/Paris", label: "Paris / Berlin" },
      { value: "Asia/Tokyo", label: "Tokyo" },
      { value: "Asia/Singapore", label: "Singapore" },
      { value: "Australia/Sydney", label: "Sydney" },
    ];
  }),
});
