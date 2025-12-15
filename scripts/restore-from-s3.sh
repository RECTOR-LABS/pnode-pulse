#!/bin/bash
# ==================================================================
# Restore Database from S3 Backup
# ==================================================================
# Downloads a backup from S3 and restores it to the database.
# Usage: ./scripts/restore-from-s3.sh [backup-file-name]
#        ./scripts/restore-from-s3.sh latest
#        ./scripts/restore-from-s3.sh pnode-pulse_20251215_020000.dump
# ==================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${GREEN}INFO${NC}: $*"; }
log_warn() { echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${YELLOW}WARN${NC}: $*"; }
log_error() { echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${RED}ERROR${NC}: $*" >&2; }

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/pnode-pulse}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5434}"
POSTGRES_USER="${POSTGRES_USER:-pnodepulse}"
POSTGRES_DB="${POSTGRES_DB:-pnodepulse}"

# Check required environment
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  log_error "POSTGRES_PASSWORD environment variable is required"
  exit 1
fi

if [ -z "${AWS_S3_BUCKET:-}" ]; then
  log_error "AWS_S3_BUCKET environment variable is required"
  log_info "Source your S3 config: source ~/.pnode-pulse-backup.env"
  exit 1
fi

if ! command -v aws &> /dev/null; then
  log_error "AWS CLI is not installed"
  exit 1
fi

# Parse arguments
BACKUP_NAME="${1:-}"

if [ -z "$BACKUP_NAME" ]; then
  echo ""
  echo -e "${BLUE}Available backups in S3:${NC}"
  echo ""

  LIST_CMD="aws s3 ls s3://${AWS_S3_BUCKET}/backups/ --recursive"
  if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
    LIST_CMD="$LIST_CMD --endpoint-url $AWS_ENDPOINT_URL"
  fi

  eval "$LIST_CMD" | grep ".dump" | tail -20 | while read -r line; do
    SIZE=$(echo "$line" | awk '{print $3}')
    SIZE_MB=$((SIZE / 1024 / 1024))
    FILE=$(echo "$line" | awk '{print $4}')
    DATE=$(echo "$line" | awk '{print $1 " " $2}')
    echo "  ${FILE} (${SIZE_MB} MB) - ${DATE}"
  done

  echo ""
  echo "Usage: $0 <backup-name>"
  echo "       $0 latest                    # Restore latest backup"
  echo "       $0 2025/12/pnode-pulse_20251215_020000.dump"
  exit 0
fi

# Determine S3 path
if [ "$BACKUP_NAME" = "latest" ]; then
  S3_PATH="s3://${AWS_S3_BUCKET}/backups/latest.dump"
  LOCAL_FILE="${BACKUP_DIR}/latest.dump"
else
  # Check if it's a full path or just filename
  if [[ "$BACKUP_NAME" == *"/"* ]]; then
    S3_PATH="s3://${AWS_S3_BUCKET}/backups/${BACKUP_NAME}"
  else
    # Search for the file
    log_info "Searching for backup: ${BACKUP_NAME}"
    SEARCH_CMD="aws s3 ls s3://${AWS_S3_BUCKET}/backups/ --recursive"
    if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
      SEARCH_CMD="$SEARCH_CMD --endpoint-url $AWS_ENDPOINT_URL"
    fi
    FOUND_PATH=$(eval "$SEARCH_CMD" | grep "$BACKUP_NAME" | head -1 | awk '{print $4}')

    if [ -z "$FOUND_PATH" ]; then
      log_error "Backup not found: ${BACKUP_NAME}"
      exit 1
    fi
    S3_PATH="s3://${AWS_S3_BUCKET}/${FOUND_PATH}"
  fi
  LOCAL_FILE="${BACKUP_DIR}/$(basename "$BACKUP_NAME")"
fi

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              S3 Database Restore                         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Source:   ${GREEN}${S3_PATH}${NC}"
echo -e "  Target:   ${YELLOW}${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}${NC}"
echo ""
echo -e "${RED}⚠️  WARNING: This will OVERWRITE the current database!${NC}"
echo ""
read -p "Type 'YES' to proceed: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
  log_info "Restore cancelled"
  exit 0
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Download from S3
log_info "Downloading backup from S3..."
DOWNLOAD_CMD="aws s3 cp $S3_PATH $LOCAL_FILE"
if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
  DOWNLOAD_CMD="$DOWNLOAD_CMD --endpoint-url $AWS_ENDPOINT_URL"
fi

if ! eval "$DOWNLOAD_CMD"; then
  log_error "Failed to download backup from S3"
  exit 1
fi

if [ ! -s "$LOCAL_FILE" ]; then
  log_error "Downloaded file is empty"
  exit 1
fi

DOWNLOAD_SIZE=$(du -h "$LOCAL_FILE" | cut -f1)
log_info "Downloaded: ${LOCAL_FILE} (${DOWNLOAD_SIZE})"

# Stop application containers
log_info "Stopping application containers..."
cd "$(dirname "$0")/.." || exit 1

docker compose stop blue green staging 2>/dev/null || true

# Perform restore
log_info "Restoring database..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "$LOCAL_FILE" 2>&1 | grep -v "^pg_restore:" || true

# Verify restore
log_info "Verifying restore..."
NODE_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM nodes;" 2>/dev/null | tr -d ' ')
METRIC_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM node_metrics;" 2>/dev/null | tr -d ' ')

log_info "Restored data: ${NODE_COUNT} nodes, ${METRIC_COUNT} metrics"

# Restart application
log_info "Restarting application containers..."
docker compose up -d blue 2>/dev/null || log_warn "Could not restart containers (may need manual start)"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Restore Complete!                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Backup source: ${S3_PATH}"
echo "  Local copy:    ${LOCAL_FILE}"
echo "  Nodes:         ${NODE_COUNT}"
echo "  Metrics:       ${METRIC_COUNT}"
echo ""
