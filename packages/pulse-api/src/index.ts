import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { logger } from "./lib/logger";
import { disconnectDb } from "./lib/db";
import { jwtSecretFingerprint } from "./lib/auth/jwt-config";

const env = loadConfig();
const app = createApp();

logger.info("JWT_SECRET fingerprint", {
  fingerprint: jwtSecretFingerprint(),
  note: "must match monolith fingerprint for tokens to validate",
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) =>
  logger.info("pulse-api listening", { port: info.port }),
);

async function shutdown(signal: string) {
  logger.info("shutting down", { signal });
  server.close(async () => {
    await disconnectDb();
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
