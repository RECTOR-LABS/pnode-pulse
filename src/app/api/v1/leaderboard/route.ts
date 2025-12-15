import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  createRateLimitHeaders,
  rateLimitExceededResponse,
  trackApiUsage,
} from "@/lib/api/rate-limiter";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes

type Metric = "uptime" | "cpu" | "ram" | "storage";
type Order = "top" | "bottom";
type Period = "24h" | "7d" | "30d" | "all";

const PERIOD_HOURS: Record<Period, number | null> = {
  "24h": 24,
  "7d": 168,
  "30d": 720,
  all: null,
};

/**
 * GET /api/v1/leaderboard
 * Returns node rankings by specified metric
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const rateLimitResult = await checkRateLimit(request);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    const metric = (searchParams.get("metric") || "uptime") as Metric;
    const order = (searchParams.get("order") || "top") as Order;
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "10"), 1),
      100,
    );
    const period = (searchParams.get("period") || "7d") as Period;

    const validMetrics: Metric[] = ["uptime", "cpu", "ram", "storage"];
    const validOrders: Order[] = ["top", "bottom"];
    const validPeriods: Period[] = ["24h", "7d", "30d", "all"];

    if (!validMetrics.includes(metric)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid metric parameter" } },
        { status: 400 },
      );
    }

    if (!validOrders.includes(order)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid order parameter" } },
        { status: 400 },
      );
    }

    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid period parameter" } },
        { status: 400 },
      );
    }

    const hours = PERIOD_HOURS[period];
    const fromTime = hours
      ? new Date(Date.now() - hours * 60 * 60 * 1000)
      : null;

    // Define result type
    type RankingRow = {
      node_id: number;
      address: string;
      version: string;
      metric_value: number;
      uptime: number;
      cpu: number;
      ram: number;
      storage: bigint;
    };

    // Use separate parameterized queries for each metric/order combination
    // This avoids SQL injection patterns entirely
    // Note: Using actual database table/column names (snake_case), not Prisma model names
    const getUptimeRankings = async (ascending: boolean) => {
      if (fromTime) {
        return ascending
          ? db.$queryRaw<RankingRow[]>`
              WITH ranked_metrics AS (
                SELECT n.id as node_id, n.address, n.version,
                  MAX(m.uptime) as metric_value,
                  MAX(m.uptime) as uptime,
                  AVG(m.cpu_percent) as cpu,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                  MAX(m.file_size) as storage
                FROM nodes n JOIN node_metrics m ON n.id = m.node_id
                WHERE n.is_active = true AND m.time >= ${fromTime}
                GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
              )
              SELECT * FROM ranked_metrics ORDER BY metric_value ASC NULLS LAST LIMIT ${limit}`
          : db.$queryRaw<RankingRow[]>`
              WITH ranked_metrics AS (
                SELECT n.id as node_id, n.address, n.version,
                  MAX(m.uptime) as metric_value,
                  MAX(m.uptime) as uptime,
                  AVG(m.cpu_percent) as cpu,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                  MAX(m.file_size) as storage
                FROM nodes n JOIN node_metrics m ON n.id = m.node_id
                WHERE n.is_active = true AND m.time >= ${fromTime}
                GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
              )
              SELECT * FROM ranked_metrics ORDER BY metric_value DESC NULLS LAST LIMIT ${limit}`;
      }
      return ascending
        ? db.$queryRaw<RankingRow[]>`
            WITH ranked_metrics AS (
              SELECT n.id as node_id, n.address, n.version,
                MAX(m.uptime) as metric_value,
                MAX(m.uptime) as uptime,
                AVG(m.cpu_percent) as cpu,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                MAX(m.file_size) as storage
              FROM nodes n JOIN node_metrics m ON n.id = m.node_id
              WHERE n.is_active = true
              GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
            )
            SELECT * FROM ranked_metrics ORDER BY metric_value ASC NULLS LAST LIMIT ${limit}`
        : db.$queryRaw<RankingRow[]>`
            WITH ranked_metrics AS (
              SELECT n.id as node_id, n.address, n.version,
                MAX(m.uptime) as metric_value,
                MAX(m.uptime) as uptime,
                AVG(m.cpu_percent) as cpu,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                MAX(m.file_size) as storage
              FROM nodes n JOIN node_metrics m ON n.id = m.node_id
              WHERE n.is_active = true
              GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
            )
            SELECT * FROM ranked_metrics ORDER BY metric_value DESC NULLS LAST LIMIT ${limit}`;
    };

    const getCpuRankings = async (ascending: boolean) => {
      if (fromTime) {
        return ascending
          ? db.$queryRaw<RankingRow[]>`
              WITH ranked_metrics AS (
                SELECT n.id as node_id, n.address, n.version,
                  AVG(m.cpu_percent) as metric_value,
                  MAX(m.uptime) as uptime,
                  AVG(m.cpu_percent) as cpu,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                  MAX(m.file_size) as storage
                FROM nodes n JOIN node_metrics m ON n.id = m.node_id
                WHERE n.is_active = true AND m.time >= ${fromTime}
                GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
              )
              SELECT * FROM ranked_metrics ORDER BY metric_value ASC NULLS LAST LIMIT ${limit}`
          : db.$queryRaw<RankingRow[]>`
              WITH ranked_metrics AS (
                SELECT n.id as node_id, n.address, n.version,
                  AVG(m.cpu_percent) as metric_value,
                  MAX(m.uptime) as uptime,
                  AVG(m.cpu_percent) as cpu,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                  MAX(m.file_size) as storage
                FROM nodes n JOIN node_metrics m ON n.id = m.node_id
                WHERE n.is_active = true AND m.time >= ${fromTime}
                GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
              )
              SELECT * FROM ranked_metrics ORDER BY metric_value DESC NULLS LAST LIMIT ${limit}`;
      }
      return ascending
        ? db.$queryRaw<RankingRow[]>`
            WITH ranked_metrics AS (
              SELECT n.id as node_id, n.address, n.version,
                AVG(m.cpu_percent) as metric_value,
                MAX(m.uptime) as uptime,
                AVG(m.cpu_percent) as cpu,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                MAX(m.file_size) as storage
              FROM nodes n JOIN node_metrics m ON n.id = m.node_id
              WHERE n.is_active = true
              GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
            )
            SELECT * FROM ranked_metrics ORDER BY metric_value ASC NULLS LAST LIMIT ${limit}`
        : db.$queryRaw<RankingRow[]>`
            WITH ranked_metrics AS (
              SELECT n.id as node_id, n.address, n.version,
                AVG(m.cpu_percent) as metric_value,
                MAX(m.uptime) as uptime,
                AVG(m.cpu_percent) as cpu,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                MAX(m.file_size) as storage
              FROM nodes n JOIN node_metrics m ON n.id = m.node_id
              WHERE n.is_active = true
              GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
            )
            SELECT * FROM ranked_metrics ORDER BY metric_value DESC NULLS LAST LIMIT ${limit}`;
    };

    const getRamRankings = async (ascending: boolean) => {
      if (fromTime) {
        return ascending
          ? db.$queryRaw<RankingRow[]>`
              WITH ranked_metrics AS (
                SELECT n.id as node_id, n.address, n.version,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as metric_value,
                  MAX(m.uptime) as uptime,
                  AVG(m.cpu_percent) as cpu,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                  MAX(m.file_size) as storage
                FROM nodes n JOIN node_metrics m ON n.id = m.node_id
                WHERE n.is_active = true AND m.time >= ${fromTime}
                GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
              )
              SELECT * FROM ranked_metrics ORDER BY metric_value ASC NULLS LAST LIMIT ${limit}`
          : db.$queryRaw<RankingRow[]>`
              WITH ranked_metrics AS (
                SELECT n.id as node_id, n.address, n.version,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as metric_value,
                  MAX(m.uptime) as uptime,
                  AVG(m.cpu_percent) as cpu,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                  MAX(m.file_size) as storage
                FROM nodes n JOIN node_metrics m ON n.id = m.node_id
                WHERE n.is_active = true AND m.time >= ${fromTime}
                GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
              )
              SELECT * FROM ranked_metrics ORDER BY metric_value DESC NULLS LAST LIMIT ${limit}`;
      }
      return ascending
        ? db.$queryRaw<RankingRow[]>`
            WITH ranked_metrics AS (
              SELECT n.id as node_id, n.address, n.version,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as metric_value,
                MAX(m.uptime) as uptime,
                AVG(m.cpu_percent) as cpu,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                MAX(m.file_size) as storage
              FROM nodes n JOIN node_metrics m ON n.id = m.node_id
              WHERE n.is_active = true
              GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
            )
            SELECT * FROM ranked_metrics ORDER BY metric_value ASC NULLS LAST LIMIT ${limit}`
        : db.$queryRaw<RankingRow[]>`
            WITH ranked_metrics AS (
              SELECT n.id as node_id, n.address, n.version,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as metric_value,
                MAX(m.uptime) as uptime,
                AVG(m.cpu_percent) as cpu,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                MAX(m.file_size) as storage
              FROM nodes n JOIN node_metrics m ON n.id = m.node_id
              WHERE n.is_active = true
              GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
            )
            SELECT * FROM ranked_metrics ORDER BY metric_value DESC NULLS LAST LIMIT ${limit}`;
    };

    const getStorageRankings = async (ascending: boolean) => {
      if (fromTime) {
        return ascending
          ? db.$queryRaw<RankingRow[]>`
              WITH ranked_metrics AS (
                SELECT n.id as node_id, n.address, n.version,
                  MAX(m.file_size) as metric_value,
                  MAX(m.uptime) as uptime,
                  AVG(m.cpu_percent) as cpu,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                  MAX(m.file_size) as storage
                FROM nodes n JOIN node_metrics m ON n.id = m.node_id
                WHERE n.is_active = true AND m.time >= ${fromTime}
                GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
              )
              SELECT * FROM ranked_metrics ORDER BY metric_value ASC NULLS LAST LIMIT ${limit}`
          : db.$queryRaw<RankingRow[]>`
              WITH ranked_metrics AS (
                SELECT n.id as node_id, n.address, n.version,
                  MAX(m.file_size) as metric_value,
                  MAX(m.uptime) as uptime,
                  AVG(m.cpu_percent) as cpu,
                  AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                  MAX(m.file_size) as storage
                FROM nodes n JOIN node_metrics m ON n.id = m.node_id
                WHERE n.is_active = true AND m.time >= ${fromTime}
                GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
              )
              SELECT * FROM ranked_metrics ORDER BY metric_value DESC NULLS LAST LIMIT ${limit}`;
      }
      return ascending
        ? db.$queryRaw<RankingRow[]>`
            WITH ranked_metrics AS (
              SELECT n.id as node_id, n.address, n.version,
                MAX(m.file_size) as metric_value,
                MAX(m.uptime) as uptime,
                AVG(m.cpu_percent) as cpu,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                MAX(m.file_size) as storage
              FROM nodes n JOIN node_metrics m ON n.id = m.node_id
              WHERE n.is_active = true
              GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
            )
            SELECT * FROM ranked_metrics ORDER BY metric_value ASC NULLS LAST LIMIT ${limit}`
        : db.$queryRaw<RankingRow[]>`
            WITH ranked_metrics AS (
              SELECT n.id as node_id, n.address, n.version,
                MAX(m.file_size) as metric_value,
                MAX(m.uptime) as uptime,
                AVG(m.cpu_percent) as cpu,
                AVG(CASE WHEN m.ram_total > 0 THEN (m.ram_used::float / m.ram_total::float) * 100 ELSE 0 END) as ram,
                MAX(m.file_size) as storage
              FROM nodes n JOIN node_metrics m ON n.id = m.node_id
              WHERE n.is_active = true
              GROUP BY n.id, n.address, n.version HAVING COUNT(*) > 0
            )
            SELECT * FROM ranked_metrics ORDER BY metric_value DESC NULLS LAST LIMIT ${limit}`;
    };

    // Execute the appropriate query based on metric and order
    let rankings: RankingRow[];
    switch (metric) {
      case "uptime":
        // Higher uptime is better, so "top" = DESC
        rankings = await getUptimeRankings(order !== "top");
        break;
      case "cpu":
        // Lower CPU is better, so "top" = ASC
        rankings = await getCpuRankings(order === "top");
        break;
      case "ram":
        // Lower RAM is better, so "top" = ASC
        rankings = await getRamRankings(order === "top");
        break;
      case "storage":
        // Higher storage is better, so "top" = DESC
        rankings = await getStorageRankings(order !== "top");
        break;
    }

    const response = {
      metric,
      period,
      order,
      rankings: rankings.map((r, index) => ({
        rank: index + 1,
        nodeId: r.node_id,
        address: r.address,
        version: r.version,
        value:
          metric === "storage"
            ? Number(r.storage)
            : Math.round(r.metric_value * 100) / 100,
        metrics: {
          uptimeSeconds: r.uptime ?? 0,
          cpuPercent: Math.round((r.cpu ?? 0) * 100) / 100,
          ramPercent: Math.round((r.ram ?? 0) * 100) / 100,
          storageBytes: Number(r.storage ?? 0),
        },
      })),
    };

    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    const responseTime = Date.now() - startTime;

    trackApiUsage(
      rateLimitResult.apiKeyId,
      "/api/v1/leaderboard",
      "GET",
      responseTime,
      false,
    );

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        ...rateLimitHeaders,
      },
    });
  } catch (error) {
    logger.error(
      "API Error:",
      error instanceof Error ? error : new Error(String(error)),
    );

    const responseTime = Date.now() - startTime;
    trackApiUsage(
      rateLimitResult.apiKeyId,
      "/api/v1/leaderboard",
      "GET",
      responseTime,
      true,
    );

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 },
    );
  }
}
