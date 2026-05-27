/**
 * /v1/nodes/* — read-only node data.
 *
 * Mirrors the legacy tRPC `nodes` router exactly, so the tRPC strangler
 * proxy can return responses unchanged. Public reads (no JWT), but uses
 * the public-api middleware (rate-limit + optional API-key tier).
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getDb } from "../lib/db";
import { ok } from "../middleware/json";
import { notFound } from "../lib/errors";
import { publicApi } from "../middleware/public-api";

export const nodesRouter = new Hono();
nodesRouter.use("*", publicApi());

const listQuerySchema = z.object({
  status: z.enum(["all", "active", "inactive"]).default("all"),
  version: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z
    .enum(["lastSeen", "firstSeen", "address", "version", "isActive"])
    .default("lastSeen"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const buildWhere = (
  input: z.infer<typeof listQuerySchema>,
): Prisma.NodeWhereInput | undefined => {
  const where: Prisma.NodeWhereInput = {};
  if (input.status === "active") where.isActive = true;
  if (input.status === "inactive") where.isActive = false;
  if (input.version) where.version = input.version;
  if (input.search) {
    where.OR = [
      { address: { contains: input.search, mode: "insensitive" } },
      { pubkey: { contains: input.search, mode: "insensitive" } },
    ];
  }
  return Object.keys(where).length > 0 ? where : undefined;
};

// GET /v1/nodes
nodesRouter.get("/", zValidator("query", listQuerySchema), async (c) => {
  const input = c.req.valid("query");
  const db = getDb();
  const where = buildWhere(input);
  const [nodes, total] = await Promise.all([
    db.node.findMany({
      where,
      take: input.limit,
      skip: input.offset,
      orderBy: { [input.orderBy]: input.order },
      include: { _count: { select: { metrics: true } } },
    }),
    db.node.count({ where }),
  ]);
  return ok(c, { nodes, total, hasMore: input.offset + nodes.length < total });
});

// GET /v1/nodes/versions
nodesRouter.get("/versions", async (c) => {
  const db = getDb();
  const versions = await db.node.groupBy({
    by: ["version"],
    where: { version: { not: null } },
    _count: { id: true },
  });
  const result = versions
    .filter((v) => v.version !== null)
    .map((v) => ({ version: v.version as string, count: v._count.id }))
    .sort((a, b) => b.count - a.count);
  return ok(c, result);
});

// GET /v1/nodes/summary
nodesRouter.get("/summary", async (c) => {
  const db = getDb();
  const [totalNodes, activeNodes] = await Promise.all([
    db.node.count(),
    db.node.count({ where: { isActive: true } }),
  ]);
  const latestMetrics = await db.$queryRaw<
    Array<{
      total_storage: bigint;
      avg_cpu: number;
      avg_ram_percent: number;
      avg_uptime: number;
    }>
  >`
    SELECT
      COALESCE(SUM(file_size), 0) as total_storage,
      COALESCE(AVG(cpu_percent), 0) as avg_cpu,
      COALESCE(AVG(ram_used::float / NULLIF(ram_total, 0) * 100), 0) as avg_ram_percent,
      COALESCE(AVG(uptime), 0) as avg_uptime
    FROM (
      SELECT DISTINCT ON (node_id) *
      FROM node_metrics
      ORDER BY node_id, time DESC
    ) latest
  `;
  const stats = latestMetrics[0] ?? {
    total_storage: BigInt(0),
    avg_cpu: 0,
    avg_ram_percent: 0,
    avg_uptime: 0,
  };
  return ok(c, {
    totalNodes,
    activeNodes,
    totalStorage: stats.total_storage,
    avgCpu: stats.avg_cpu,
    avgRamPercent: stats.avg_ram_percent,
    avgUptime: stats.avg_uptime,
  });
});

// GET /v1/nodes/list-with-metrics
nodesRouter.get(
  "/list-with-metrics",
  zValidator("query", listQuerySchema),
  async (c) => {
    const input = c.req.valid("query");
    const db = getDb();
    const where = buildWhere(input);
    const [nodes, total] = await Promise.all([
      db.node.findMany({
        where,
        take: input.limit,
        skip: input.offset,
        orderBy: { [input.orderBy]: input.order },
      }),
      db.node.count({ where }),
    ]);

    const nodeIds = nodes.map((n) => n.id);
    const latest =
      nodeIds.length === 0
        ? []
        : await db.$queryRaw<
            Array<{
              node_id: number;
              cpu_percent: number;
              ram_used: bigint;
              ram_total: bigint;
              file_size: bigint;
              uptime: number;
            }>
          >`
          SELECT DISTINCT ON (node_id)
            node_id, cpu_percent, ram_used, ram_total, file_size, uptime
          FROM node_metrics
          WHERE node_id = ANY(${nodeIds})
          ORDER BY node_id, time DESC
        `;

    const map = new Map(
      latest.map((m) => [
        m.node_id,
        {
          cpuPercent: m.cpu_percent,
          ramUsed: m.ram_used,
          ramTotal: m.ram_total,
          ramPercent:
            m.ram_total > BigInt(0)
              ? Number((m.ram_used * BigInt(100)) / m.ram_total)
              : 0,
          fileSize: m.file_size,
          uptime: m.uptime,
        },
      ]),
    );

    return ok(c, {
      nodes: nodes.map((n) => ({ ...n, latestMetric: map.get(n.id) ?? null })),
      total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + nodes.length < total,
    });
  },
);

// GET /v1/nodes/leaderboard
const leaderboardSchema = z.object({
  metric: z.enum(["uptime", "cpu", "ram", "storage"]).default("uptime"),
  order: z.enum(["top", "bottom"]).default("top"),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

nodesRouter.get(
  "/leaderboard",
  zValidator("query", leaderboardSchema),
  async (c) => {
    const { metric, order, limit } = c.req.valid("query");
    const db = getDb();

    type Row = {
      node_id: number;
      address: string;
      version: string | null;
      cpu_percent: number | null;
      ram_percent: number | null;
      file_size: bigint | null;
      uptime: number | null;
    };

    // Parameterized templates per metric × order — never interpolate column names into raw SQL.
    let result: Row[];

    if (metric === "uptime") {
      result =
        order === "top"
          ? await db.$queryRaw<Row[]>`
            WITH latest_metrics AS (
              SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                nm.file_size, nm.uptime
              FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
              WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
            )
            SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
            FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
            WHERE n.is_active = true
            ORDER BY lm.uptime DESC NULLS LAST LIMIT ${limit}`
          : await db.$queryRaw<Row[]>`
            WITH latest_metrics AS (
              SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                nm.file_size, nm.uptime
              FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
              WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
            )
            SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
            FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
            WHERE n.is_active = true
            ORDER BY lm.uptime ASC NULLS LAST LIMIT ${limit}`;
    } else if (metric === "cpu") {
      result =
        order === "top"
          ? await db.$queryRaw<Row[]>`
            WITH latest_metrics AS (
              SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                nm.file_size, nm.uptime
              FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
              WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
            )
            SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
            FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
            WHERE n.is_active = true
            ORDER BY lm.cpu_percent ASC NULLS LAST LIMIT ${limit}`
          : await db.$queryRaw<Row[]>`
            WITH latest_metrics AS (
              SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                nm.file_size, nm.uptime
              FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
              WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
            )
            SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
            FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
            WHERE n.is_active = true
            ORDER BY lm.cpu_percent DESC NULLS LAST LIMIT ${limit}`;
    } else if (metric === "ram") {
      result =
        order === "top"
          ? await db.$queryRaw<Row[]>`
            WITH latest_metrics AS (
              SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                nm.file_size, nm.uptime
              FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
              WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
            )
            SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
            FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
            WHERE n.is_active = true
            ORDER BY lm.ram_percent ASC NULLS LAST LIMIT ${limit}`
          : await db.$queryRaw<Row[]>`
            WITH latest_metrics AS (
              SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                nm.file_size, nm.uptime
              FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
              WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
            )
            SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
            FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
            WHERE n.is_active = true
            ORDER BY lm.ram_percent DESC NULLS LAST LIMIT ${limit}`;
    } else {
      // storage: higher is better
      result =
        order === "top"
          ? await db.$queryRaw<Row[]>`
            WITH latest_metrics AS (
              SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                nm.file_size, nm.uptime
              FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
              WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
            )
            SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
            FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
            WHERE n.is_active = true
            ORDER BY lm.file_size DESC NULLS LAST LIMIT ${limit}`
          : await db.$queryRaw<Row[]>`
            WITH latest_metrics AS (
              SELECT DISTINCT ON (nm.node_id) nm.node_id, nm.cpu_percent,
                CASE WHEN nm.ram_total > 0 THEN (nm.ram_used::float / nm.ram_total * 100) ELSE 0 END as ram_percent,
                nm.file_size, nm.uptime
              FROM node_metrics nm JOIN nodes n ON n.id = nm.node_id
              WHERE n.is_active = true ORDER BY nm.node_id, nm.time DESC
            )
            SELECT n.id as node_id, n.address, n.version, lm.cpu_percent, lm.ram_percent, lm.file_size, lm.uptime
            FROM nodes n JOIN latest_metrics lm ON lm.node_id = n.id
            WHERE n.is_active = true
            ORDER BY lm.file_size ASC NULLS LAST LIMIT ${limit}`;
    }

    return ok(
      c,
      result.map((r) => ({
        nodeId: r.node_id,
        address: r.address,
        version: r.version,
        metrics: {
          cpu: r.cpu_percent,
          ram: r.ram_percent,
          storage: r.file_size,
          uptime: r.uptime,
        },
      })),
    );
  },
);

// GET /v1/nodes/recent-address-changes
const recentChangesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  range: z.enum(["24h", "7d", "30d"]).default("7d"),
});

nodesRouter.get(
  "/recent-address-changes",
  zValidator("query", recentChangesSchema),
  async (c) => {
    const { limit, range } = c.req.valid("query");
    const db = getDb();
    const rangeMs = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const since = new Date(Date.now() - rangeMs[range]);

    const [changes, totalCount, uniqueNodes] = await Promise.all([
      db.nodeAddressChange.findMany({
        where: { detectedAt: { gte: since } },
        orderBy: { detectedAt: "desc" },
        take: limit,
        include: {
          node: {
            select: { id: true, pubkey: true, version: true, isActive: true },
          },
        },
      }),
      db.nodeAddressChange.count({ where: { detectedAt: { gte: since } } }),
      db.nodeAddressChange.groupBy({
        by: ["nodeId"],
        where: { detectedAt: { gte: since } },
      }),
    ]);

    return ok(c, {
      changes: changes.map((c2) => ({
        id: c2.id.toString(),
        nodeId: c2.nodeId,
        pubkey: c2.node.pubkey,
        version: c2.node.version,
        isActive: c2.node.isActive,
        oldAddress: c2.oldAddress,
        newAddress: c2.newAddress,
        detectedAt: c2.detectedAt,
      })),
      stats: {
        totalChanges: totalCount,
        uniqueNodes: uniqueNodes.length,
        range,
      },
    });
  },
);

// Helpers for node-by-identifier endpoints
const includeCounts = {
  _count: { select: { metrics: true, peers: true } },
} as const;
const includeCountsFull = {
  _count: { select: { metrics: true, peers: true, addressChanges: true } },
} as const;

// GET /v1/nodes/by-pubkey/:pubkey
nodesRouter.get(
  "/by-pubkey/:pubkey",
  zValidator(
    "param",
    z.object({ pubkey: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/) }),
  ),
  async (c) => {
    const { pubkey } = c.req.valid("param");
    const db = getDb();
    const node = await db.node.findUnique({
      where: { pubkey },
      include: includeCountsFull,
    });
    if (!node) throw notFound(`Node with pubkey ${pubkey} not found`);
    return ok(c, node);
  },
);

// GET /v1/nodes/by-address/:address
nodesRouter.get(
  "/by-address/:address",
  zValidator("param", z.object({ address: z.string().min(1).max(255) })),
  async (c) => {
    const { address } = c.req.valid("param");
    const db = getDb();
    const node = await db.node.findUnique({
      where: { address },
      include: includeCounts,
    });
    if (!node) throw notFound(`Node with address ${address} not found`);
    return ok(c, node);
  },
);

// Numeric ID endpoints (preserve tRPC IDs internally)
const idParam = z.object({ id: z.coerce.number().int().positive() });

// GET /v1/nodes/:id
nodesRouter.get("/:id", zValidator("param", idParam), async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb();
  const node = await db.node.findUnique({
    where: { id },
    include: includeCounts,
  });
  if (!node) throw notFound(`Node with ID ${id} not found`);
  return ok(c, node);
});

// GET /v1/nodes/:id/metrics
const metricsQuerySchema = z.object({
  range: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
  aggregation: z.enum(["raw", "hourly", "daily"]).default("hourly"),
});

nodesRouter.get(
  "/:id/metrics",
  zValidator("param", idParam),
  zValidator("query", metricsQuerySchema),
  async (c) => {
    const { id: nodeId } = c.req.valid("param");
    const { range, aggregation } = c.req.valid("query");
    const db = getDb();
    const rangeMs = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const startTime = new Date(Date.now() - rangeMs[range]);

    if (aggregation === "raw") {
      const metrics = await db.nodeMetric.findMany({
        where: { nodeId, time: { gte: startTime } },
        orderBy: { time: "asc" },
        take: 1000,
      });
      return ok(c, metrics);
    }

    type Bucket = {
      bucket: Date;
      avg_cpu: number | null;
      avg_ram_percent: number | null;
      max_uptime: number | null;
      max_file_size: bigint | null;
      sample_count: bigint;
    };

    const metrics =
      aggregation === "hourly"
        ? await db.$queryRaw<Bucket[]>`
            SELECT bucket, avg_cpu, avg_ram_percent, max_uptime, max_file_size, sample_count
            FROM node_metrics_hourly
            WHERE node_id = ${nodeId} AND bucket >= ${startTime}
            ORDER BY bucket ASC`
        : await db.$queryRaw<Bucket[]>`
            SELECT bucket, avg_cpu, avg_ram_percent, max_uptime, max_file_size, sample_count
            FROM node_metrics_daily
            WHERE node_id = ${nodeId} AND bucket >= ${startTime}
            ORDER BY bucket ASC`;
    return ok(c, metrics);
  },
);

// GET /v1/nodes/:id/metrics/latest
nodesRouter.get(
  "/:id/metrics/latest",
  zValidator("param", idParam),
  async (c) => {
    const { id: nodeId } = c.req.valid("param");
    const db = getDb();
    const metric = await db.nodeMetric.findFirst({
      where: { nodeId },
      orderBy: { time: "desc" },
    });
    return ok(c, metric);
  },
);

// GET /v1/nodes/:id/metrics/history
const historyQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("7d"),
});

nodesRouter.get(
  "/:id/metrics/history",
  zValidator("param", idParam),
  zValidator("query", historyQuerySchema),
  async (c) => {
    const { id: nodeId } = c.req.valid("param");
    const { range } = c.req.valid("query");
    const db = getDb();
    const rangeMs = {
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
    };
    const startTime = new Date(Date.now() - rangeMs[range]);

    type Row = {
      bucket: Date;
      avg_cpu: number | null;
      avg_ram_percent: number | null;
    };

    const metrics =
      range === "7d"
        ? await db.$queryRaw<Row[]>`
            SELECT bucket, avg_cpu, avg_ram_percent
            FROM node_metrics_hourly
            WHERE node_id = ${nodeId} AND bucket >= ${startTime}
            ORDER BY bucket ASC`
        : await db.$queryRaw<Row[]>`
            SELECT bucket, avg_cpu, avg_ram_percent
            FROM node_metrics_daily
            WHERE node_id = ${nodeId} AND bucket >= ${startTime}
            ORDER BY bucket ASC`;
    return ok(
      c,
      metrics.map((m) => ({
        time: m.bucket,
        cpu: m.avg_cpu,
        ram: m.avg_ram_percent,
      })),
    );
  },
);

// GET /v1/nodes/:id/peers
nodesRouter.get("/:id/peers", zValidator("param", idParam), async (c) => {
  const { id: nodeId } = c.req.valid("param");
  const db = getDb();
  const peers = await db.nodePeer.findMany({
    where: { nodeId },
    include: {
      peerNode: {
        select: { id: true, address: true, version: true, isActive: true },
      },
    },
    orderBy: { lastSeenAt: "desc" },
  });
  return ok(c, peers);
});

// GET /v1/nodes/:id/address-history
const addressHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

nodesRouter.get(
  "/:id/address-history",
  zValidator("param", idParam),
  zValidator("query", addressHistoryQuerySchema),
  async (c) => {
    const { id: nodeId } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    const db = getDb();
    const changes = await db.nodeAddressChange.findMany({
      where: { nodeId },
      orderBy: { detectedAt: "desc" },
      take: limit,
    });
    return ok(
      c,
      changes.map((c2) => ({
        id: c2.id.toString(),
        oldAddress: c2.oldAddress,
        newAddress: c2.newAddress,
        detectedAt: c2.detectedAt,
      })),
    );
  },
);
