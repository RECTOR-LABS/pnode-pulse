/**
 * Health Check Endpoint
 *
 * Returns service health status for monitoring and load balancers.
 * Checks:
 * - Database connectivity
 * - Redis connectivity
 * - Application uptime
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isRedisAvailable } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: boolean;
    redis: boolean;
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
    logger.error("Health check: Database connectivity failed", error instanceof Error ? error : new Error(String(error)));
  }

  // Check Redis connectivity
  const redisHealthy = await isRedisAvailable();

  const checks = {
    database: dbHealthy,
    redis: redisHealthy,
  };

  const allHealthy = Object.values(checks).every(Boolean);
  const someHealthy = Object.values(checks).some(Boolean);

  const health: HealthCheck = {
    status: allHealthy ? "healthy" : someHealthy ? "degraded" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.npm_package_version || "unknown",
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  // Return 200 for healthy/degraded, 503 for unhealthy
  const statusCode = health.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
