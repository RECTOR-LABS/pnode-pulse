/**
 * Admin API: Trigger data collection
 *
 * POST /api/admin/collect
 *
 * Manually triggers a data collection cycle.
 * Useful for testing and manual data updates.
 */

import { NextResponse } from "next/server";
import { runCollection } from "@/server/workers/collector";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    logger.info("Manual collection triggered via API");

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
