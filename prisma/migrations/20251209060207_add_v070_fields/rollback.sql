-- Rollback migration: Remove v0.7.0 fields
-- WARNING: This will delete data in these columns!
--
-- To rollback:
-- 1. Backup your database first!
-- 2. Run: psql $DATABASE_URL -f prisma/migrations/20251209060207_add_v070_fields/rollback.sql
-- 3. Remove migration from _prisma_migrations table

-- Drop indexes
DROP INDEX IF EXISTS "nodes_is_public_idx";

-- Drop columns from node_metrics table
ALTER TABLE "node_metrics" DROP COLUMN IF EXISTS "storage_usage_percent";
ALTER TABLE "node_metrics" DROP COLUMN IF EXISTS "storage_committed";

-- Drop columns from nodes table
ALTER TABLE "nodes" DROP COLUMN IF EXISTS "rpc_port";
ALTER TABLE "nodes" DROP COLUMN IF EXISTS "is_public";

-- Clean up migration record (manual step)
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20251209060207_add_v070_fields';
