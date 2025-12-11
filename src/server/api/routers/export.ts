/**
 * Export Router
 *
 * API endpoints for data export:
 * - CSV export with streaming
 * - JSON API export with pagination
 */

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "../trpc";

// ============================================
// Types
// ============================================

const ExportTypeSchema = z.enum(["current", "historical", "alerts"]);
const AggregationSchema = z.enum(["raw", "hourly", "daily"]);
const ColumnSchema = z.enum([
  "timestamp",
  "node_address",
  "cpu_percent",
  "ram_percent",
  "ram_used",
  "ram_total",
  "storage_gb",
  "uptime_hours",
  "packets_received",
  "packets_sent",
  "version",
  "is_active",
]);

// ============================================
// Export Router
// ============================================

export const exportRouter = createTRPCRouter({
  /**
   * Get export preview (for UI)
   */
  preview: publicProcedure
    .input(
      z.object({
        type: ExportTypeSchema,
        nodeIds: z.array(z.number()).optional(),
        portfolioSessionId: z.string().optional(),
        dateRange: z
          .object({
            from: z.string(),
            to: z.string(),
          })
          .optional(),
        aggregation: AggregationSchema.default("hourly"),
        columns: z.array(ColumnSchema).default(["timestamp", "node_address", "cpu_percent", "ram_percent", "storage_gb", "uptime_hours"]),
        limit: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get node IDs based on selection
      let nodeIds = input.nodeIds;

      if (input.portfolioSessionId && !nodeIds?.length) {
        const portfolio = await ctx.db.portfolio.findFirst({
          where: { sessionId: input.portfolioSessionId },
          include: { nodes: { select: { nodeId: true } } },
        });
        nodeIds = portfolio?.nodes.map((n) => n.nodeId);
      }

      // Build query based on type
      if (input.type === "current") {
        const nodes = await ctx.db.node.findMany({
          where: nodeIds?.length ? { id: { in: nodeIds } } : undefined,
          include: {
            metrics: {
              orderBy: { time: "desc" },
              take: 1,
            },
          },
          take: input.limit,
        });

        return {
          type: "current" as const,
          totalRows: nodes.length,
          preview: nodes.map((node) => {
            const m = node.metrics[0];
            return {
              node_address: node.address,
              version: node.version,
              is_active: node.isActive,
              cpu_percent: m?.cpuPercent ?? null,
              ram_percent: m?.ramUsed && m?.ramTotal && m.ramTotal > BigInt(0)
                ? Number(m.ramUsed) / Number(m.ramTotal) * 100
                : null,
              ram_used: m?.ramUsed ? Number(m.ramUsed) : null,
              ram_total: m?.ramTotal ? Number(m.ramTotal) : null,
              storage_gb: m?.fileSize ? Number(m.fileSize) / 1e9 : null,
              uptime_hours: m?.uptime ? m.uptime / 3600 : null,
              packets_received: m?.packetsReceived ?? null,
              packets_sent: m?.packetsSent ?? null,
            };
          }),
        };
      }

      if (input.type === "historical") {
        const from = input.dateRange?.from ? new Date(input.dateRange.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const to = input.dateRange?.to ? new Date(input.dateRange.to) : new Date();

        // Get count
        const countResult = await ctx.db.nodeMetric.count({
          where: {
            nodeId: nodeIds?.length ? { in: nodeIds } : undefined,
            time: { gte: from, lte: to },
          },
        });

        // Get preview
        const metrics = await ctx.db.nodeMetric.findMany({
          where: {
            nodeId: nodeIds?.length ? { in: nodeIds } : undefined,
            time: { gte: from, lte: to },
          },
          include: {
            node: { select: { address: true } },
          },
          orderBy: { time: "desc" },
          take: input.limit,
        });

        return {
          type: "historical" as const,
          totalRows: countResult,
          aggregation: input.aggregation,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          preview: metrics.map((m) => ({
            timestamp: m.time.toISOString(),
            node_address: m.node.address,
            cpu_percent: m.cpuPercent,
            ram_percent: m.ramUsed && m.ramTotal && m.ramTotal > BigInt(0)
              ? Number(m.ramUsed) / Number(m.ramTotal) * 100
              : null,
            ram_used: m.ramUsed ? Number(m.ramUsed) : null,
            ram_total: m.ramTotal ? Number(m.ramTotal) : null,
            storage_gb: m.fileSize ? Number(m.fileSize) / 1e9 : null,
            uptime_hours: m.uptime ? m.uptime / 3600 : null,
            packets_received: m.packetsReceived,
            packets_sent: m.packetsSent,
          })),
        };
      }

      if (input.type === "alerts") {
        const alerts = await ctx.db.alert.findMany({
          where: {
            nodeId: nodeIds?.length ? { in: nodeIds } : undefined,
          },
          include: {
            node: { select: { address: true } },
            rule: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });

        const countResult = await ctx.db.alert.count({
          where: {
            nodeId: nodeIds?.length ? { in: nodeIds } : undefined,
          },
        });

        return {
          type: "alerts" as const,
          totalRows: countResult,
          preview: alerts.map((a) => ({
            timestamp: a.createdAt.toISOString(),
            node_address: a.node?.address ?? "N/A",
            rule_name: a.rule.name,
            status: a.status,
            metric: a.metric,
            value: a.value,
            threshold: a.threshold,
            message: a.message,
            acknowledged_at: a.acknowledgedAt?.toISOString() ?? null,
            resolved_at: a.resolvedAt?.toISOString() ?? null,
          })),
        };
      }

      return { type: input.type, totalRows: 0, preview: [] };
    }),

  /**
   * Generate CSV export
   */
  generateCsv: publicProcedure
    .input(
      z.object({
        type: ExportTypeSchema,
        nodeIds: z.array(z.number()).optional(),
        portfolioSessionId: z.string().optional(),
        dateRange: z
          .object({
            from: z.string(),
            to: z.string(),
          })
          .optional(),
        aggregation: AggregationSchema.default("hourly"),
        columns: z.array(ColumnSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get node IDs
      let nodeIds = input.nodeIds;

      if (input.portfolioSessionId && !nodeIds?.length) {
        const portfolio = await ctx.db.portfolio.findFirst({
          where: { sessionId: input.portfolioSessionId },
          include: { nodes: { select: { nodeId: true } } },
        });
        nodeIds = portfolio?.nodes.map((n) => n.nodeId);
      }

      const rows: string[] = [];

      // Add header
      rows.push(input.columns.join(","));

      if (input.type === "current") {
        const nodes = await ctx.db.node.findMany({
          where: nodeIds?.length ? { id: { in: nodeIds } } : undefined,
          include: {
            metrics: {
              orderBy: { time: "desc" },
              take: 1,
            },
          },
        });

        for (const node of nodes) {
          const m = node.metrics[0];
          const row = input.columns.map((col) => {
            switch (col) {
              case "timestamp":
                return m?.time?.toISOString() ?? "";
              case "node_address":
                return node.address;
              case "version":
                return node.version ?? "";
              case "is_active":
                return node.isActive ? "true" : "false";
              case "cpu_percent":
                return m?.cpuPercent?.toFixed(2) ?? "";
              case "ram_percent":
                return m?.ramUsed && m?.ramTotal && m.ramTotal > BigInt(0)
                  ? (Number(m.ramUsed) / Number(m.ramTotal) * 100).toFixed(2)
                  : "";
              case "ram_used":
                return m?.ramUsed ? String(m.ramUsed) : "";
              case "ram_total":
                return m?.ramTotal ? String(m.ramTotal) : "";
              case "storage_gb":
                return m?.fileSize ? (Number(m.fileSize) / 1e9).toFixed(2) : "";
              case "uptime_hours":
                return m?.uptime ? (m.uptime / 3600).toFixed(2) : "";
              case "packets_received":
                return m?.packetsReceived?.toString() ?? "";
              case "packets_sent":
                return m?.packetsSent?.toString() ?? "";
              default:
                return "";
            }
          });
          rows.push(row.join(","));
        }
      } else if (input.type === "historical") {
        const from = input.dateRange?.from ? new Date(input.dateRange.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const to = input.dateRange?.to ? new Date(input.dateRange.to) : new Date();

        // For aggregation, use raw SQL
        if (input.aggregation === "raw") {
          const metrics = await ctx.db.nodeMetric.findMany({
            where: {
              nodeId: nodeIds?.length ? { in: nodeIds } : undefined,
              time: { gte: from, lte: to },
            },
            include: { node: { select: { address: true, version: true, isActive: true } } },
            orderBy: { time: "asc" },
            take: 10000, // Limit to prevent OOM
          });

          for (const m of metrics) {
            const row = input.columns.map((col) => {
              switch (col) {
                case "timestamp":
                  return m.time.toISOString();
                case "node_address":
                  return m.node.address;
                case "version":
                  return m.node.version ?? "";
                case "is_active":
                  return m.node.isActive ? "true" : "false";
                case "cpu_percent":
                  return m.cpuPercent?.toFixed(2) ?? "";
                case "ram_percent":
                  return m.ramUsed && m.ramTotal && m.ramTotal > BigInt(0)
                    ? (Number(m.ramUsed) / Number(m.ramTotal) * 100).toFixed(2)
                    : "";
                case "ram_used":
                  return m.ramUsed ? String(m.ramUsed) : "";
                case "ram_total":
                  return m.ramTotal ? String(m.ramTotal) : "";
                case "storage_gb":
                  return m.fileSize ? (Number(m.fileSize) / 1e9).toFixed(2) : "";
                case "uptime_hours":
                  return m.uptime ? (m.uptime / 3600).toFixed(2) : "";
                case "packets_received":
                  return m.packetsReceived?.toString() ?? "";
                case "packets_sent":
                  return m.packetsSent?.toString() ?? "";
                default:
                  return "";
              }
            });
            rows.push(row.join(","));
          }
        } else {
          // Aggregated query
          const interval = input.aggregation === "hourly" ? "hour" : "day";
          const nodeFilter = nodeIds?.length
            ? Prisma.sql`AND nm.node_id IN (${Prisma.join(nodeIds)})`
            : Prisma.empty;

          const aggregatedData = await ctx.db.$queryRaw<Array<{
            bucket: Date;
            node_address: string;
            avg_cpu: number | null;
            avg_ram_percent: number | null;
            avg_storage: number | null;
            max_uptime: number | null;
            sum_packets_received: bigint | null;
            sum_packets_sent: bigint | null;
          }>>`
            SELECT
              date_trunc(${interval}, nm.time) as bucket,
              n.address as node_address,
              AVG(nm.cpu_percent) as avg_cpu,
              AVG(CASE WHEN nm.ram_total > 0 THEN nm.ram_used::float / nm.ram_total * 100 ELSE NULL END) as avg_ram_percent,
              AVG(nm.file_size) as avg_storage,
              MAX(nm.uptime) as max_uptime,
              SUM(nm.packets_received) as sum_packets_received,
              SUM(nm.packets_sent) as sum_packets_sent
            FROM node_metrics nm
            JOIN nodes n ON nm.node_id = n.id
            WHERE nm.time >= ${from} AND nm.time <= ${to}
            ${nodeFilter}
            GROUP BY bucket, n.address
            ORDER BY bucket ASC
          `;

          for (const m of aggregatedData) {
            const row = input.columns.map((col) => {
              switch (col) {
                case "timestamp":
                  return m.bucket.toISOString();
                case "node_address":
                  return m.node_address;
                case "cpu_percent":
                  return m.avg_cpu?.toFixed(2) ?? "";
                case "ram_percent":
                  return m.avg_ram_percent?.toFixed(2) ?? "";
                case "storage_gb":
                  return m.avg_storage ? (m.avg_storage / 1e9).toFixed(2) : "";
                case "uptime_hours":
                  return m.max_uptime ? (m.max_uptime / 3600).toFixed(2) : "";
                case "packets_received":
                  return m.sum_packets_received?.toString() ?? "";
                case "packets_sent":
                  return m.sum_packets_sent?.toString() ?? "";
                default:
                  return "";
              }
            });
            rows.push(row.join(","));
          }
        }
      } else if (input.type === "alerts") {
        const alerts = await ctx.db.alert.findMany({
          where: {
            nodeId: nodeIds?.length ? { in: nodeIds } : undefined,
          },
          include: {
            node: { select: { address: true } },
            rule: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10000,
        });

        // Override columns for alerts
        rows[0] = "timestamp,node_address,rule_name,status,metric,value,threshold,message,acknowledged_at,resolved_at";

        for (const a of alerts) {
          const row = [
            a.createdAt.toISOString(),
            a.node?.address ?? "N/A",
            `"${a.rule.name.replace(/"/g, '""')}"`,
            a.status,
            a.metric,
            a.value.toString(),
            a.threshold.toString(),
            `"${a.message.replace(/"/g, '""')}"`,
            a.acknowledgedAt?.toISOString() ?? "",
            a.resolvedAt?.toISOString() ?? "",
          ];
          rows.push(row.join(","));
        }
      }

      const csv = rows.join("\n");
      const filename = `pnode-pulse-${input.type}-${new Date().toISOString().split("T")[0]}.csv`;

      return {
        csv,
        filename,
        rowCount: rows.length - 1, // Exclude header
      };
    }),

  // ============================================
  // #63: JSON API Export
  // ============================================

  /**
   * Export nodes as JSON
   */
  nodes: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.pageSize;

      const [nodes, total] = await Promise.all([
        ctx.db.node.findMany({
          where: input.isActive !== undefined ? { isActive: input.isActive } : undefined,
          include: {
            metrics: {
              orderBy: { time: "desc" },
              take: 1,
            },
          },
          skip,
          take: input.pageSize,
          orderBy: { address: "asc" },
        }),
        ctx.db.node.count({
          where: input.isActive !== undefined ? { isActive: input.isActive } : undefined,
        }),
      ]);

      return {
        meta: {
          exportedAt: new Date().toISOString(),
          query: { isActive: input.isActive },
          totalRecords: total,
          page: input.page,
          pageSize: input.pageSize,
        },
        data: nodes.map((node) => {
          const m = node.metrics[0];
          return {
            id: node.id,
            address: node.address,
            pubkey: node.pubkey,
            version: node.version,
            isActive: node.isActive,
            lastSeen: node.lastSeen?.toISOString() ?? null,
            firstSeen: node.firstSeen?.toISOString() ?? null,
            metrics: m
              ? {
                  timestamp: m.time.toISOString(),
                  cpuPercent: m.cpuPercent,
                  ramUsedBytes: m.ramUsed ? Number(m.ramUsed) : null,
                  ramTotalBytes: m.ramTotal ? Number(m.ramTotal) : null,
                  storageBytes: m.fileSize ? Number(m.fileSize) : null,
                  uptimeSeconds: m.uptime,
                  packetsReceived: m.packetsReceived,
                  packetsSent: m.packetsSent,
                }
              : null,
          };
        }),
        pagination: {
          hasMore: skip + nodes.length < total,
          nextPage: skip + nodes.length < total ? input.page + 1 : null,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  /**
   * Export single node with metrics
   */
  node: publicProcedure
    .input(
      z.object({
        nodeId: z.number(),
        metricsFrom: z.string().optional(),
        metricsTo: z.string().optional(),
        metricsAggregation: AggregationSchema.default("hourly"),
        metricsPage: z.number().min(1).default(1),
        metricsPageSize: z.number().min(1).max(1000).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const node = await ctx.db.node.findUnique({
        where: { id: input.nodeId },
        include: {
          peers: {
            take: 100,
            orderBy: { lastSeenAt: "desc" },
          },
        },
      });

      if (!node) {
        return null;
      }

      const from = input.metricsFrom ? new Date(input.metricsFrom) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = input.metricsTo ? new Date(input.metricsTo) : new Date();
      const skip = (input.metricsPage - 1) * input.metricsPageSize;

      const [metrics, metricsTotal] = await Promise.all([
        ctx.db.nodeMetric.findMany({
          where: {
            nodeId: input.nodeId,
            time: { gte: from, lte: to },
          },
          orderBy: { time: "desc" },
          skip,
          take: input.metricsPageSize,
        }),
        ctx.db.nodeMetric.count({
          where: {
            nodeId: input.nodeId,
            time: { gte: from, lte: to },
          },
        }),
      ]);

      return {
        meta: {
          exportedAt: new Date().toISOString(),
          query: {
            nodeId: input.nodeId,
            metricsFrom: from.toISOString(),
            metricsTo: to.toISOString(),
            aggregation: input.metricsAggregation,
          },
        },
        data: {
          id: node.id,
          address: node.address,
          pubkey: node.pubkey,
          version: node.version,
          isActive: node.isActive,
          lastSeen: node.lastSeen?.toISOString() ?? null,
          firstSeen: node.firstSeen?.toISOString() ?? null,
          peers: node.peers.map((p) => ({
            address: p.peerAddress,
            version: p.peerVersion,
            lastSeenAt: p.lastSeenAt.toISOString(),
          })),
          metrics: metrics.map((m) => ({
            timestamp: m.time.toISOString(),
            cpuPercent: m.cpuPercent,
            ramUsedBytes: m.ramUsed ? Number(m.ramUsed) : null,
            ramTotalBytes: m.ramTotal ? Number(m.ramTotal) : null,
            storageBytes: m.fileSize ? Number(m.fileSize) : null,
            uptimeSeconds: m.uptime,
            packetsReceived: m.packetsReceived,
            packetsSent: m.packetsSent,
          })),
        },
        pagination: {
          metricsTotal,
          hasMore: skip + metrics.length < metricsTotal,
          nextPage: skip + metrics.length < metricsTotal ? input.metricsPage + 1 : null,
        },
      };
    }),

  /**
   * Export network overview
   */
  network: publicProcedure.query(async ({ ctx }) => {
    const [totalNodes, activeNodes, versions, latestMetrics] = await Promise.all([
      ctx.db.node.count(),
      ctx.db.node.count({ where: { isActive: true } }),
      ctx.db.node.groupBy({
        by: ["version"],
        _count: { version: true },
        where: { version: { not: null } },
      }),
      ctx.db.$queryRaw<Array<{
        avg_cpu: number;
        avg_ram_percent: number;
        total_storage: bigint;
        avg_uptime: number;
      }>>`
        SELECT
          AVG(cpu_percent) as avg_cpu,
          AVG(CASE WHEN ram_total > 0 THEN ram_used::float / ram_total * 100 ELSE 0 END) as avg_ram_percent,
          SUM(file_size) as total_storage,
          AVG(uptime) as avg_uptime
        FROM node_metrics nm
        INNER JOIN (
          SELECT node_id, MAX(time) as max_time
          FROM node_metrics
          GROUP BY node_id
        ) latest ON nm.node_id = latest.node_id AND nm.time = latest.max_time
      `,
    ]);

    const stats = latestMetrics[0];

    return {
      meta: {
        exportedAt: new Date().toISOString(),
      },
      data: {
        totalNodes,
        activeNodes,
        inactiveNodes: totalNodes - activeNodes,
        uptimePercent: totalNodes > 0 ? (activeNodes / totalNodes) * 100 : 0,
        versionDistribution: versions.map((v) => ({
          version: v.version,
          count: v._count.version,
        })),
        aggregateMetrics: {
          avgCpuPercent: stats?.avg_cpu ?? 0,
          avgRamPercent: stats?.avg_ram_percent ?? 0,
          totalStorageBytes: stats?.total_storage ? Number(stats.total_storage) : 0,
          avgUptimeSeconds: stats?.avg_uptime ?? 0,
        },
      },
    };
  }),

  /**
   * Export alerts
   */
  alerts: publicProcedure
    .input(
      z.object({
        status: z.enum(["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]).optional(),
        nodeId: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.pageSize;
      const where: Prisma.AlertWhereInput = {
        ...(input.status && { status: input.status }),
        ...(input.nodeId && { nodeId: input.nodeId }),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from && { gte: new Date(input.from) }),
                ...(input.to && { lte: new Date(input.to) }),
              },
            }
          : {}),
      };

      const [alerts, total] = await Promise.all([
        ctx.db.alert.findMany({
          where,
          include: {
            node: { select: { address: true } },
            rule: { select: { name: true, metric: true, operator: true, threshold: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: input.pageSize,
        }),
        ctx.db.alert.count({ where }),
      ]);

      return {
        meta: {
          exportedAt: new Date().toISOString(),
          query: {
            status: input.status,
            nodeId: input.nodeId,
            from: input.from,
            to: input.to,
          },
          totalRecords: total,
          page: input.page,
          pageSize: input.pageSize,
        },
        data: alerts.map((a) => ({
          id: a.id,
          nodeAddress: a.node?.address ?? null,
          rule: {
            name: a.rule.name,
            metric: a.rule.metric,
            operator: a.rule.operator,
            threshold: a.rule.threshold,
          },
          status: a.status,
          metric: a.metric,
          value: a.value,
          threshold: a.threshold,
          message: a.message,
          createdAt: a.createdAt.toISOString(),
          acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
          resolvedAt: a.resolvedAt?.toISOString() ?? null,
        })),
        pagination: {
          hasMore: skip + alerts.length < total,
          nextPage: skip + alerts.length < total ? input.page + 1 : null,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),
});
