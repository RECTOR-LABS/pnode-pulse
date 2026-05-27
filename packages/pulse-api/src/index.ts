import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { logger } from "./lib/logger";
import { disconnectDb } from "./lib/db";
import { disconnectRedis } from "./lib/redis";

const env = loadConfig();
const app = createApp();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) =>
  logger.info({ port: info.port }, "pulse-api listening"),
);

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  server.close(async () => {
    await disconnectDb();
    await disconnectRedis();
    logger.info("shutdown complete");
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("graceful shutdown timed out, force-exiting");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
