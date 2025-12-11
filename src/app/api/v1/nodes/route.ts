import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import {  checkRateLimit,
  createRateLimitHeaders,
  rateLimitExceededResponse,
  trackApiUsage,
} from "@/lib/api/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/nodes
 * Returns paginated list of nodes with optional filtering
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const rateLimitResult = await checkRateLimit(request);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const status = searchParams.get("status") || "all";
    const version = searchParams.get("version");
    const search = searchParams.get("search");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50"), 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const orderBy = searchParams.get("orderBy") || "lastSeen";
    const order = searchParams.get("order") || "desc";

    // Build where clause
    const where: Prisma.NodeWhereInput = {};

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    if (version) {
      where.version = version;
    }

    if (search) {
      where.OR = [
        { address: { contains: search, mode: "insensitive" } },
        { pubkey: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build orderBy clause
    const validOrderFields = ["lastSeen", "firstSeen", "address", "version", "isActive"];
    const orderField = validOrderFields.includes(orderBy) ? orderBy : "lastSeen";
    const orderDirection = order === "asc" ? "asc" : "desc";

    // Execute queries
    const [nodes, total] = await Promise.all([
      db.node.findMany({
        where,
        orderBy: { [orderField]: orderDirection },
        take: limit,
        skip: offset,
        select: {
          id: true,
          address: true,
          pubkey: true,
          version: true,
          isActive: true,
          lastSeen: true,
          firstSeen: true,
        },
      }),
      db.node.count({ where }),
    ]);

    const response = {
      nodes: nodes.map((node) => ({
        id: node.id,
        address: node.address,
        pubkey: node.pubkey,
        version: node.version,
        isActive: node.isActive,
        lastSeen: node.lastSeen?.toISOString() || null,
        firstSeen: node.firstSeen.toISOString(),
      })),
      total,
      limit,
      offset,
      hasMore: offset + nodes.length < total,
    };

    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    const responseTime = Date.now() - startTime;

    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/nodes", "GET", responseTime, false);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        ...rateLimitHeaders,
      },
    });
  } catch (error) {
    logger.error("API Error:", error instanceof Error ? error : new Error(String(error)));

    const responseTime = Date.now() - startTime;
    trackApiUsage(rateLimitResult.apiKeyId, "/api/v1/nodes", "GET", responseTime, true);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
