import { cronAuthError } from "@/lib/cron/auth";
import { runCollection } from "@/server/workers/collector";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// Collection polls every known pNode in parallel (with per-node timeouts), so a
// cycle completes well within a minute; 60s is the Hobby ceiling.
export const maxDuration = 60;

/**
 * GET /api/cron/collect
 * Runs one pNode collection cycle. Scheduled daily (portfolio cadence) via
 * Vercel Cron or an external cron hitting this CRON_SECRET-guarded endpoint.
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  try {
    const summary = await runCollection();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    logger.error(
      "Collect cron failed:",
      error instanceof Error ? error : new Error(String(error)),
    );
    return Response.json(
      { ok: false, error: "Collection failed" },
      { status: 500 },
    );
  }
}
