/**
 * Health Check Endpoint
 *
 * Returns service health status for monitoring and load balancers.
 * The database (Neon) is the only critical dependency: the dashboard serves
 * from it, and rate limiting degrades gracefully to in-memory if Upstash is
 * unavailable, so it is intentionally not a health gate.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface HealthCheck {
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks: {
    database: boolean;
  };
  version?: string;
  uptime?: number;
}

const startTime = Date.now();

export async function GET() {
  // Check database connectivity
  let dbHealthy = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (error) {
    logger.error(
      "Health check: Database connectivity failed",
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  const health: HealthCheck = {
    status: dbHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy,
    },
    version: process.env.npm_package_version || "unknown",
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  // Return 200 for healthy, 503 for unhealthy
  const statusCode = health.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
