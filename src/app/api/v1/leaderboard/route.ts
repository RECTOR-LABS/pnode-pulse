import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10"), 1), 100);
    const period = (searchParams.get("period") || "7d") as Period;

    const validMetrics: Metric[] = ["uptime", "cpu", "ram", "storage"];
    const validOrders: Order[] = ["top", "bottom"];
    const validPeriods: Period[] = ["24h", "7d", "30d", "all"];

    if (!validMetrics.includes(metric)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid metric parameter" } },
        { status: 400 }
      );
    }

    if (!validOrders.includes(order)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid order parameter" } },
        { status: 400 }
      );
    }

    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid period parameter" } },
        { status: 400 }
      );
    }

    const hours = PERIOD_HOURS[period];
    const fromTime = hours ? new Date(Date.now() - hours * 60 * 60 * 1000) : null;

    // Build the metric column and sort direction
    let metricColumn: string;
    let sortDirection: string;

    switch (metric) {
      case "uptime":
        metricColumn = "MAX(m.uptime)";
        sortDirection = order === "top" ? "DESC" : "ASC";
        break;
      case "cpu":
        metricColumn = "AVG(m.\"cpuPercent\")";
        // For CPU, lower is better typically
        sortDirection = order === "top" ? "ASC" : "DESC";
        break;
      case "ram":
        metricColumn = `AVG(CASE WHEN m."ramTotal" > 0 THEN (m."ramUsed"::float / m."ramTotal"::float) * 100 ELSE 0 END)`;
        // For RAM, lower is better typically
        sortDirection = order === "top" ? "ASC" : "DESC";
        break;
      case "storage":
        metricColumn = "MAX(m.\"fileSize\")";
        sortDirection = order === "top" ? "DESC" : "ASC";
        break;
    }

    const timeFilter = fromTime
      ? `AND m.time >= '${fromTime.toISOString()}'`
      : "";

    const rankings = await db.$queryRawUnsafe<
      Array<{
        node_id: number;
        address: string;
        version: string;
        metric_value: number;
        uptime: number;
        cpu: number;
        ram: number;
        storage: bigint;
      }>
    >(`
      WITH node_metrics AS (
        SELECT
          n.id as node_id,
          n.address,
          n.version,
          ${metricColumn} as metric_value,
          MAX(m.uptime) as uptime,
          AVG(m."cpuPercent") as cpu,
          AVG(CASE WHEN m."ramTotal" > 0 THEN (m."ramUsed"::float / m."ramTotal"::float) * 100 ELSE 0 END) as ram,
          MAX(m."fileSize") as storage
        FROM "Node" n
        JOIN "NodeMetric" m ON n.id = m."nodeId"
        WHERE n."isActive" = true
          ${timeFilter}
        GROUP BY n.id, n.address, n.version
        HAVING COUNT(*) > 0
      )
      SELECT
        node_id,
        address,
        version,
        metric_value,
        uptime,
        cpu,
        ram,
        storage
      FROM node_metrics
      ORDER BY metric_value ${sortDirection} NULLS LAST
      LIMIT ${limit}
    `);

    const response = {
      metric,
      period,
      order,
      rankings: rankings.map((r, index) => ({
        rank: index + 1,
        nodeId: r.node_id,
        address: r.address,
        version: r.version,
        value: metric === "storage"
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

    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/leaderboard", "GET", responseTime, false);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        ...rateLimitHeaders,
      },
    });
  } catch (error) {
    console.error("API Error:", error);

    const responseTime = Date.now() - startTime;
    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/leaderboard", "GET", responseTime, true);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
