import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger";

export const accessLog = (): MiddlewareHandler => async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info("http", {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: ms,
  });
};
