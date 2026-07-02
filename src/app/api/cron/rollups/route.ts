import { cronAuthError } from "@/lib/cron/auth";
import { db } from "@/lib/db";
import { refreshAllRollups } from "@/lib/db/rollups";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/rollups
 * Recomputes the hourly/daily/weekly node + network rollups from recent raw
 * metrics. Idempotent. Triggered on a schedule (Vercel Cron or external cron
 * hitting this CRON_SECRET-guarded endpoint).
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  try {
    await refreshAllRollups(db);
    return Response.json({ ok: true });
  } catch (error) {
    logger.error(
      "Rollup cron failed:",
      error instanceof Error ? error : new Error(String(error)),
    );
    return Response.json(
      { ok: false, error: "Rollup refresh failed" },
      { status: 500 },
    );
  }
}
