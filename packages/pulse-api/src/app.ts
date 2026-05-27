import { Hono } from "hono";
import { cors } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestId } from "./middleware/request-id";
import { accessLog } from "./middleware/access-log";
import { healthzRouter } from "./routes/healthz";
import { trpcHandler } from "./routes/trpc";

export function createApp() {
  const app = new Hono();

  app.use("*", requestId());
  app.use("*", cors());
  app.use("*", accessLog());

  // Health endpoint (no auth, no rewrite cost)
  app.route("/", healthzRouter);

  // tRPC server — Hono delegates the fetch Request to the tRPC fetch adapter.
  // Path matches the FE's tRPC client URL (`/api/trpc`).
  app.all("/api/trpc/*", trpcHandler);

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
