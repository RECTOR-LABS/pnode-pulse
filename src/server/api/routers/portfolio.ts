/**
 * Portfolio Router
 *
 * API endpoints for managing operator node portfolios:
 * - Portfolio CRUD
 * - Add/remove nodes
 * - Aggregate stats
 * - Performance benchmarking
 * - Uptime/SLA reporting
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const portfolioRouter = createTRPCRouter({
  // ============================================
  // Portfolio Management
  // ============================================

  /**
   * Get or create the user's portfolio
   */
  get: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Find existing portfolio or create one
      let portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
        include: {
          nodes: {
            include: {
              node: {
                include: {
                  metrics: {
                    orderBy: { time: "desc" },
                    take: 1,
                  },
                },
              },
            },
            orderBy: [
              { isStarred: "desc" },
              { addedAt: "desc" },
            ],
          },
        },
      });

      if (!portfolio) {
        portfolio = await ctx.db.portfolio.create({
          data: {
            sessionId: input.sessionId,
            name: "My Portfolio",
          },
          include: {
            nodes: {
              include: {
                node: {
                  include: {
                    metrics: {
                      orderBy: { time: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        });
      }

      return portfolio;
    }),

  /**
   * Get portfolio aggregate stats
   */
  stats: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
        include: {
          nodes: {
            include: {
              node: {
                include: {
                  metrics: {
                    orderBy: { time: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!portfolio || portfolio.nodes.length === 0) {
        return {
          totalNodes: 0,
          activeNodes: 0,
          inactiveNodes: 0,
          totalStorageBytes: BigInt(0),
          avgCpuPercent: 0,
          avgRamPercent: 0,
          avgUptimeSeconds: 0,
        };
      }

      const nodes = portfolio.nodes.map((pn) => pn.node);
      const activeNodes = nodes.filter((n) => n.isActive);

      // Calculate aggregates from latest metrics
      let totalStorage = BigInt(0);
      let totalCpu = 0;
      let totalRam = 0;
      let totalUptime = 0;
      let metricsCount = 0;

      for (const node of nodes) {
        const metric = node.metrics[0];
        if (metric) {
          if (metric.fileSize) totalStorage += metric.fileSize;
          if (metric.cpuPercent !== null) {
            totalCpu += metric.cpuPercent;
            metricsCount++;
          }
          if (metric.ramUsed !== null && metric.ramTotal !== null && metric.ramTotal > 0) {
            totalRam += Number(metric.ramUsed) / Number(metric.ramTotal) * 100;
          }
          if (metric.uptime !== null) {
            totalUptime += metric.uptime;
          }
        }
      }

      return {
        totalNodes: nodes.length,
        activeNodes: activeNodes.length,
        inactiveNodes: nodes.length - activeNodes.length,
        totalStorageBytes: totalStorage,
        avgCpuPercent: metricsCount > 0 ? totalCpu / metricsCount : 0,
        avgRamPercent: metricsCount > 0 ? totalRam / metricsCount : 0,
        avgUptimeSeconds: nodes.length > 0 ? totalUptime / nodes.length : 0,
      };
    }),

  /**
   * Add a node to portfolio by address or pubkey
   */
  addNode: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        identifier: z.string().min(1), // IP address or pubkey
        label: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find the node
      const node = await ctx.db.node.findFirst({
        where: {
          OR: [
            { address: { contains: input.identifier } },
            { pubkey: input.identifier },
          ],
        },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Node not found. Please check the IP address or pubkey.",
        });
      }

      // Get or create portfolio
      let portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
      });

      if (!portfolio) {
        portfolio = await ctx.db.portfolio.create({
          data: {
            sessionId: input.sessionId,
            name: "My Portfolio",
          },
        });
      }

      // Check if already in portfolio
      const existing = await ctx.db.portfolioNode.findUnique({
        where: {
          portfolioId_nodeId: {
            portfolioId: portfolio.id,
            nodeId: node.id,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This node is already in your portfolio.",
        });
      }

      // Add to portfolio
      const portfolioNode = await ctx.db.portfolioNode.create({
        data: {
          portfolioId: portfolio.id,
          nodeId: node.id,
          label: input.label,
        },
        include: {
          node: {
            include: {
              metrics: {
                orderBy: { time: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      return portfolioNode;
    }),

  /**
   * Remove a node from portfolio
   */
  removeNode: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        nodeId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
      });

      if (!portfolio) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portfolio not found.",
        });
      }

      const deleted = await ctx.db.portfolioNode.deleteMany({
        where: {
          portfolioId: portfolio.id,
          nodeId: input.nodeId,
        },
      });

      if (deleted.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Node not found in portfolio.",
        });
      }

      return { success: true };
    }),

  /**
   * Update node in portfolio (label, starred, SLA target)
   */
  updateNode: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        nodeId: z.number(),
        label: z.string().max(50).optional(),
        isStarred: z.boolean().optional(),
        slaTarget: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
      });

      if (!portfolio) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portfolio not found.",
        });
      }

      const updated = await ctx.db.portfolioNode.updateMany({
        where: {
          portfolioId: portfolio.id,
          nodeId: input.nodeId,
        },
        data: {
          ...(input.label !== undefined && { label: input.label }),
          ...(input.isStarred !== undefined && { isStarred: input.isStarred }),
          ...(input.slaTarget !== undefined && { slaTarget: input.slaTarget }),
        },
      });

      if (updated.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Node not found in portfolio.",
        });
      }

      return { success: true };
    }),

  // ============================================
  // Performance Benchmarking (#55)
  // ============================================

  /**
   * Get performance benchmark comparing portfolio nodes to network
   */
  benchmark: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get portfolio nodes with latest metrics
      const portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
        include: {
          nodes: {
            include: {
              node: {
                include: {
                  metrics: {
                    orderBy: { time: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!portfolio || portfolio.nodes.length === 0) {
        return null;
      }

      // Get all network nodes with latest metrics for comparison
      const allNodes = await ctx.db.node.findMany({
        where: { isActive: true },
        include: {
          metrics: {
            orderBy: { time: "desc" },
            take: 1,
          },
        },
      });

      // Calculate network-wide metrics
      const networkMetrics = {
        cpu: [] as number[],
        ram: [] as number[],
        storage: [] as number[],
        uptime: [] as number[],
      };

      for (const node of allNodes) {
        const m = node.metrics[0];
        if (m) {
          if (m.cpuPercent !== null) networkMetrics.cpu.push(m.cpuPercent);
          if (m.ramUsed !== null && m.ramTotal !== null && m.ramTotal > 0) {
            networkMetrics.ram.push(Number(m.ramUsed) / Number(m.ramTotal) * 100);
          }
          if (m.fileSize !== null) networkMetrics.storage.push(Number(m.fileSize));
          if (m.uptime !== null) networkMetrics.uptime.push(m.uptime);
        }
      }

      // Calculate portfolio averages
      const portfolioMetrics = {
        cpu: [] as number[],
        ram: [] as number[],
        storage: [] as number[],
        uptime: [] as number[],
      };

      for (const pn of portfolio.nodes) {
        const m = pn.node.metrics[0];
        if (m) {
          if (m.cpuPercent !== null) portfolioMetrics.cpu.push(m.cpuPercent);
          if (m.ramUsed !== null && m.ramTotal !== null && m.ramTotal > 0) {
            portfolioMetrics.ram.push(Number(m.ramUsed) / Number(m.ramTotal) * 100);
          }
          if (m.fileSize !== null) portfolioMetrics.storage.push(Number(m.fileSize));
          if (m.uptime !== null) portfolioMetrics.uptime.push(m.uptime);
        }
      }

      // Helper functions
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const percentile = (value: number, arr: number[], lowerIsBetter: boolean) => {
        if (arr.length === 0) return 50;
        const sorted = [...arr].sort((a, b) => a - b);
        const count = lowerIsBetter
          ? sorted.filter((v) => v >= value).length
          : sorted.filter((v) => v <= value).length;
        return Math.round((count / sorted.length) * 100);
      };

      return {
        cpu: {
          yourValue: avg(portfolioMetrics.cpu),
          networkAvg: avg(networkMetrics.cpu),
          percentile: percentile(avg(portfolioMetrics.cpu), networkMetrics.cpu, true), // Lower CPU is better
        },
        ram: {
          yourValue: avg(portfolioMetrics.ram),
          networkAvg: avg(networkMetrics.ram),
          percentile: percentile(avg(portfolioMetrics.ram), networkMetrics.ram, true), // Lower RAM is better
        },
        storage: {
          yourValue: avg(portfolioMetrics.storage),
          networkAvg: avg(networkMetrics.storage),
          percentile: percentile(avg(portfolioMetrics.storage), networkMetrics.storage, false), // Higher storage is better
        },
        uptime: {
          yourValue: avg(portfolioMetrics.uptime),
          networkAvg: avg(networkMetrics.uptime),
          percentile: percentile(avg(portfolioMetrics.uptime), networkMetrics.uptime, false), // Higher uptime is better
        },
        nodeCount: portfolio.nodes.length,
        networkNodeCount: allNodes.length,
      };
    }),

  // ============================================
  // Uptime & SLA Reporting (#56)
  // ============================================

  /**
   * Get uptime report for portfolio nodes
   */
  uptimeReport: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        nodeId: z.number().optional(), // Specific node, or all portfolio nodes
        period: z.enum(["day", "week", "month"]).default("month"),
      })
    )
    .query(async ({ ctx, input }) => {
      const portfolio = await ctx.db.portfolio.findFirst({
        where: { sessionId: input.sessionId },
        include: { nodes: true },
      });

      if (!portfolio) {
        return null;
      }

      // Determine time range
      const now = new Date();
      let from: Date;
      switch (input.period) {
        case "day":
          from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "week":
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
        default:
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get node IDs to query
      const nodeIds = input.nodeId
        ? [input.nodeId]
        : portfolio.nodes.map((pn) => pn.nodeId);

      if (nodeIds.length === 0) {
        return {
          period: { from, to: now },
          totalMinutes: Math.round((now.getTime() - from.getTime()) / 60000),
          downtimeMinutes: 0,
          uptimePercent: 100,
          incidents: [],
          nodes: [],
        };
      }

      // Get uptime events for the period
      const events = await ctx.db.uptimeEvent.findMany({
        where: {
          nodeId: { in: nodeIds },
          timestamp: { gte: from },
        },
        orderBy: { timestamp: "asc" },
        include: {
          node: { select: { address: true } },
        },
      });

      // Get portfolio node details for SLA targets
      const portfolioNodes = await ctx.db.portfolioNode.findMany({
        where: {
          portfolioId: portfolio.id,
          nodeId: { in: nodeIds },
        },
        include: {
          node: { select: { id: true, address: true, isActive: true } },
        },
      });

      // Calculate uptime per node
      const totalMinutes = Math.round((now.getTime() - from.getTime()) / 60000);
      const nodeStats: Array<{
        nodeId: number;
        address: string;
        slaTarget: number | null;
        downtimeMinutes: number;
        uptimePercent: number;
        meetsSla: boolean;
        incidents: Array<{
          start: Date;
          end: Date | null;
          durationMinutes: number;
        }>;
      }> = [];

      for (const pn of portfolioNodes) {
        const nodeEvents = events.filter((e) => e.nodeId === pn.nodeId);
        let downtimeMinutes = 0;
        const incidents: Array<{
          start: Date;
          end: Date | null;
          durationMinutes: number;
        }> = [];

        // Calculate downtime from events
        let lastOffline: Date | null = null;
        for (const event of nodeEvents) {
          if (event.eventType === "OFFLINE") {
            lastOffline = event.timestamp;
          } else if (event.eventType === "ONLINE" && lastOffline) {
            const duration = Math.round((event.timestamp.getTime() - lastOffline.getTime()) / 60000);
            downtimeMinutes += duration;
            incidents.push({
              start: lastOffline,
              end: event.timestamp,
              durationMinutes: duration,
            });
            lastOffline = null;
          }
        }

        // If still offline, count until now
        if (lastOffline || !pn.node.isActive) {
          const offlineStart = lastOffline || from;
          const duration = Math.round((now.getTime() - offlineStart.getTime()) / 60000);
          downtimeMinutes += duration;
          incidents.push({
            start: offlineStart,
            end: null,
            durationMinutes: duration,
          });
        }

        const uptimePercent = totalMinutes > 0
          ? ((totalMinutes - downtimeMinutes) / totalMinutes) * 100
          : 100;

        nodeStats.push({
          nodeId: pn.nodeId,
          address: pn.node.address,
          slaTarget: pn.slaTarget,
          downtimeMinutes,
          uptimePercent,
          meetsSla: pn.slaTarget ? uptimePercent >= pn.slaTarget : true,
          incidents,
        });
      }

      // Aggregate stats
      const totalDowntime = nodeStats.reduce((sum, n) => sum + n.downtimeMinutes, 0);
      const avgDowntime = nodeStats.length > 0 ? totalDowntime / nodeStats.length : 0;
      const avgUptime = totalMinutes > 0
        ? ((totalMinutes - avgDowntime) / totalMinutes) * 100
        : 100;

      return {
        period: { from, to: now },
        totalMinutes,
        downtimeMinutes: Math.round(avgDowntime),
        uptimePercent: Math.round(avgUptime * 100) / 100,
        incidents: nodeStats.flatMap((n) =>
          n.incidents.map((i) => ({
            ...i,
            nodeAddress: n.address,
          }))
        ).sort((a, b) => b.start.getTime() - a.start.getTime()),
        nodes: nodeStats,
      };
    }),
});
