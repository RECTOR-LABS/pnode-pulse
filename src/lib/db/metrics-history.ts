/**
 * Bucketed node-metric history query.
 *
 * Uses vanilla-PostgreSQL `date_trunc` (Neon-compatible) to aggregate raw
 * node_metrics into hour/day buckets — this replaces the former TimescaleDB
 * `time_bucket()` call. Kept as a standalone function (accepting any
 * PrismaClient) so it can run under the Neon-adapter client in production and a
 * plain client in integration tests.
 */

import type { PrismaClient } from "@prisma/client";

export type BucketUnit = "hour" | "day";

export interface BucketedMetricRow {
  bucket: Date;
  avg_cpu: number | null;
  avg_ram_percent: number | null;
  max_storage: bigint | null;
  max_uptime: number | null;
}

/** A client that can run raw queries — the full PrismaClient or a test client. */
type RawQueryClient = Pick<PrismaClient, "$queryRaw">;

/**
 * Aggregate a node's raw metrics into hour or day buckets.
 *
 * `unit` is a trusted enum (never user input) and is additionally normalized
 * below, then passed as a bound parameter to date_trunc — no SQL injection
 * surface.
 */
export async function getBucketedNodeMetrics(
  client: RawQueryClient,
  nodeId: number,
  fromTime: Date,
  unit: BucketUnit,
): Promise<BucketedMetricRow[]> {
  const truncUnit: BucketUnit = unit === "hour" ? "hour" : "day";

  return client.$queryRaw<BucketedMetricRow[]>`
    SELECT
      date_trunc(${truncUnit}, time) as bucket,
      AVG(cpu_percent) as avg_cpu,
      AVG(
        CASE WHEN ram_total > 0
          THEN (ram_used::float / ram_total::float) * 100
          ELSE 0
        END
      ) as avg_ram_percent,
      MAX(file_size) as max_storage,
      MAX(uptime) as max_uptime
    FROM node_metrics
    WHERE node_id = ${nodeId}
      AND time >= ${fromTime}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
}
