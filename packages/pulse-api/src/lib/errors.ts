import type { ErrorCode } from "@pulse/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    status: ContentfulStatusCode,
    details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const unauthorized = (
  message = "Authentication required",
  details: unknown = null,
) => new ApiError("UNAUTHORIZED", message, 401, details);

export const forbidden = (message = "Not allowed", details: unknown = null) =>
  new ApiError("FORBIDDEN", message, 403, details);

export const notFound = (message = "Not found", details: unknown = null) =>
  new ApiError("RESOURCE_NOT_FOUND", message, 404, details);

export const validation = (message: string, details: unknown = null) =>
  new ApiError("VALIDATION_ERROR", message, 400, details);

export const rateLimit = (message: string, details: unknown = null) =>
  new ApiError("RATE_LIMIT_EXCEEDED", message, 429, details);

export const conflict = (message: string, details: unknown = null) =>
  new ApiError("CONFLICT", message, 409, details);

export const upstream = (
  message = "Upstream dependency unavailable",
  details: unknown = null,
) => new ApiError("UPSTREAM_ERROR", message, 502, details);

export const internal = (message = "Internal error", details: unknown = null) =>
  new ApiError("INTERNAL_ERROR", message, 500, details);
