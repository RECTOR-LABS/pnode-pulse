/**
 * Integration test for incremental rollup upserts. Requires a real Postgres via
 * TEST_DATABASE_URL; SKIPPED in the default / pre-commit suite.
 *
 *   TEST_DATABASE_URL=postgresql://postgres:pulse@localhost:55432/pulse_scratch \
 *     npx vitest run src/__tests__/integration/rollups.test.ts
 *
 * The upserts aggregate raw within `now() - interval '14 days'`, so the test
 * seeds relative to the current time (not a fixed date) and asserts against
 * hour buckets computed from those timestamps.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  upsertNodeHourly,
  upsertNetworkHourly,
  refreshAllRollups,
} from "@/lib/db/rollups";

const TEST_DB = process.env.TEST_DATABASE_URL;
const HOUR_MS = 60 * 60 * 1000;

describe.skipIf(!TEST_DB)("rollup upserts (integration)", () => {
  let db: PrismaClient;
  let nodeA: number;
  let nodeB: number;

  // A clean hour boundary ~3 hours ago (safely inside the 14-day window).
  const hour1 = new Date(
    Math.floor((Date.now() - 3 * HOUR_MS) / HOUR_MS) * HOUR_MS,
  );
  const hour2 = new Date(hour1.getTime() + HOUR_MS);

  beforeAll(async () => {
    process.env.DIRECT_DATABASE_URL = TEST_DB;
    db = new PrismaClient({ datasourceUrl: TEST_DB });

    const a = await db.node.create({
      data: { address: `rollup-a-${Date.now()}:6000` },
    });
    const b = await db.node.create({
      data: { address: `rollup-b-${Date.now()}:6000` },
    });
    nodeA = a.id;
    nodeB = b.id;

    const at = (base: Date, min: number) =>
      new Date(base.getTime() + min * 60_000);
    await db.nodeMetric.createMany({
      data: [
        // node A: two samples in hour1 (cpu 10, 20), one in hour2 (cpu 30)
        {
          nodeId: nodeA,
          time: at(hour1, 5),
          cpuPercent: 10,
          ramUsed: BigInt(50),
          ramTotal: BigInt(100),
          fileSize: BigInt(1000),
          uptime: 100,
        },
        {
          nodeId: nodeA,
          time: at(hour1, 35),
          cpuPercent: 20,
          ramUsed: BigInt(60),
          ramTotal: BigInt(100),
          fileSize: BigInt(1100),
          uptime: 200,
        },
        {
          nodeId: nodeA,
          time: at(hour2, 5),
          cpuPercent: 30,
          ramUsed: BigInt(70),
          ramTotal: BigInt(100),
          fileSize: BigInt(1200),
          uptime: 300,
        },
        // node B: one sample in hour1 (cpu 40)
        {
          nodeId: nodeB,
          time: at(hour1, 15),
          cpuPercent: 40,
          ramUsed: BigInt(80),
          ramTotal: BigInt(100),
          fileSize: BigInt(2000),
          uptime: 400,
        },
      ],
    });
  });

  afterAll(async () => {
    if (db) {
      const ids = [nodeA, nodeB].filter(Boolean);
      if (ids.length) {
        await db.nodeMetricHourly.deleteMany({
          where: { nodeId: { in: ids } },
        });
        await db.nodeMetricDaily.deleteMany({ where: { nodeId: { in: ids } } });
        await db.nodeMetricWeekly.deleteMany({
          where: { nodeId: { in: ids } },
        });
        await db.nodeMetric.deleteMany({ where: { nodeId: { in: ids } } });
      }
      const recent = { gte: new Date(Date.now() - 15 * 24 * HOUR_MS) };
      await db.networkMetricHourly.deleteMany({ where: { bucket: recent } });
      await db.networkMetricDaily.deleteMany({ where: { bucket: recent } });
      if (ids.length) await db.node.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    }
  });

  it("aggregates raw metrics into per-node hourly buckets", async () => {
    await upsertNodeHourly(db);

    const rows = await db.nodeMetricHourly.findMany({
      where: { nodeId: { in: [nodeA, nodeB] } },
      orderBy: [{ nodeId: "asc" }, { bucket: "asc" }],
    });

    // A@hour1, A@hour2, B@hour1 => 3 buckets
    expect(rows).toHaveLength(3);

    const a1 = rows.find(
      (r) =>
        r.nodeId === nodeA && r.bucket.toISOString() === hour1.toISOString(),
    );
    expect(a1).toBeDefined();
    expect(Number(a1!.avgCpu)).toBeCloseTo(15, 5); // avg(10,20)
    expect(a1!.sampleCount).toBe(BigInt(2));
    expect(Number(a1!.maxFileSize)).toBe(1100);
  });

  it("aggregates network-wide hourly buckets across nodes", async () => {
    await upsertNetworkHourly(db);

    const net1 = await db.networkMetricHourly.findUnique({
      where: { bucket: hour1 },
    });
    expect(net1).toBeDefined();
    expect(net1!.nodeCount).toBe(BigInt(2)); // A and B
    expect(net1!.sampleCount).toBe(BigInt(3)); // 2 from A + 1 from B
    expect(Number(net1!.avgCpu)).toBeCloseTo((10 + 20 + 40) / 3, 4);
  });

  it("is idempotent — re-running does not duplicate buckets", async () => {
    await refreshAllRollups(db);
    await refreshAllRollups(db);

    const nodeRows = await db.nodeMetricHourly.count({
      where: { nodeId: { in: [nodeA, nodeB] } },
    });
    expect(nodeRows).toBe(3);
  });
});
