-- Migration: Use pubkey as primary node identifier
-- Issue: #164
--
-- Changes:
-- 1. Add unique constraint on nodes.pubkey (nullable - allows multiple NULLs)
-- 2. Create node_address_changes table to track IP changes
-- 3. Remove redundant pubkey index (unique constraint creates one)

-- Step 1: Handle any duplicate pubkeys by keeping the most recent node
-- This sets older duplicates to NULL so the unique constraint can be applied
WITH duplicates AS (
  SELECT id, pubkey,
    ROW_NUMBER() OVER (PARTITION BY pubkey ORDER BY last_seen DESC NULLS LAST, id DESC) as rn
  FROM nodes
  WHERE pubkey IS NOT NULL
)
UPDATE nodes
SET pubkey = NULL
FROM duplicates
WHERE nodes.id = duplicates.id
  AND duplicates.rn > 1;

-- Step 2: Drop the existing non-unique index on pubkey
DROP INDEX IF EXISTS "nodes_pubkey_idx";

-- Step 3: Add unique constraint on pubkey
-- PostgreSQL allows multiple NULLs in unique constraints by default
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_pubkey_key" UNIQUE ("pubkey");

-- Step 4: Create node_address_changes table to track IP changes
CREATE TABLE "node_address_changes" (
  "id" BIGSERIAL NOT NULL,
  "node_id" INTEGER NOT NULL,
  "old_address" TEXT NOT NULL,
  "new_address" TEXT NOT NULL,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "node_address_changes_pkey" PRIMARY KEY ("id")
);

-- Step 5: Add indexes for efficient queries
CREATE INDEX "node_address_changes_node_id_idx" ON "node_address_changes"("node_id");
CREATE INDEX "node_address_changes_detected_at_idx" ON "node_address_changes"("detected_at" DESC);

-- Step 6: Add foreign key constraint
ALTER TABLE "node_address_changes" ADD CONSTRAINT "node_address_changes_node_id_fkey"
  FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rollback instructions:
-- DROP TABLE IF EXISTS "node_address_changes";
-- ALTER TABLE "nodes" DROP CONSTRAINT IF EXISTS "nodes_pubkey_key";
-- CREATE INDEX "nodes_pubkey_idx" ON "nodes"("pubkey");
