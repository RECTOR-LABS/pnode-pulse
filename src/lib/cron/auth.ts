/**
 * Cron authorization.
 *
 * Vercel Cron (and any external trigger, e.g. a Cloudflare Worker) must send
 * `Authorization: Bearer <CRON_SECRET>`. Vercel injects this header
 * automatically when the CRON_SECRET environment variable is set.
 *
 * Returns a 401 Response when the request is not an authorized cron invocation,
 * otherwise null. Route handlers should `return` the value when non-null:
 *
 * ```ts
 * const denied = cronAuthError(req);
 * if (denied) return denied;
 * ```
 */
export function cronAuthError(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;

  // Fail closed: without a configured secret, never treat a request as an
  // authorized cron invocation.
  if (!secret) {
    return new Response("Cron secret not configured", { status: 401 });
  }

  const provided = req.headers.get("authorization");
  if (provided !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}
