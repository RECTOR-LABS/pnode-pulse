import type { ErrorHandler, NotFoundHandler } from "hono";
import { ZodError } from "zod";
import { ApiError } from "../lib/errors";
import { logger } from "../lib/logger";
import { serialize } from "../lib/serialize";
import type { ErrorBody } from "@pulse/types";

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get("requestId") ?? "unknown";

  if (err instanceof ApiError) {
    const body: ErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        details: serialize(err.details),
      },
      requestId,
    };
    return c.json(body, err.status);
  }

  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: { issues: err.issues },
      },
      requestId,
    };
    return c.json(body, 400);
  }

  logger.error("Unhandled error", {
    err: err instanceof Error ? err.message : String(err),
    requestId,
  });
  const body: ErrorBody = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      details: null,
    },
    requestId,
  };
  return c.json(body, 500);
};

export const notFoundHandler: NotFoundHandler = (c) => {
  const body: ErrorBody = {
    error: {
      code: "RESOURCE_NOT_FOUND",
      message: `No route for ${c.req.method} ${c.req.path}`,
      details: null,
    },
    requestId: c.get("requestId") ?? "unknown",
  };
  return c.json(body, 404);
};
