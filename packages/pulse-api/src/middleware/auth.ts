/**
 * JWT auth middleware.
 *
 * Reads Authorization: Bearer <jwt>, verifies via verifyToken (which also
 * confirms an active UserSession row exists). Sets principal on context.
 */

import type { MiddlewareHandler } from "hono";
import { verifyToken } from "../lib/auth";
import { unauthorized } from "../lib/errors";

export interface AuthPrincipal {
  userId: string;
  walletAddress: string;
  sessionId: string;
}

export const requireAuth = (): MiddlewareHandler => async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw unauthorized("Missing or malformed Authorization header");
  }
  const token = header.slice(7).trim();
  if (!token) throw unauthorized("Empty bearer token");

  const result = await verifyToken(token);
  if (!result.valid || !result.principal) {
    throw unauthorized(result.error ?? "Invalid token");
  }
  c.set("principal", result.principal);
  await next();
};

declare module "hono" {
  interface ContextVariableMap {
    principal: AuthPrincipal;
  }
}
