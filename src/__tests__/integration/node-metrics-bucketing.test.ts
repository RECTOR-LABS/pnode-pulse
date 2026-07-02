/**
 * Integration test for date_trunc bucketing (Neon-compatible replacement for
 * TimescaleDB time_bucket). Requires a real Postgres via TEST_DATABASE_URL and
 * is SKIPPED in the default / pre-commit suite (which must stay infra-free).
 *
 * Run against the local scratch DB:
 *   TEST_DATABASE_URL=postgresql://postgres:pulse@localhost:55432/pulse_scratch \
 *     npx vitest run src/__tests__/integration/node-metrics-bucketing.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getBucketedNodeMetrics } from "@/lib/db/metrics-history";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("getBucketedNodeMetrics (integration)", () => {
  let db: PrismaClient;
  let nodeId: number;
  const base = new Date("2026-06-01T10:00:00.000Z");

  beforeAll(async () => {
    // The schema declares directUrl = env("DIRECT_DATABASE_URL"); satisfy it so
    // the plain client initializes even though only the runtime url is used.
    process.env.DIRECT_DATABASE_URL = TEST_DB;
    db = new PrismaClient({ datasourceUrl: TEST_DB });

    const node = await db.node.create({
      data: { address: `bucket-test-${Date.now()}:6000` },
    });
    nodeId = node.id;

    const sample = (
      minutes: number,
      cpu: number,
      fileSize: number,
      uptime: number,
    ) => ({
      nodeId,
      time: new Date(base.getTime() + minutes * 60_000),
      cpuPercent: cpu,
      ramUsed: BigInt(50),
      ramTotal: BigInt(100),
      fileSize: BigInt(fileSize),
      uptime,
    });

    // Three samples in the 10:00 hour + one in the 11:00 hour.
    await db.nodeMetric.createMany({
      data: [
        sample(5, 10, 1000, 3600),
        sample(25, 20, 1500, 3700),
        sample(45, 30, 1200, 3800),
        sample(65, 99, 9999, 9999),
      ],
    });
  });

  afterAll(async () => {
    if (db && nodeId) {
      await db.nodeMetric.deleteMany({ where: { nodeId } });
      await db.node.delete({ where: { id: nodeId } });
      await db.$disconnect();
    }
  });

  it("groups same-hour rows into one hourly bucket with correct aggregates", async () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const rows = await getBucketedNodeMetrics(db, nodeId, from, "hour");

    expect(rows).toHaveLength(2); // 10:00 (3 samples) + 11:00 (1 sample)

    const [first] = rows;
    expect(first.bucket.toISOString()).toBe("2026-06-01T10:00:00.000Z");
    expect(Number(first.avg_cpu)).toBeCloseTo(20, 5); // avg(10,20,30)
    expect(Number(first.avg_ram_percent)).toBeCloseTo(50, 5); // 50/100*100
    expect(Number(first.max_storage)).toBe(1500); // max(1000,1500,1200)
    expect(Number(first.max_uptime)).toBe(3800);
  });

  it("groups all rows into one daily bucket", async () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const rows = await getBucketedNodeMetrics(db, nodeId, from, "day");

    expect(rows).toHaveLength(1);
    expect(rows[0].bucket.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(Number(rows[0].avg_cpu)).toBeCloseTo(39.75, 2); // avg(10,20,30,99)
  });
});
