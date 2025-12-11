-- AlterTable: Add v0.7.0 fields to nodes table
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN;
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "rpc_port" INTEGER;

-- AlterTable: Add v0.7.0 fields to node_metrics table
ALTER TABLE "node_metrics" ADD COLUMN IF NOT EXISTS "storage_committed" BIGINT;
ALTER TABLE "node_metrics" ADD COLUMN IF NOT EXISTS "storage_usage_percent" DOUBLE PRECISION;

-- CreateIndex: Add index on is_public for filtering public/private nodes
CREATE INDEX IF NOT EXISTS "nodes_is_public_idx" ON "nodes"("is_public");

-- Comments for documentation
COMMENT ON COLUMN "nodes"."is_public" IS 'Whether RPC port is publicly accessible (from v0.7.0+ get-pods-with-stats)';
COMMENT ON COLUMN "nodes"."rpc_port" IS 'RPC service port, typically 6000 (from v0.7.0+ get-pods-with-stats)';
COMMENT ON COLUMN "node_metrics"."storage_committed" IS 'Total storage allocated in bytes (from v0.7.0+ get-pods-with-stats)';
COMMENT ON COLUMN "node_metrics"."storage_usage_percent" IS 'Storage utilization percentage (from v0.7.0+ get-pods-with-stats)';
