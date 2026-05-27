import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const { queryRawMock, isRedisAvailableMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  isRedisAvailableMock: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({
  db: { $queryRaw: queryRawMock },
  disconnectDb: vi.fn(),
}));

vi.mock("../src/lib/redis", () => ({
  isRedisAvailable: isRedisAvailableMock,
  getRedis: vi.fn(() => ({})),
}));

import { healthzRouter } from "../src/routes/healthz";

const buildApp = () => {
  const app = new Hono();
  app.route("/", healthzRouter);
  return app;
};

describe("healthz", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    isRedisAvailableMock.mockReset();
  });

  it("/healthz returns 200 + status:ok without probing deps", async () => {
    const res = await buildApp().request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(isRedisAvailableMock).not.toHaveBeenCalled();
  });

  it("/readyz returns 200 ok when DB and Redis both up", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
    isRedisAvailableMock.mockResolvedValue(true);

    const res = await buildApp().request("/readyz");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({ database: true, redis: true });
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("/readyz returns 200 degraded when only Redis is down", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
    isRedisAvailableMock.mockResolvedValue(false);

    const res = await buildApp().request("/readyz");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks).toEqual({ database: true, redis: false });
  });

  it("/readyz returns 503 unhealthy when DB is down", async () => {
    queryRawMock.mockRejectedValue(new Error("connection refused"));
    isRedisAvailableMock.mockResolvedValue(true);

    const res = await buildApp().request("/readyz");
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe(false);
    expect(body.checks.redis).toBe(true);
  });

  it("/readyz returns 503 unhealthy when both DB and Redis are down", async () => {
    queryRawMock.mockRejectedValue(new Error("down"));
    isRedisAvailableMock.mockResolvedValue(false);

    const res = await buildApp().request("/readyz");
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks).toEqual({ database: false, redis: false });
  });
});
