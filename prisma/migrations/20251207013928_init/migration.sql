-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "nodes" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "gossipAddress" TEXT,
    "pubkey" TEXT,
    "version" TEXT,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_metrics" (
    "id" BIGSERIAL NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "node_id" INTEGER NOT NULL,
    "cpu_percent" DOUBLE PRECISION,
    "ram_used" BIGINT,
    "ram_total" BIGINT,
    "uptime" INTEGER,
    "file_size" BIGINT,
    "total_bytes" BIGINT,
    "total_pages" INTEGER,
    "current_index" INTEGER,
    "packets_received" INTEGER,
    "packets_sent" INTEGER,
    "active_streams" INTEGER,

    CONSTRAINT "node_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_peers" (
    "id" SERIAL NOT NULL,
    "node_id" INTEGER NOT NULL,
    "peer_node_id" INTEGER,
    "peer_address" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "peer_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_peers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_stats" (
    "id" SERIAL NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_nodes" INTEGER NOT NULL,
    "active_nodes" INTEGER NOT NULL,
    "total_storage" BIGINT NOT NULL,
    "avg_cpu_percent" DOUBLE PRECISION NOT NULL,
    "avg_ram_percent" DOUBLE PRECISION NOT NULL,
    "avg_uptime" INTEGER NOT NULL,
    "total_peers" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_jobs" (
    "id" SERIAL NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "nodes_polled" INTEGER NOT NULL DEFAULT 0,
    "nodes_success" INTEGER NOT NULL DEFAULT 0,
    "nodes_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "collection_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nodes_address_key" ON "nodes"("address");

-- CreateIndex
CREATE INDEX "nodes_address_idx" ON "nodes"("address");

-- CreateIndex
CREATE INDEX "nodes_pubkey_idx" ON "nodes"("pubkey");

-- CreateIndex
CREATE INDEX "nodes_is_active_idx" ON "nodes"("is_active");

-- CreateIndex
CREATE INDEX "node_metrics_node_id_time_idx" ON "node_metrics"("node_id", "time" DESC);

-- CreateIndex
CREATE INDEX "node_peers_node_id_idx" ON "node_peers"("node_id");

-- CreateIndex
CREATE INDEX "node_peers_peer_node_id_idx" ON "node_peers"("peer_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "node_peers_node_id_peer_address_key" ON "node_peers"("node_id", "peer_address");

-- CreateIndex
CREATE INDEX "network_stats_time_idx" ON "network_stats"("time" DESC);

-- CreateIndex
CREATE INDEX "collection_jobs_status_idx" ON "collection_jobs"("status");

-- CreateIndex
CREATE INDEX "collection_jobs_started_at_idx" ON "collection_jobs"("started_at" DESC);

-- AddForeignKey
ALTER TABLE "node_metrics" ADD CONSTRAINT "node_metrics_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_peers" ADD CONSTRAINT "node_peers_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_peers" ADD CONSTRAINT "node_peers_peer_node_id_fkey" FOREIGN KEY ("peer_node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- TimescaleDB Configuration
-- ============================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Drop the primary key constraint temporarily (hypertables need the time column as part of PK)
ALTER TABLE "node_metrics" DROP CONSTRAINT "node_metrics_pkey";

-- Convert node_metrics to a TimescaleDB hypertable
-- Chunk interval of 1 day for optimal performance
SELECT create_hypertable('node_metrics', 'time', chunk_time_interval => INTERVAL '1 day');

-- Re-add a composite primary key including time for hypertable compatibility
-- Note: Hypertables require the partitioning column in unique constraints
CREATE UNIQUE INDEX "node_metrics_pkey" ON "node_metrics" ("time", "id");

-- Add data retention policy (90 days)
-- Old data will be automatically dropped
SELECT add_retention_policy('node_metrics', INTERVAL '90 days');

-- Create continuous aggregate for hourly metrics
-- This pre-computes hourly averages for faster dashboard queries
CREATE MATERIALIZED VIEW node_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  node_id,
  AVG(cpu_percent) AS avg_cpu,
  AVG(ram_used::float / NULLIF(ram_total, 0) * 100) AS avg_ram_percent,
  MAX(uptime) AS max_uptime,
  MAX(file_size) AS max_file_size,
  MAX(total_bytes) AS max_total_bytes,
  SUM(packets_received) AS total_packets_received,
  SUM(packets_sent) AS total_packets_sent,
  COUNT(*) AS sample_count
FROM node_metrics
GROUP BY bucket, node_id
WITH NO DATA;

-- Add refresh policy for continuous aggregate (refresh every 30 minutes)
SELECT add_continuous_aggregate_policy('node_metrics_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes');

-- Create daily aggregate for long-term trends
CREATE MATERIALIZED VIEW node_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  node_id,
  AVG(cpu_percent) AS avg_cpu,
  AVG(ram_used::float / NULLIF(ram_total, 0) * 100) AS avg_ram_percent,
  MAX(uptime) AS max_uptime,
  MAX(file_size) AS max_file_size,
  MAX(total_bytes) AS max_total_bytes,
  SUM(packets_received) AS total_packets_received,
  SUM(packets_sent) AS total_packets_sent,
  COUNT(*) AS sample_count
FROM node_metrics
GROUP BY bucket, node_id
WITH NO DATA;

-- Refresh daily aggregate once per day
SELECT add_continuous_aggregate_policy('node_metrics_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');
