# Migration: add_v070_fields

**Created:** 2024-12-09
**Issue:** #162
**Epic:** #97 (v0.7 Heidelberg Integration)

## Overview

Adds database fields to support Xandeum v0.7.0 `get-pods-with-stats` API.

## Changes

### nodes table
- `is_public` (BOOLEAN, nullable) - Whether RPC port is publicly accessible
- `rpc_port` (INTEGER, nullable) - RPC service port (typically 6000)
- Index on `is_public` for filtering

### node_metrics table
- `storage_committed` (BIGINT, nullable) - Total storage allocated in bytes
- `storage_usage_percent` (DOUBLE PRECISION, nullable) - Storage utilization percentage

## Safety

- ✅ All new columns are nullable (no data loss)
- ✅ Uses `IF NOT EXISTS` (idempotent)
- ✅ No NOT NULL constraints
- ✅ Backward compatible
- ✅ TimescaleDB hypertable compatible
- ✅ Rollback script provided

## Application

### Staging (Test First)
```bash
# SSH to staging VPS
ssh pnodepulse@176.222.53.185

# Backup database
pg_dump -h localhost -p 5434 -U pnodepulse pnodepulse > backup_pre_v070.sql

# Apply migration
psql -h localhost -p 5434 -U pnodepulse pnodepulse < prisma/migrations/20251209060207_add_v070_fields/migration.sql

# Verify
psql -h localhost -p 5434 -U pnodepulse pnodepulse -c "\d nodes"
psql -h localhost -p 5434 -U pnodepulse pnodepulse -c "\d node_metrics"
```

### Production
```bash
# Same process after staging verification
```

## Rollback

```bash
psql -h localhost -p 5434 -U pnodepulse pnodepulse < prisma/migrations/20251209060207_add_v070_fields/rollback.sql
```

## Verification Queries

```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('nodes', 'node_metrics')
AND column_name IN ('is_public', 'rpc_port', 'storage_committed', 'storage_usage_percent')
ORDER BY table_name, column_name;

-- Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'nodes'
AND indexname = 'nodes_is_public_idx';

-- Check column comments
SELECT
    c.table_name,
    c.column_name,
    pgd.description
FROM pg_catalog.pg_statio_all_tables AS st
INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
INNER JOIN information_schema.columns c ON (
    pgd.objsubid = c.ordinal_position AND
    c.table_name = st.relname
)
WHERE c.column_name IN ('is_public', 'rpc_port', 'storage_committed', 'storage_usage_percent')
ORDER BY c.table_name, c.column_name;
```

## Post-Migration

After successful migration:
1. Update issue #162 status
2. Proceed with #161 (worker updates)
3. Monitor logs for data collection
4. Verify new fields are being populated
