import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock, isRedisAvailableMock } = vi.hoisted(() => ({
  dbMock: {
    node: { groupBy: vi.fn() },
    $queryRaw: vi.fn(),
    $disconnect: vi.fn(),
  },
  isRedisAvailableMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("../src/lib/db", () => ({
  db: dbMock,
  disconnectDb: vi.fn(),
}));

vi.mock("../src/lib/redis", () => ({
  isRedisAvailable: isRedisAvailableMock,
  getRedis: vi.fn(() => ({})),
}));

import { createApp } from "../src/app";

describe("tRPC mount", () => {
  beforeEach(() => {
    dbMock.node.groupBy.mockReset();
  });

  it("mounts tRPC at /api/trpc/* and dispatches nodes.versions through the lifted router", async () => {
    dbMock.node.groupBy.mockResolvedValue([
      { version: "0.7.3", _count: { id: 8 } },
      { version: "0.5.1", _count: { id: 1 } },
      { version: null, _count: { id: 2 } },
    ]);

    const app = createApp();
    const res = await app.request("/api/trpc/nodes.versions");

    expect(res.status).toBe(200);
    expect(dbMock.node.groupBy).toHaveBeenCalledTimes(1);

    const body = (await res.json()) as {
      result?: { data?: { json?: Array<{ version: string; count: number }> } };
    };
    const rows = body.result?.data?.json;

    // Null-version row should be filtered out; remaining rows sorted by count desc.
    expect(rows).toEqual([
      { version: "0.7.3", count: 8 },
      { version: "0.5.1", count: 1 },
    ]);
  });

  it("returns a tRPC error envelope for an unknown procedure", async () => {
    const app = createApp();
    const res = await app.request("/api/trpc/does.not.exist");

    // tRPC returns 404 for unknown procedures in the fetch adapter.
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      error?: { json?: { code?: string; message?: string } };
    };
    expect(body.error?.json?.code).toBeDefined();
  });
});
