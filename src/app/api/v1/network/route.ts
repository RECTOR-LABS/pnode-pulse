import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {  checkRateLimit,
  createRateLimitHeaders,
  rateLimitExceededResponse,
  trackApiUsage,
} from "@/lib/api/rate-limiter";

export const dynamic = "force-dynamic";
export const revalidate = 30;

/**
 * GET /api/v1/network
 * Returns network overview statistics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const rateLimitResult = await checkRateLimit(request);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    // Get node counts
    const [totalNodes, activeNodes] = await Promise.all([
      db.node.count(),
      db.node.count({ where: { isActive: true } }),
    ]);

    // Get version distribution
    const versions = await db.node.groupBy({
      by: ["version"],
      _count: { version: true },
      orderBy: { _count: { version: "desc" } },
    });

    // Get latest metrics for aggregate calculations
    const latestMetrics = await db.$queryRaw<
      Array<{
        total_storage: bigint;
        avg_cpu: number;
        avg_ram_percent: number;
        avg_uptime: number;
        node_count: number;
      }>
    >`
      SELECT
        COALESCE(SUM(m."fileSize"), 0) as total_storage,
        COALESCE(AVG(m."cpuPercent"), 0) as avg_cpu,
        COALESCE(AVG(
          CASE WHEN m."ramTotal" > 0
            THEN (m."ramUsed"::float / m."ramTotal"::float) * 100
            ELSE 0
          END
        ), 0) as avg_ram_percent,
        COALESCE(AVG(m.uptime), 0) as avg_uptime,
        COUNT(DISTINCT m."nodeId") as node_count
      FROM (
        SELECT DISTINCT ON ("nodeId") *
        FROM "NodeMetric"
        ORDER BY "nodeId", time DESC
      ) m
      JOIN "Node" n ON m."nodeId" = n.id
      WHERE n."isActive" = true
    `;

    const metrics = latestMetrics[0] || {
      total_storage: BigInt(0),
      avg_cpu: 0,
      avg_ram_percent: 0,
      avg_uptime: 0,
      node_count: 0,
    };

    const response = {
      nodes: {
        total: totalNodes,
        active: activeNodes,
        inactive: totalNodes - activeNodes,
      },
      versions: versions.map((v) => ({
        version: v.version || "unknown",
        count: v._count.version,
      })),
      metrics: {
        totalStorageBytes: Number(metrics.total_storage),
        avgCpuPercent: Math.round(metrics.avg_cpu * 100) / 100,
        avgRamPercent: Math.round(metrics.avg_ram_percent * 100) / 100,
        avgUptimeSeconds: Math.round(metrics.avg_uptime),
        timestamp: new Date().toISOString(),
      },
    };

    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    const responseTime = Date.now() - startTime;

    // Track usage asynchronously
    trackApiUsage(
      rateLimitResult.apiKeyId,
      "/api/v1/network",
      "GET",
      responseTime,
      false
    );

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        ...rateLimitHeaders,
      },
    });
  } catch (error) {
    logger.error("API Error:", error instanceof Error ? error : new Error(String(error)));

    const responseTime = Date.now() - startTime;
    trackApiUsage(
      rateLimitResult.apiKeyId,
      "/api/v1/network",
      "GET",
      responseTime,
      true
    );

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
