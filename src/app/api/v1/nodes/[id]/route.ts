import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {  checkRateLimit,
  createRateLimitHeaders,
  rateLimitExceededResponse,
  trackApiUsage,
} from "@/lib/api/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/nodes/:id
 * Returns detailed information about a specific node
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

    // Try to find by ID or address
    const isNumeric = /^\d+$/.test(id);

    const node = await db.node.findFirst({
      where: isNumeric
        ? { id: parseInt(id) }
        : {
            OR: [
              { address: { contains: id } },
              { pubkey: id },
            ],
          },
      include: {
        _count: {
          select: { metrics: true, peers: true },
        },
      },
    });

    if (!node) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Node not found" } },
        { status: 404 }
      );
    }

    // Get latest metrics
    const latestMetric = await db.nodeMetric.findFirst({
      where: { nodeId: node.id },
      orderBy: { time: "desc" },
    });

    let metrics = null;
    if (latestMetric) {
      const ramTotal = latestMetric.ramTotal ?? BigInt(0);
      const ramPercent =
        ramTotal > 0
          ? (Number(latestMetric.ramUsed) / Number(ramTotal)) * 100
          : 0;

      metrics = {
        cpuPercent: latestMetric.cpuPercent,
        ramUsedBytes: Number(latestMetric.ramUsed),
        ramTotalBytes: Number(ramTotal),
        ramPercent: Math.round(ramPercent * 100) / 100,
        storageBytes: Number(latestMetric.fileSize),
        uptimeSeconds: latestMetric.uptime,
        packetsReceived: latestMetric.packetsReceived,
        packetsSent: latestMetric.packetsSent,
        timestamp: latestMetric.time.toISOString(),
      };
    }

    const response = {
      id: node.id,
      address: node.address,
      pubkey: node.pubkey,
      version: node.version,
      isActive: node.isActive,
      lastSeen: node.lastSeen?.toISOString() || null,
      firstSeen: node.firstSeen.toISOString(),
      metrics,
      peerCount: node._count.peers,
      metricsCount: node._count.metrics,
    };

    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    const responseTime = Date.now() - startTime;

    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/nodes/:id", "GET", responseTime, false);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        ...rateLimitHeaders,
      },
    });
  } catch (error) {
    logger.error("API Error:", error instanceof Error ? error : new Error(String(error)));

    const responseTime = Date.now() - startTime;
    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/nodes/:id", "GET", responseTime, true);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
