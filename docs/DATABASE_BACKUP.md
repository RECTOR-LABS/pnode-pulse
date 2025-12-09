# Database Backup & Restore Strategy

## Overview

pNode Pulse uses PostgreSQL with TimescaleDB extension for time-series data. This document outlines the backup and restore procedures to ensure data integrity and business continuity.

## Backup Strategy

### Schedule & Retention

| Frequency | Retention | Storage Location |
|-----------|-----------|------------------|
| **Daily** | 30 days | `/backups/pnode-pulse` on VPS |
| **Weekly** | 90 days | S3 (optional, off-site) |
| **Monthly** | 1 year | S3 Glacier (optional, archival) |

**Backup Time**: 2:00 AM UTC daily (scheduled via cron)

### Backup Components

- **Full Database**: All tables, indexes, sequences
- **TimescaleDB Hypertables**: `node_metrics`, `network_stats`, etc.
- **Schema**: Complete schema with all constraints
- **Data**: All historical and current data

### Backup Format

- **Format**: PostgreSQL custom format (`.dump`)
- **Compression**: Level 9 (maximum)
- **Typical Size**: ~100-500 MB (varies with data volume)
- **Growth Rate**: ~20-50 MB/day (estimated)

---

## Automated Backups

### Setup Cron Job

SSH into VPS as `pnodepulse` user and configure cron:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * POSTGRES_PASSWORD=$POSTGRES_PASSWORD POSTGRES_HOST=localhost POSTGRES_PORT=5434 /home/pnodepulse/pnode-pulse/scripts/backup-db.sh >> /var/log/pnode-pulse-backup.log 2>&1
```

### Manual Backup

```bash
# SSH to VPS
ssh pnodepulse

# Set environment variables
export POSTGRES_PASSWORD=<your_password>
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5434

# Run backup script
cd ~/pnode-pulse
./scripts/backup-db.sh
```

### Verify Backup

```bash
# List recent backups
ls -lh /backups/pnode-pulse/ | tail -5

# Check backup integrity
pg_restore --list /backups/pnode-pulse/pnode-pulse_20251209_020000.dump | head -20

# Get backup size
du -h /backups/pnode-pulse/pnode-pulse_20251209_020000.dump
```

---

## Restore Procedures

### Pre-Restore Checklist

- [ ] **Backup current state** (if database is still accessible)
- [ ] **Notify team** about planned downtime
- [ ] **Stop application services** to prevent data inconsistency
- [ ] **Verify backup file** exists and is not corrupted
- [ ] **Document reason** for restore (incident report)

### Full Database Restore

```bash
# SSH to VPS
ssh pnodepulse

# Set environment variables
export POSTGRES_PASSWORD=<your_password>
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5434

# Run restore script (DESTRUCTIVE - requires confirmation)
cd ~/pnode-pulse
./scripts/restore-db.sh /backups/pnode-pulse/pnode-pulse_20251209_020000.dump

# Follow prompts and type 'YES' to confirm
```

The script will:
1. ✋ **Prompt for confirmation** (destructive operation)
2. 🛑 **Stop application** (blue/green/staging containers)
3. 🗑️ **Drop existing objects** (`--clean --if-exists`)
4. 📥 **Restore from backup**
5. ✅ **Verify restoration** (count nodes and metrics)
6. 🚀 **Restart application**

### Partial Restore (Advanced)

If you need to restore specific tables only:

```bash
# List tables in backup
pg_restore --list /backups/pnode-pulse/pnode-pulse_20251209_020000.dump | grep TABLE

# Restore specific table
PGPASSWORD=$POSTGRES_PASSWORD pg_restore \
  -h localhost \
  -p 5434 \
  -U pnodepulse \
  -d pnodepulse \
  --table=nodes \
  /backups/pnode-pulse/pnode-pulse_20251209_020000.dump
```

---

## Backup Monitoring

### Health Checks

Create a simple monitoring script to verify backups are running:

```bash
#!/bin/bash
# Check if backup ran in last 26 hours

LATEST_BACKUP=$(ls -t /backups/pnode-pulse/pnode-pulse_*.dump | head -1)
BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))

if [ "$BACKUP_AGE_HOURS" -gt 26 ]; then
  echo "⚠️  WARNING: Last backup is ${BACKUP_AGE_HOURS} hours old"
  # Send alert to monitoring system
  exit 1
else
  echo "✓ Backup is current (${BACKUP_AGE_HOURS} hours old)"
  exit 0
fi
```

### Alerting

Configure alerts for:
- Backup fails to complete (cron sends email on error)
- Backup file size anomaly (too small = incomplete backup)
- No backup in 26 hours (missed schedule)
- Backup directory disk space < 20% free

---

## Disaster Recovery Scenarios

### Scenario 1: Database Corruption

**Symptoms**: Application errors, query failures, data inconsistencies

**Recovery**:
1. Stop application immediately
2. Backup corrupted database (if possible): `pg_dump -Fc > corrupted_backup.dump`
3. Restore from last known good backup
4. Assess data loss (time between last backup and corruption)
5. If recent backup, investigate logs to prevent recurrence

**RTO**: ~15-30 minutes  
**RPO**: Up to 24 hours (daily backups)

### Scenario 2: Accidental Data Deletion

**Symptoms**: Missing nodes, metrics, or other data

**Recovery**:
1. **DO NOT** run any DELETE or UPDATE queries
2. Immediately create backup of current state
3. Restore to staging environment from most recent backup
4. Extract deleted data from staging backup
5. Manually re-insert into production (or full restore if extensive)

**RTO**: ~1-4 hours  
**RPO**: Up to 24 hours

### Scenario 3: Complete Data Center Failure

**Symptoms**: VPS unreachable, hardware failure

**Recovery**:
1. Provision new VPS
2. Setup Docker, PostgreSQL, Redis
3. Download latest backup from S3 (if configured) or copy from local storage
4. Restore database
5. Deploy application containers
6. Update DNS if needed

**RTO**: ~4-8 hours  
**RPO**: Up to 24 hours (or minutes if using S3 + frequent backups)

---

## Off-Site Backups (Optional)

### AWS S3 Configuration

Enable S3 backups by uncommenting the S3 upload section in `backup-db.sh`:

```bash
# Install AWS CLI
pip3 install awscli

# Configure credentials
aws configure

# Set bucket in script
export AWS_S3_BUCKET=pnode-pulse-backups

# Backups will auto-upload to S3 on each run
```

### Storage Classes

| Class | Use Case | Cost |
|-------|----------|------|
| **STANDARD_IA** | Daily backups (30 days) | Low cost, fast retrieval |
| **GLACIER** | Monthly archives (1 year) | Very low cost, slow retrieval |

---

## Testing Restore Procedures

**CRITICAL**: Test restore procedures regularly!

### Quarterly Restore Test

1. **Setup test environment** (staging database)
2. **Select random backup** from last 30 days
3. **Restore to staging**
4. **Verify data integrity**: Check row counts, recent data
5. **Test application**: Ensure queries work, UI loads
6. **Document results**: Note any issues, update procedures

### Example Test Script

```bash
#!/bin/bash
# Quarterly restore test

BACKUP_FILE=$(ls -t /backups/pnode-pulse/*.dump | shuf -n 1)
echo "Testing restore of: $BACKUP_FILE"

# Restore to staging database
PGPASSWORD=$POSTGRES_PASSWORD pg_restore \
  -h localhost -p 5435 -U pnodepulse -d pnodepulse_staging \
  --clean --if-exists \
  "$BACKUP_FILE"

# Verify
PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -p 5435 -U pnodepulse -d pnodepulse_staging -c "
  SELECT 'Nodes: ' || COUNT(*) FROM nodes;
  SELECT 'Metrics: ' || COUNT(*) FROM node_metrics;
"

echo "✓ Restore test completed"
```

---

## Troubleshooting

### Backup Script Fails

**Error**: `POSTGRES_PASSWORD environment variable is required`  
**Fix**: Export password before running: `export POSTGRES_PASSWORD=<password>`

**Error**: `Permission denied: /backups/pnode-pulse`  
**Fix**: Create directory with correct permissions: `sudo mkdir -p /backups/pnode-pulse && sudo chown pnodepulse: /backups/pnode-pulse`

**Error**: Backup file is empty (0 bytes)  
**Fix**: Check PostgreSQL logs, ensure database is accessible, verify credentials

### Restore Script Fails

**Error**: `database "pnodepulse" does not exist`  
**Fix**: Create database first: `createdb -h localhost -p 5434 -U pnodepulse pnodepulse`

**Error**: `role "pnodepulse" does not exist`  
**Fix**: Restore to fresh PostgreSQL requires creating user first

**Error**: Application won't start after restore  
**Fix**: Check schema version, may need to run migrations: `npm run db:migrate`

---

## Security Considerations

- **Encrypt Backups**: S3 server-side encryption (AES-256) recommended
- **Access Control**: Limit backup file permissions: `chmod 600 /backups/*.dump`
- **Password Storage**: Use environment files, never hardcode in scripts
- **Audit Logs**: Log all backup/restore operations with timestamps
- **Offsite Storage**: Keep copies outside VPS in case of complete failure

---

## References

- **PostgreSQL Backup**: https://www.postgresql.org/docs/current/backup.html
- **TimescaleDB Backup**: https://docs.timescale.com/timescaledb/latest/how-to-guides/backup-and-restore/
- **pg_dump**: https://www.postgresql.org/docs/current/app-pgdump.html
- **pg_restore**: https://www.postgresql.org/docs/current/app-pgrestore.html

---

**Last Updated**: 2025-12-09  
**Owner**: DevOps Team  
**Review Schedule**: Quarterly
