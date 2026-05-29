#!/bin/bash
set -euo pipefail

# Single-container production deploy for pNode Pulse.
# Replaces the previous blue/green script (removed): this app is a single
# low-traffic instance, so a brief restart blip is acceptable and the extra
# moving parts (nginx upstream switching, profiles) were not worth the risk.
#
# Critically, this uses `--no-deps`: the web deploy recreates ONLY the `green`
# web container and never touches postgres/redis/collector. nginx points at
# host port 7001 permanently, so there is no upstream to switch.

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
SERVICE="${SERVICE:-green}"
CONTAINER="pnode-pulse-web-${SERVICE}"
MAX_HEALTH_CHECKS="${MAX_HEALTH_CHECKS:-60}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-2}"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }
error() { log "ERROR: $*" >&2; exit 1; }

log "=== Deploying ${SERVICE} (single-container) ==="

log "Pulling latest image..."
docker compose -f "$COMPOSE_FILE" pull "$SERVICE"

log "Recreating ${SERVICE} (--no-deps: postgres/redis untouched)..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE"

log "Waiting for ${SERVICE} to become healthy..."
checks=0
while [ "$checks" -lt "$MAX_HEALTH_CHECKS" ]; do
  status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || echo "unknown")
  if [ "$status" = "healthy" ]; then
    log "${SERVICE} is healthy. Deployment complete."
    docker compose -f "$COMPOSE_FILE" ps "$SERVICE"
    exit 0
  fi
  checks=$((checks + 1))
  log "Health check ${checks}/${MAX_HEALTH_CHECKS} (status: ${status}), retrying in ${HEALTH_CHECK_INTERVAL}s..."
  sleep "$HEALTH_CHECK_INTERVAL"
done

error "${SERVICE} did not become healthy after $((MAX_HEALTH_CHECKS * HEALTH_CHECK_INTERVAL))s. Inspect with: docker compose logs --tail 50 ${SERVICE}  — and roll back by re-deploying the previous image tag (see .github/workflows/README.md)."
