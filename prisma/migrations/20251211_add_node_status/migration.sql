-- Add NodeStatus enum and status field to nodes table
-- Migration: 20251211_add_node_status

-- Create NodeStatus enum
CREATE TYPE "NodeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- Add status column to nodes table with default ACTIVE
ALTER TABLE "nodes" ADD COLUMN "status" "NodeStatus" NOT NULL DEFAULT 'ACTIVE';

-- Create indexes for efficient status-based queries
CREATE INDEX "nodes_status_idx" ON "nodes"("status");
CREATE INDEX "nodes_status_last_seen_idx" ON "nodes"("status", "last_seen" DESC);

-- Initialize status based on existing isActive and lastSeen
-- Nodes that are not active become INACTIVE
UPDATE "nodes" SET "status" = 'INACTIVE' WHERE "is_active" = false;

-- Nodes not seen in >7 days become ARCHIVED
UPDATE "nodes" SET "status" = 'ARCHIVED'
WHERE "last_seen" IS NOT NULL
  AND "last_seen" < NOW() - INTERVAL '7 days';

-- Nodes not seen in >24 hours but <7 days become INACTIVE
UPDATE "nodes" SET "status" = 'INACTIVE'
WHERE "status" = 'ACTIVE'
  AND "last_seen" IS NOT NULL
  AND "last_seen" < NOW() - INTERVAL '24 hours';

-- ============================================
-- TimescaleDB Retention Policy for node_metrics
-- ============================================
-- Note: Only run if TimescaleDB is installed and node_metrics is a hypertable

-- Compression policy: compress chunks older than 30 days
-- SELECT add_compression_policy('node_metrics', INTERVAL '30 days');

-- Retention policy: drop data older than 90 days
-- SELECT add_retention_policy('node_metrics', INTERVAL '90 days');

-- To enable these policies, run the following SQL manually after confirming TimescaleDB setup:
--
-- ALTER TABLE node_metrics SET (
--   timescaledb.compress,
--   timescaledb.compress_segmentby = 'node_id'
-- );
-- SELECT add_compression_policy('node_metrics', INTERVAL '30 days');
-- SELECT add_retention_policy('node_metrics', INTERVAL '90 days');
