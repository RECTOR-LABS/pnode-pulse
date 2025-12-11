import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {  checkRateLimit,
  createRateLimitHeaders,
  rateLimitExceededResponse,
  trackApiUsage,
} from "@/lib/api/rate-limiter";

export const dynamic = "force-dynamic";
export const revalidate = 60;

/**
 * GET /api/v1/network/stats
 * Returns detailed aggregate metrics with percentiles
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const rateLimitResult = await checkRateLimit(request);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    const stats = await db.$queryRaw<
      Array<{
        avg_cpu: number;
        min_cpu: number;
        max_cpu: number;
        p50_cpu: number;
        p90_cpu: number;
        p99_cpu: number;
        avg_ram_percent: number;
        min_ram_percent: number;
        max_ram_percent: number;
        p50_ram: number;
        p90_ram: number;
        p99_ram: number;
        total_storage: bigint;
        avg_storage: bigint;
        avg_uptime: number;
        node_count: number;
      }>
    >`
      WITH latest_metrics AS (
        SELECT DISTINCT ON ("nodeId")
          "nodeId",
          "cpuPercent",
          CASE WHEN "ramTotal" > 0
            THEN ("ramUsed"::float / "ramTotal"::float) * 100
            ELSE 0
          END as ram_percent,
          "fileSize",
          uptime
        FROM "NodeMetric"
        ORDER BY "nodeId", time DESC
      )
      SELECT
        AVG("cpuPercent") as avg_cpu,
        MIN("cpuPercent") as min_cpu,
        MAX("cpuPercent") as max_cpu,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "cpuPercent") as p50_cpu,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY "cpuPercent") as p90_cpu,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "cpuPercent") as p99_cpu,
        AVG(ram_percent) as avg_ram_percent,
        MIN(ram_percent) as min_ram_percent,
        MAX(ram_percent) as max_ram_percent,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ram_percent) as p50_ram,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ram_percent) as p90_ram,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ram_percent) as p99_ram,
        SUM("fileSize") as total_storage,
        AVG("fileSize") as avg_storage,
        AVG(uptime) as avg_uptime,
        COUNT(*) as node_count
      FROM latest_metrics m
      JOIN "Node" n ON m."nodeId" = n.id
      WHERE n."isActive" = true
    `;

    const s = stats[0];
    if (!s) {
      return NextResponse.json({
        cpu: { avg: 0, min: 0, max: 0, p50: 0, p90: 0, p99: 0 },
        ram: { avgPercent: 0, minPercent: 0, maxPercent: 0, p50: 0, p90: 0, p99: 0 },
        storage: { total: 0, avg: 0 },
        uptime: { avgSeconds: 0 },
        nodeCount: 0,
      });
    }

    const response = {
      cpu: {
        avg: Math.round(s.avg_cpu * 100) / 100,
        min: Math.round(s.min_cpu * 100) / 100,
        max: Math.round(s.max_cpu * 100) / 100,
        p50: Math.round(s.p50_cpu * 100) / 100,
        p90: Math.round(s.p90_cpu * 100) / 100,
        p99: Math.round(s.p99_cpu * 100) / 100,
      },
      ram: {
        avgPercent: Math.round(s.avg_ram_percent * 100) / 100,
        minPercent: Math.round(s.min_ram_percent * 100) / 100,
        maxPercent: Math.round(s.max_ram_percent * 100) / 100,
        p50: Math.round(s.p50_ram * 100) / 100,
        p90: Math.round(s.p90_ram * 100) / 100,
        p99: Math.round(s.p99_ram * 100) / 100,
      },
      storage: {
        total: Number(s.total_storage),
        avg: Number(s.avg_storage),
      },
      uptime: {
        avgSeconds: Math.round(s.avg_uptime),
      },
      nodeCount: Number(s.node_count),
    };

    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    const responseTime = Date.now() - startTime;

    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/network/stats", "GET", responseTime, false);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        ...rateLimitHeaders,
      },
    });
  } catch (error) {
    logger.error("API Error:", error instanceof Error ? error : new Error(String(error)));

    const responseTime = Date.now() - startTime;
    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/network/stats", "GET", responseTime, true);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
