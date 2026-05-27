import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { serialize } from "../lib/serialize";

/**
 * Wraps c.json with the wire-format serializer (BigInt → string, Date → ISO).
 * Use this for every successful response payload.
 */
export function ok<T>(
  c: Context,
  payload: T,
  status: ContentfulStatusCode = 200,
) {
  return c.json(serialize(payload), status);
}

export function created<T>(c: Context, payload: T) {
  return c.json(serialize(payload), 201);
}

export function noContent(c: Context) {
  return c.body(null, 204);
}
