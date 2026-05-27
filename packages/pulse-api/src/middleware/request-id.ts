import { randomBytes } from "node:crypto";
import type { MiddlewareHandler } from "hono";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function makeId(): string {
  const bytes = randomBytes(15);
  let id = "req_01";
  for (let i = 0; i < 25; i++) {
    id += ALPHABET[bytes[i % bytes.length] % ALPHABET.length];
  }
  return id;
}

export const requestId = (): MiddlewareHandler => async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const id = incoming && incoming.length <= 64 ? incoming : makeId();
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await next();
};

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}
