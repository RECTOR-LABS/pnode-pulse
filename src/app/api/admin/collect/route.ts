/**
 * Admin API: Trigger data collection
 *
 * POST /api/admin/collect
 * Headers: x-api-key: <ADMIN_API_KEY>
 *
 * Manually triggers a data collection cycle.
 * Useful for testing and manual data updates.
 *
 * Security:
 * - Requires ADMIN_API_KEY authentication
 * - Rate limited to 1 request per 5 minutes
 */

import { NextRequest, NextResponse } from "next/server";
import { runCollection } from "@/server/workers/collector";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rate limiting: Track last collection time
let lastCollectionTime = 0;
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Validate API key from request headers
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.ADMIN_API_KEY;

  // If no ADMIN_API_KEY is set, reject all requests
  if (!expectedKey) {
    logger.warn("ADMIN_API_KEY not configured - rejecting request");
    return false;
  }

  return apiKey === expectedKey;
}

/**
 * Check rate limit
 */
function checkRateLimit(): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const timeSinceLastCollection = now - lastCollectionTime;

  if (timeSinceLastCollection < RATE_LIMIT_MS) {
    const retryAfter = Math.ceil((RATE_LIMIT_MS - timeSinceLastCollection) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

export async function POST(request: NextRequest) {
  // Authentication check
  if (!validateApiKey(request)) {
    logger.warn("Unauthorized admin API access attempt", {
      ip: request.headers.get("x-forwarded-for") || "unknown",
    });
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Rate limit check
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      }
    );
  }

  try {
    logger.info("Manual collection triggered via API");
    lastCollectionTime = Date.now();

    const result = await runCollection();

    return NextResponse.json({
      success: true,
      message: "Collection completed successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Manual collection failed", error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        success: false,
        message: "Collection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to trigger collection",
    method: "POST /api/admin/collect",
  });
}
