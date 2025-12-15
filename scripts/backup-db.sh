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

# ==================================================================
# Off-site Backup to S3 (or compatible: Backblaze B2, Wasabi, MinIO)
# ==================================================================
# Enable by setting: AWS_S3_BUCKET=your-bucket-name
# Configure credentials: aws configure (or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY)
# ==================================================================

if [ -n "${AWS_S3_BUCKET:-}" ]; then
  if ! command -v aws &> /dev/null; then
    log_warn "AWS CLI not installed - skipping S3 upload"
    log_warn "Install with: pip3 install awscli"
  else
    # Determine S3 path with date-based organization
    S3_PATH="s3://${AWS_S3_BUCKET}/backups/$(date +%Y)/$(date +%m)/"
    S3_FULL_PATH="${S3_PATH}$(basename "$BACKUP_FILE")"

    log_info "Uploading to S3: ${S3_FULL_PATH}"

    # Upload with STANDARD_IA storage class (cost-effective for backups)
    if aws s3 cp "$BACKUP_FILE" "$S3_FULL_PATH" \
      --storage-class "${AWS_S3_STORAGE_CLASS:-STANDARD_IA}" \
      --metadata "database=${POSTGRES_DB},timestamp=${TIMESTAMP},host=${POSTGRES_HOST}" \
      ${AWS_ENDPOINT_URL:+--endpoint-url "$AWS_ENDPOINT_URL"} 2>&1; then

      log_info "S3 upload completed successfully"

      # Create/update "latest" symlink for easy restore
      aws s3 cp "$BACKUP_FILE" "s3://${AWS_S3_BUCKET}/backups/latest.dump" \
        --storage-class STANDARD \
        ${AWS_ENDPOINT_URL:+--endpoint-url "$AWS_ENDPOINT_URL"} 2>/dev/null || true

      # Clean old S3 backups (retention policy)
      S3_RETENTION_DAYS="${S3_RETENTION_DAYS:-90}"
      if [ "$S3_RETENTION_DAYS" -gt 0 ]; then
        log_info "Cleaning S3 backups older than ${S3_RETENTION_DAYS} days..."
        CUTOFF_DATE=$(date -d "-${S3_RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${S3_RETENTION_DAYS}d +%Y-%m-%d)

        # List and delete old backups
        aws s3 ls "s3://${AWS_S3_BUCKET}/backups/" --recursive \
          ${AWS_ENDPOINT_URL:+--endpoint-url "$AWS_ENDPOINT_URL"} 2>/dev/null | \
        while read -r line; do
          FILE_DATE=$(echo "$line" | awk '{print $1}')
          FILE_PATH=$(echo "$line" | awk '{print $4}')
          if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]] && [[ "$FILE_PATH" == *".dump" ]] && [[ "$FILE_PATH" != *"latest.dump" ]]; then
            log_info "Deleting old S3 backup: ${FILE_PATH}"
            aws s3 rm "s3://${AWS_S3_BUCKET}/${FILE_PATH}" \
              ${AWS_ENDPOINT_URL:+--endpoint-url "$AWS_ENDPOINT_URL"} 2>/dev/null || true
          fi
        done
      fi
    else
      log_error "S3 upload failed - backup saved locally only"
    fi
  fi
else
  log_info "S3 backup not configured (set AWS_S3_BUCKET to enable)"
fi

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
