import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { errorHandler, notFoundHandler } from "../src/middleware/error-handler";
import { requestId } from "../src/middleware/request-id";
import { notFound, conflict } from "../src/lib/errors";

describe("error handler", () => {
  const buildApp = () => {
    const app = new Hono();
    app.use("*", requestId());
    app.get("/missing", () => {
      throw notFound("Resource gone", { hint: "try later" });
    });
    app.get("/conflict", () => {
      throw conflict("Already exists");
    });
    app.get("/zod", () => {
      const schema = z.object({ count: z.number() });
      schema.parse({ count: "nope" });
      return new Response("unreachable");
    });
    app.get("/oops", () => {
      throw new Error("kaboom");
    });
    app.notFound(notFoundHandler);
    app.onError(errorHandler);
    return app;
  };

  it("returns RESOURCE_NOT_FOUND on notFound()", async () => {
    const res = await buildApp().request("/missing");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(body.error.message).toBe("Resource gone");
    expect(body.error.details).toEqual({ hint: "try later" });
    expect(body.requestId).toMatch(/^req_/);
  });

  it("returns CONFLICT on conflict()", async () => {
    const res = await buildApp().request("/conflict");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns VALIDATION_ERROR on zod errors", async () => {
    const res = await buildApp().request("/zod");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toHaveProperty("issues");
  });

  it("returns INTERNAL_ERROR on unhandled exceptions", async () => {
    const res = await buildApp().request("/oops");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns RESOURCE_NOT_FOUND on unknown routes", async () => {
    const res = await buildApp().request("/nope");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(body.error.message).toContain("GET /nope");
  });
});
