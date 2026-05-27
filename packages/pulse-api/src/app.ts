import { Hono } from "hono";
import { cors } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestId } from "./middleware/request-id";
import { accessLog } from "./middleware/access-log";
import { healthzRouter } from "./routes/healthz";
import { nodesRouter } from "./routes/nodes";

export function createApp() {
  const app = new Hono();

  app.use("*", requestId());
  app.use("*", cors());
  app.use("*", accessLog());

  app.route("/", healthzRouter);
  app.route("/v1/nodes", nodesRouter);

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
