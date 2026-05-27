import { Hono } from "hono";
import { db } from "../lib/db";
import { isRedisAvailable } from "../lib/redis";

export const healthzRouter = new Hono();

healthzRouter.get("/healthz", async (c) => {
  const start = Date.now();
  const [dbOk, redisOk] = await Promise.all([
    db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    isRedisAvailable(),
  ]);
  return c.json(
    {
      status: dbOk && redisOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks: { database: dbOk, redis: redisOk },
      durationMs: Date.now() - start,
    },
    dbOk && redisOk ? 200 : 503,
  );
});
