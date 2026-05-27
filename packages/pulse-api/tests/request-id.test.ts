import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requestId } from "../src/middleware/request-id";

describe("requestId middleware", () => {
  const buildApp = () => {
    const app = new Hono();
    app.use("*", requestId());
    app.get("/probe", (c) => c.json({ id: c.get("requestId") }));
    return app;
  };

  it("generates a new id when no header provided", async () => {
    const app = buildApp();
    const res = await app.request("/probe");
    const body = await res.json();
    expect(body.id).toMatch(/^req_01[A-Z0-9]{25}$/);
    expect(res.headers.get("x-request-id")).toBe(body.id);
  });

  it("honors incoming X-Request-Id", async () => {
    const app = buildApp();
    const res = await app.request("/probe", {
      headers: { "x-request-id": "req_external_abc" },
    });
    const body = await res.json();
    expect(body.id).toBe("req_external_abc");
  });

  it("regenerates when incoming id is too long", async () => {
    const app = buildApp();
    const tooLong = "a".repeat(100);
    const res = await app.request("/probe", {
      headers: { "x-request-id": tooLong },
    });
    const body = await res.json();
    expect(body.id).not.toBe(tooLong);
    expect(body.id).toMatch(/^req_01/);
  });
});
