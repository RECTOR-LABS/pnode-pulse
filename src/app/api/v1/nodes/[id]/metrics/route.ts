import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {  checkRateLimit,
  createRateLimitHeaders,
  rateLimitExceededResponse,
  trackApiUsage,
} from "@/lib/api/rate-limiter";

export const dynamic = "force-dynamic";

type TimeRange = "1h" | "24h" | "7d" | "30d";
type Aggregation = "raw" | "hourly" | "daily";

// Query parameter validation schema
const QueryParamsSchema = z.object({
  range: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
  aggregation: z.enum(["raw", "hourly", "daily"]).default("hourly"),
});

const RANGE_HOURS: Record<TimeRange, number> = {
  "1h": 1,
  "24h": 24,
  "7d": 168,
  "30d": 720,
};

/**
 * GET /api/v1/nodes/:id/metrics
 * Returns historical metrics for a specific node
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const rateLimitResult = await checkRateLimit(request);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    const nodeId = parseInt(id);
    if (isNaN(nodeId)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid node ID" } },
        { status: 400 }
      );
    }

    // Verify node exists
    const node = await db.node.findUnique({ where: { id: nodeId } });
    if (!node) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Node not found" } },
        { status: 404 }
      );
    }

    // Validate query parameters (validates BEFORE casting)
    const queryResult = QueryParamsSchema.safeParse({
      range: searchParams.get("range"),
      aggregation: searchParams.get("aggregation"),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid query parameters",
            details: queryResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { range, aggregation } = queryResult.data;

    const hours = RANGE_HOURS[range];
    const fromTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    let data: Array<{
      time: string;
      cpuPercent: number;
      ramPercent: number;
      storageBytes: number;
      uptimeSeconds: number;
    }>;

    if (aggregation === "raw") {
      const metrics = await db.nodeMetric.findMany({
        where: {
          nodeId,
          time: { gte: fromTime },
        },
        orderBy: { time: "asc" },
        take: 1000, // Limit raw data
      });

      data = metrics.map((m) => {
        const ramTotal = m.ramTotal ?? BigInt(0);
        return {
          time: m.time.toISOString(),
          cpuPercent: m.cpuPercent ?? 0,
          ramPercent:
            ramTotal > 0
              ? Math.round((Number(m.ramUsed) / Number(ramTotal)) * 10000) / 100
              : 0,
          storageBytes: Number(m.fileSize),
          uptimeSeconds: m.uptime ?? 0,
        };
      });
    } else if (aggregation === "hourly") {
      const metrics = await db.$queryRaw<
        Array<{
          bucket: Date;
          avg_cpu: number;
          avg_ram_percent: number;
          max_storage: bigint;
          max_uptime: number;
        }>
      >`
        SELECT
          time_bucket('1 hour', time) as bucket,
          AVG("cpuPercent") as avg_cpu,
          AVG(
            CASE WHEN "ramTotal" > 0
              THEN ("ramUsed"::float / "ramTotal"::float) * 100
              ELSE 0
            END
          ) as avg_ram_percent,
          MAX("fileSize") as max_storage,
          MAX(uptime) as max_uptime
        FROM "NodeMetric"
        WHERE "nodeId" = ${nodeId}
          AND time >= ${fromTime}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;

      data = metrics.map((m) => ({
        time: m.bucket.toISOString(),
        cpuPercent: Math.round((m.avg_cpu ?? 0) * 100) / 100,
        ramPercent: Math.round((m.avg_ram_percent ?? 0) * 100) / 100,
        storageBytes: Number(m.max_storage ?? 0),
        uptimeSeconds: m.max_uptime ?? 0,
      }));
    } else {
      // daily
      const metrics = await db.$queryRaw<
        Array<{
          bucket: Date;
          avg_cpu: number;
          avg_ram_percent: number;
          max_storage: bigint;
          max_uptime: number;
        }>
      >`
        SELECT
          time_bucket('1 day', time) as bucket,
          AVG("cpuPercent") as avg_cpu,
          AVG(
            CASE WHEN "ramTotal" > 0
              THEN ("ramUsed"::float / "ramTotal"::float) * 100
              ELSE 0
            END
          ) as avg_ram_percent,
          MAX("fileSize") as max_storage,
          MAX(uptime) as max_uptime
        FROM "NodeMetric"
        WHERE "nodeId" = ${nodeId}
          AND time >= ${fromTime}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;

      data = metrics.map((m) => ({
        time: m.bucket.toISOString(),
        cpuPercent: Math.round((m.avg_cpu ?? 0) * 100) / 100,
        ramPercent: Math.round((m.avg_ram_percent ?? 0) * 100) / 100,
        storageBytes: Number(m.max_storage ?? 0),
        uptimeSeconds: m.max_uptime ?? 0,
      }));
    }

    const response = {
      nodeId,
      range,
      aggregation,
      data,
    };

    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    const responseTime = Date.now() - startTime;

    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/nodes/:id/metrics", "GET", responseTime, false);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        ...rateLimitHeaders,
      },
    });
  } catch (error) {
    logger.error("API Error:", error instanceof Error ? error : new Error(String(error)));

    const responseTime = Date.now() - startTime;
    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/nodes/:id/metrics", "GET", responseTime, true);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
