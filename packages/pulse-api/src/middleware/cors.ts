import { cors as honoCors } from "hono/cors";
import { allowedOriginRegex, allowedOrigins, loadConfig } from "../config";

export const cors = () => {
  const env = loadConfig();
  const origins = allowedOrigins(env);
  const originRegex = allowedOriginRegex(env);
  return honoCors({
    origin: (origin) => {
      if (!origin) return null;
      if (origins.includes(origin)) return origin;
      if (originRegex && originRegex.test(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "X-Api-Key",
      "X-Request-Id",
    ],
    exposeHeaders: [
      "X-Request-Id",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "Retry-After",
    ],
    maxAge: 86400,
    credentials: false,
  });
};
