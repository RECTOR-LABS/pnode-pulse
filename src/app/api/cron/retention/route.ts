import { cronAuthError } from "@/lib/cron/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/retention
 * Prunes raw node_metrics older than 14 days. Rollup tables persist
 * independently, so long-term history is unaffected.
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  try {
    const deleted = await db.$executeRaw`
      DELETE FROM node_metrics WHERE time < now() - interval '14 days'
    `;
    return Response.json({ ok: true, deleted });
  } catch (error) {
    logger.error(
      "Retention cron failed:",
      error instanceof Error ? error : new Error(String(error)),
    );
    return Response.json(
      { ok: false, error: "Retention delete failed" },
      { status: 500 },
    );
  }
}
