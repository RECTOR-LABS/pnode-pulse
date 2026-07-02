/**
 * Incremental rollup upserts.
 *
 * These replace the former TimescaleDB continuous aggregates. Each function
 * recomputes the rollup buckets for recently-collected raw metrics and upserts
 * them (idempotent — safe to re-run). The rollup tables persist independently
 * of raw retention, so long-term hourly/daily/weekly history survives the
 * 14-day raw prune.
 *
 * The lookback window (`14 days`) is bounded by raw retention, so every run
 * recomputes every bucket that could still have backing raw data — this keeps
 * the rollups correct even if a scheduled run is missed. Buckets whose raw rows
 * have already been pruned are simply not re-selected, so historical rollup
 * rows are left untouched.
 *
 * Column names/types mirror the original CAgg definitions so the existing
 * $queryRaw readers in nodes.ts / network.ts stay unchanged.
 */

import type { PrismaClient } from "@prisma/client";

/** A client that can run raw writes — the full PrismaClient or a test client. */
type RawExecClient = Pick<PrismaClient, "$executeRaw">;

/** Hourly per-node rollup. */
export function upsertNodeHourly(client: RawExecClient): Promise<number> {
  return client.$executeRaw`
    INSERT INTO node_metrics_hourly
      (bucket, node_id, avg_cpu, avg_ram_percent, max_uptime, max_file_size,
       max_total_bytes, total_packets_received, total_packets_sent, sample_count)
    SELECT
      date_trunc('hour', time) AS bucket,
      node_id,
      AVG(cpu_percent),
      AVG(ram_used::float / NULLIF(ram_total, 0) * 100),
      MAX(uptime),
      MAX(file_size),
      MAX(total_bytes),
      SUM(packets_received),
      SUM(packets_sent),
      COUNT(*)
    FROM node_metrics
    WHERE time >= now() - interval '14 days'
    GROUP BY 1, node_id
    ON CONFLICT (bucket, node_id) DO UPDATE SET
      avg_cpu = EXCLUDED.avg_cpu,
      avg_ram_percent = EXCLUDED.avg_ram_percent,
      max_uptime = EXCLUDED.max_uptime,
      max_file_size = EXCLUDED.max_file_size,
      max_total_bytes = EXCLUDED.max_total_bytes,
      total_packets_received = EXCLUDED.total_packets_received,
      total_packets_sent = EXCLUDED.total_packets_sent,
      sample_count = EXCLUDED.sample_count
  `;
}

/** Daily per-node rollup. */
export function upsertNodeDaily(client: RawExecClient): Promise<number> {
  return client.$executeRaw`
    INSERT INTO node_metrics_daily
      (bucket, node_id, avg_cpu, avg_ram_percent, max_uptime, max_file_size,
       max_total_bytes, total_packets_received, total_packets_sent, sample_count)
    SELECT
      date_trunc('day', time) AS bucket,
      node_id,
      AVG(cpu_percent),
      AVG(ram_used::float / NULLIF(ram_total, 0) * 100),
      MAX(uptime),
      MAX(file_size),
      MAX(total_bytes),
      SUM(packets_received),
      SUM(packets_sent),
      COUNT(*)
    FROM node_metrics
    WHERE time >= now() - interval '14 days'
    GROUP BY 1, node_id
    ON CONFLICT (bucket, node_id) DO UPDATE SET
      avg_cpu = EXCLUDED.avg_cpu,
      avg_ram_percent = EXCLUDED.avg_ram_percent,
      max_uptime = EXCLUDED.max_uptime,
      max_file_size = EXCLUDED.max_file_size,
      max_total_bytes = EXCLUDED.max_total_bytes,
      total_packets_received = EXCLUDED.total_packets_received,
      total_packets_sent = EXCLUDED.total_packets_sent,
      sample_count = EXCLUDED.sample_count
  `;
}

/** Weekly per-node rollup. */
export function upsertNodeWeekly(client: RawExecClient): Promise<number> {
  return client.$executeRaw`
    INSERT INTO node_metrics_weekly
      (bucket, node_id, avg_cpu, avg_ram_percent, max_uptime, max_file_size,
       max_total_bytes, total_packets_received, total_packets_sent, sample_count)
    SELECT
      date_trunc('week', time) AS bucket,
      node_id,
      AVG(cpu_percent),
      AVG(ram_used::float / NULLIF(ram_total, 0) * 100),
      MAX(uptime),
      MAX(file_size),
      MAX(total_bytes),
      SUM(packets_received),
      SUM(packets_sent),
      COUNT(*)
    FROM node_metrics
    WHERE time >= now() - interval '14 days'
    GROUP BY 1, node_id
    ON CONFLICT (bucket, node_id) DO UPDATE SET
      avg_cpu = EXCLUDED.avg_cpu,
      avg_ram_percent = EXCLUDED.avg_ram_percent,
      max_uptime = EXCLUDED.max_uptime,
      max_file_size = EXCLUDED.max_file_size,
      max_total_bytes = EXCLUDED.max_total_bytes,
      total_packets_received = EXCLUDED.total_packets_received,
      total_packets_sent = EXCLUDED.total_packets_sent,
      sample_count = EXCLUDED.sample_count
  `;
}

/** Hourly network-wide rollup. */
export function upsertNetworkHourly(client: RawExecClient): Promise<number> {
  return client.$executeRaw`
    INSERT INTO network_metrics_hourly
      (bucket, node_count, total_storage, avg_cpu, avg_ram_percent, avg_uptime,
       total_packets_received, total_packets_sent, sample_count)
    SELECT
      date_trunc('hour', time) AS bucket,
      COUNT(DISTINCT node_id),
      COALESCE(SUM(file_size), 0),
      AVG(cpu_percent),
      AVG(ram_used::float / NULLIF(ram_total, 0) * 100),
      AVG(uptime),
      SUM(packets_received),
      SUM(packets_sent),
      COUNT(*)
    FROM node_metrics
    WHERE time >= now() - interval '14 days'
    GROUP BY 1
    ON CONFLICT (bucket) DO UPDATE SET
      node_count = EXCLUDED.node_count,
      total_storage = EXCLUDED.total_storage,
      avg_cpu = EXCLUDED.avg_cpu,
      avg_ram_percent = EXCLUDED.avg_ram_percent,
      avg_uptime = EXCLUDED.avg_uptime,
      total_packets_received = EXCLUDED.total_packets_received,
      total_packets_sent = EXCLUDED.total_packets_sent,
      sample_count = EXCLUDED.sample_count
  `;
}

/** Daily network-wide rollup. */
export function upsertNetworkDaily(client: RawExecClient): Promise<number> {
  return client.$executeRaw`
    INSERT INTO network_metrics_daily
      (bucket, node_count, total_storage, avg_cpu, avg_ram_percent, avg_uptime,
       total_packets_received, total_packets_sent, sample_count)
    SELECT
      date_trunc('day', time) AS bucket,
      COUNT(DISTINCT node_id),
      COALESCE(SUM(file_size), 0),
      AVG(cpu_percent),
      AVG(ram_used::float / NULLIF(ram_total, 0) * 100),
      AVG(uptime),
      SUM(packets_received),
      SUM(packets_sent),
      COUNT(*)
    FROM node_metrics
    WHERE time >= now() - interval '14 days'
    GROUP BY 1
    ON CONFLICT (bucket) DO UPDATE SET
      node_count = EXCLUDED.node_count,
      total_storage = EXCLUDED.total_storage,
      avg_cpu = EXCLUDED.avg_cpu,
      avg_ram_percent = EXCLUDED.avg_ram_percent,
      avg_uptime = EXCLUDED.avg_uptime,
      total_packets_received = EXCLUDED.total_packets_received,
      total_packets_sent = EXCLUDED.total_packets_sent,
      sample_count = EXCLUDED.sample_count
  `;
}

/** Refresh every rollup grain (node hourly/daily/weekly + network hourly/daily). */
export async function refreshAllRollups(client: RawExecClient): Promise<void> {
  await upsertNodeHourly(client);
  await upsertNodeDaily(client);
  await upsertNodeWeekly(client);
  await upsertNetworkHourly(client);
  await upsertNetworkDaily(client);
}
