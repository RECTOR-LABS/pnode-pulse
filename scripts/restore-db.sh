#!/bin/bash
# ==================================================================
# pNode Pulse Database Restore Script
# ==================================================================
# Restores PostgreSQL/TimescaleDB from backup file
# Usage: ./scripts/restore-db.sh <backup_file>
# Example: ./scripts/restore-db.sh /backups/pnode-pulse/pnode-pulse_20251209_020000.dump
# ==================================================================

set -euo pipefail

# Configuration
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5434}"
POSTGRES_USER="${POSTGRES_USER:-pnodepulse}"
POSTGRES_DB="${POSTGRES_DB:-pnodepulse}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}INFO${NC}: $*"; }
log_warn() { echo -e "${YELLOW}WARN${NC}: $*"; }
log_error() { echo -e "${RED}ERROR${NC}: $*" >&2; }

# Validate arguments
BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  log_error "Backup file is required"
  echo ""
  echo "Usage: $0 <backup_file>"
  echo ""
  echo "Example:"
  echo "  $0 /backups/pnode-pulse/pnode-pulse_20251209_020000.dump"
  echo ""
  echo "List available backups:"
  echo "  ls -lh /backups/pnode-pulse/"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  log_error "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# Validate required environment variables
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  log_error "POSTGRES_PASSWORD environment variable is required"
  exit 1
fi

# Display restore information
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ""
log_warn "====================================="
log_warn " DATABASE RESTORE - DANGER ZONE"
log_warn "====================================="
echo ""
echo "  Database: ${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "  Backup:   ${BACKUP_FILE} (${BACKUP_SIZE})"
echo ""
log_warn "This will:"
log_warn "  1. Stop application services (web, collector)"
log_warn "  2. Drop and recreate database objects"
log_warn "  3. Restore from backup"
log_warn "  4. Restart application services"
echo ""
log_error "⚠️  ALL CURRENT DATA WILL BE LOST ⚠️"
echo ""

# Confirmation prompt
read -p "Are you sure you want to proceed? (type 'YES' to continue): " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
  log_info "Restore cancelled"
  exit 0
fi

# Stop application services
log_info "Stopping application services..."
if command -v docker &> /dev/null && docker compose ps &> /dev/null; then
  docker compose stop blue green staging 2>/dev/null || true
  log_info "Application services stopped"
else
  log_warn "Docker Compose not available or not running"
fi

# Perform restore
log_info "Restoring database from: ${BACKUP_FILE}"
PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --verbose \
  "$BACKUP_FILE" 2>&1 | grep -v "^pg_restore:"

log_info "Database restore completed"

# Restart application services
if command -v docker &> /dev/null && docker compose ps &> /dev/null; then
  log_info "Restarting application services..."
  docker compose up -d blue 2>/dev/null || docker compose up -d staging 2>/dev/null || true
  log_info "Application services restarted"
fi

# Verification
log_info "Verifying restore..."
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -c "SELECT 'Nodes: ' || COUNT(*) FROM nodes;" \
  -c "SELECT 'Metrics: ' || COUNT(*) FROM node_metrics;" \
  -t

echo ""
log_info "✓ Restore process completed successfully"
echo "  Restored from: ${BACKUP_FILE}"
echo "  Database: ${POSTGRES_DB}"
echo ""
log_warn "IMPORTANT: Verify data integrity before resuming normal operations"
