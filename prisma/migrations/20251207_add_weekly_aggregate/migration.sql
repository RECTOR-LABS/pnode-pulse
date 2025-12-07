-- ============================================
-- Phase 2: Weekly Aggregates & Network Trends
-- Issue #28: Create hourly/daily/weekly aggregations
-- ============================================

-- Create weekly aggregate for long-term node trends
CREATE MATERIALIZED VIEW node_metrics_weekly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 week', time) AS bucket,
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

-- Refresh weekly aggregate once per week (3 weeks lookback to cover 2+ buckets)
SELECT add_continuous_aggregate_policy('node_metrics_weekly',
  start_offset => INTERVAL '3 weeks',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 day');

-- ============================================
-- Network-Level Aggregates for Trend Charts
-- ============================================

-- Network-wide hourly aggregate for dashboard trends
CREATE MATERIALIZED VIEW network_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  COUNT(DISTINCT node_id) AS node_count,
  SUM(file_size) AS total_storage,
  AVG(cpu_percent) AS avg_cpu,
  AVG(ram_used::float / NULLIF(ram_total, 0) * 100) AS avg_ram_percent,
  AVG(uptime) AS avg_uptime,
  SUM(packets_received) AS total_packets_received,
  SUM(packets_sent) AS total_packets_sent,
  COUNT(*) AS sample_count
FROM node_metrics
GROUP BY bucket
WITH NO DATA;

-- Refresh network hourly aggregate every 30 minutes
SELECT add_continuous_aggregate_policy('network_metrics_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes');

-- Network-wide daily aggregate for long-term trends
CREATE MATERIALIZED VIEW network_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  COUNT(DISTINCT node_id) AS node_count,
  SUM(file_size) AS total_storage,
  AVG(cpu_percent) AS avg_cpu,
  AVG(ram_used::float / NULLIF(ram_total, 0) * 100) AS avg_ram_percent,
  AVG(uptime) AS avg_uptime,
  SUM(packets_received) AS total_packets_received,
  SUM(packets_sent) AS total_packets_sent,
  COUNT(*) AS sample_count
FROM node_metrics
GROUP BY bucket
WITH NO DATA;

-- Refresh network daily aggregate once per day
SELECT add_continuous_aggregate_policy('network_metrics_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');

-- ============================================
-- Enhanced Network Stats Table
-- ============================================

-- Add version distribution JSON column for tracking version trends
ALTER TABLE network_stats ADD COLUMN IF NOT EXISTS version_distribution JSONB;

-- Add index for efficient JSON queries
CREATE INDEX IF NOT EXISTS network_stats_version_distribution_idx
ON network_stats USING GIN (version_distribution);
