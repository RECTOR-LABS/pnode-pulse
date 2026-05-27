/**
 * Public API middleware: rate-limit + optional API-key. Used by /v1/public/*.
 * Sets rate-limit response headers, returns 429 when exceeded, tracks usage.
 */

import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { checkRateLimit, trackUsage } from "../lib/api-keys";
import { rateLimit } from "../lib/errors";

export const publicApi = (): MiddlewareHandler => async (c, next) => {
  const start = Date.now();
  const info = getConnInfo(c);
  const ip = info.remote.address ?? "";
  const queryApiKey = c.req.query("api_key");

  const result = await checkRateLimit(c.req.raw.headers, ip, queryApiKey);
  c.header("X-RateLimit-Limit", result.limit.toString());
  c.header("X-RateLimit-Remaining", result.remaining.toString());
  c.header("X-RateLimit-Reset", result.reset.toString());

  if (!result.allowed) {
    c.header("Retry-After", "60");
    throw rateLimit(
      `Rate limit exceeded. ${result.limit} req/min on ${result.tier}.`,
      { limit: result.limit, tier: result.tier, retryAfter: 60 },
    );
  }

  c.set("publicAuth", { apiKeyId: result.apiKeyId, tier: result.tier });
  await next();

  const responseTimeMs = Date.now() - start;
  void trackUsage({
    apiKeyId: result.apiKeyId,
    endpoint: c.req.path,
    method: c.req.method,
    responseTimeMs,
    isError: c.res.status >= 400,
  });
};

declare module "hono" {
  interface ContextVariableMap {
    publicAuth: { apiKeyId?: string; tier: string };
  }
}
