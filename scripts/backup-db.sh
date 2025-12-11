#!/bin/bash
# ==================================================================
# pNode Pulse Database Backup Script
# ==================================================================
# Performs compressed PostgreSQL/TimescaleDB backups with verification
# Usage: ./scripts/backup-db.sh
# Cron: 0 2 * * * /app/scripts/backup-db.sh >> /var/log/backup.log 2>&1
# ==================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/pnode-pulse}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5434}"
POSTGRES_USER="${POSTGRES_USER:-pnodepulse}"
POSTGRES_DB="${POSTGRES_DB:-pnodepulse}"

# Derived values
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pnode-pulse_${TIMESTAMP}.dump"
LOG_PREFIX="[$(date +'%Y-%m-%d %H:%M:%S')]"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${LOG_PREFIX} ${GREEN}INFO${NC}: $*"; }
log_warn() { echo -e "${LOG_PREFIX} ${YELLOW}WARN${NC}: $*"; }
log_error() { echo -e "${LOG_PREFIX} ${RED}ERROR${NC}: $*" >&2; }

# Validate required environment variables
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  log_error "POSTGRES_PASSWORD environment variable is required"
  exit 1
fi

log_info "Starting database backup..."
log_info "Database: ${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
log_info "Backup directory: ${BACKUP_DIR}"

# Create backup directory
mkdir -p "$BACKUP_DIR"
if [ ! -d "$BACKUP_DIR" ]; then
  log_error "Failed to create backup directory: ${BACKUP_DIR}"
  exit 1
fi

# Perform backup (custom format with compression level 9)
log_info "Dumping database to: ${BACKUP_FILE}"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --compress=9 \
  --verbose \
  -f "$BACKUP_FILE" 2>&1 | grep -v "^pg_dump:"

# Verify backup
if [ ! -s "$BACKUP_FILE" ]; then
  log_error "Backup file is empty or missing: ${BACKUP_FILE}"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "Backup completed successfully (${BACKUP_SIZE})"

# Upload to S3 (optional - uncomment when configured)
# if command -v aws &> /dev/null && [ -n "${AWS_S3_BUCKET:-}" ]; then
#   log_info "Uploading to S3: s3://${AWS_S3_BUCKET}/backups/"
#   aws s3 cp "$BACKUP_FILE" "s3://${AWS_S3_BUCKET}/backups/" \
#     --storage-class STANDARD_IA \
#     --metadata "database=${POSTGRES_DB},timestamp=${TIMESTAMP}"
#   log_info "S3 upload completed"
# fi

# Clean old backups
log_info "Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "pnode-pulse_*.dump" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
  log_info "Deleted ${DELETED_COUNT} old backup(s)"
else
  log_info "No old backups to delete"
fi

# List recent backups
log_info "Recent backups:"
ls -lh "$BACKUP_DIR"/pnode-pulse_*.dump 2>/dev/null | tail -5 | awk '{print "  " $9 " (" $5 ")"}'

log_info "Backup process completed successfully"
echo ""
echo "✓ Backup file: ${BACKUP_FILE}"
echo "✓ Size: ${BACKUP_SIZE}"
echo "✓ Retention: ${RETENTION_DAYS} days"
