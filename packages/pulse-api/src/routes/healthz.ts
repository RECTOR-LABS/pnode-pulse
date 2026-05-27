import { Hono } from "hono";
import { db } from "../lib/db";
import { isRedisAvailable } from "../lib/redis";

/**
 * /healthz  — Kubernetes-style liveness: is the process alive and serving?
 *             Always 200 if the event loop is running. No dependency probing,
 *             no internal state in the body. Docker HEALTHCHECK targets this
 *             so a transient Redis blip cannot cause a container restart loop.
 *
 * /readyz   — Kubernetes-style readiness: is every backing dependency healthy
 *             enough to serve traffic?
 *               • 200 ok        — DB and Redis both reachable
 *               • 200 degraded  — DB reachable, Redis unreachable
 *                                 (cache/jobs may stall, but reads still work)
 *               • 503 unhealthy — DB unreachable
 *             Returns a per-dependency breakdown. Treat as internal: restrict
 *             via nginx to internal/operator clients in production.
 */
export const healthzRouter = new Hono();

healthzRouter.get("/healthz", (c) => c.json({ status: "ok" }, 200));

healthzRouter.get("/readyz", async (c) => {
  const start = Date.now();
  const [dbOk, redisOk] = await Promise.all([
    db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    isRedisAvailable(),
  ]);

  const status = !dbOk ? "unhealthy" : redisOk ? "ok" : "degraded";
  const statusCode = dbOk ? 200 : 503;

  return c.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks: { database: dbOk, redis: redisOk },
      durationMs: Date.now() - start,
    },
    statusCode,
  );
});
