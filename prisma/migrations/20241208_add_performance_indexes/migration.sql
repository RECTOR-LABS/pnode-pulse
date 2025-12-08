-- Add Performance Indexes for Query Optimization
-- Issue #116: Database Query Optimization

-- Index for Node.version (frequent filtering and groupBy)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "nodes_version_idx" ON "nodes" ("version");

-- Index for Node.lastSeen (frequent ordering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "nodes_last_seen_idx" ON "nodes" ("last_seen" DESC NULLS LAST);

-- Composite index for Node filtering (isActive + version)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "nodes_active_version_idx" ON "nodes" ("is_active", "version");

-- Composite index for Node filtering (isActive + lastSeen for sorted active nodes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "nodes_active_last_seen_idx" ON "nodes" ("is_active", "last_seen" DESC NULLS LAST);

-- Index for NodeMetric time-based queries without node filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS "node_metrics_time_idx" ON "node_metrics" ("time" DESC);

-- Partial index for active nodes only (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "nodes_active_only_idx" ON "nodes" ("id") WHERE "is_active" = true;

-- Index for alerts by status (common filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "alerts_status_triggered_idx" ON "alerts" ("status", "triggered_at" DESC);

-- Index for collection jobs recent queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "collection_jobs_recent_idx" ON "collection_jobs" ("started_at" DESC) WHERE "status" = 'COMPLETED';

-- Add comment for documentation
COMMENT ON INDEX "nodes_version_idx" IS 'Optimizes version filtering and groupBy queries';
COMMENT ON INDEX "nodes_last_seen_idx" IS 'Optimizes ordering by lastSeen';
COMMENT ON INDEX "nodes_active_version_idx" IS 'Optimizes combined isActive + version queries';
COMMENT ON INDEX "nodes_active_last_seen_idx" IS 'Optimizes sorted active node queries';
