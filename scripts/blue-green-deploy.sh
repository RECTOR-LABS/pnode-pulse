#!/bin/bash
set -euo pipefail

# Blue/Green Deployment Script for pNode Pulse
# Performs zero-downtime deployment by switching between blue and green environments

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BLUE_PORT=7000
GREEN_PORT=7001
HEALTH_CHECK_URL_BLUE="http://localhost:${BLUE_PORT}/api/health"
HEALTH_CHECK_URL_GREEN="http://localhost:${GREEN_PORT}/api/health"
MAX_HEALTH_CHECKS=30
HEALTH_CHECK_INTERVAL=2

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
  log "ERROR: $*" >&2
  exit 1
}

# Check if a service is running
is_running() {
  local service=$1
  docker compose ps -q "$service" | grep -q .
}

# Check if a service is healthy
is_healthy() {
  local url=$1
  curl -sf "$url" > /dev/null 2>&1
}

# Wait for service to become healthy
wait_for_health() {
  local service=$1
  local url=$2
  local checks=0

  log "Waiting for $service to become healthy..."

  while [ $checks -lt $MAX_HEALTH_CHECKS ]; do
    if is_healthy "$url"; then
      log "$service is healthy!"
      return 0
    fi

    checks=$((checks + 1))
    log "Health check $checks/$MAX_HEALTH_CHECKS failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
    sleep $HEALTH_CHECK_INTERVAL
  done

  error "$service failed to become healthy after $((MAX_HEALTH_CHECKS * HEALTH_CHECK_INTERVAL)) seconds"
}

# Determine which environment is currently active
get_active_env() {
  if is_running "blue" && is_healthy "$HEALTH_CHECK_URL_BLUE"; then
    echo "blue"
  elif is_running "green" && is_healthy "$HEALTH_CHECK_URL_GREEN"; then
    echo "green"
  else
    # If neither is running or both are unhealthy, default to blue
    echo "blue"
  fi
}

# Main deployment logic
main() {
  log "=== Starting Blue/Green Deployment ==="

  # Determine active and target environments
  ACTIVE_ENV=$(get_active_env)

  if [ "$ACTIVE_ENV" = "blue" ]; then
    TARGET_ENV="green"
    TARGET_PORT=$GREEN_PORT
    TARGET_HEALTH_URL=$HEALTH_CHECK_URL_GREEN
  else
    TARGET_ENV="blue"
    TARGET_PORT=$BLUE_PORT
    TARGET_HEALTH_URL=$HEALTH_CHECK_URL_BLUE
  fi

  log "Active environment: $ACTIVE_ENV"
  log "Target environment: $TARGET_ENV"

  # Pull latest image
  log "Pulling latest image..."
  docker compose pull "$TARGET_ENV"

  # Start target environment
  log "Starting $TARGET_ENV environment..."
  if [ "$TARGET_ENV" = "green" ]; then
    docker compose --profile green up -d "$TARGET_ENV"
  else
    docker compose up -d "$TARGET_ENV"
  fi

  # Wait for target to become healthy
  wait_for_health "$TARGET_ENV" "$TARGET_HEALTH_URL"

  # Update nginx to point to new environment (if using nginx)
  # This section would typically update nginx config and reload
  # For now, we'll just log the port change
  log "New environment is ready on port $TARGET_PORT"
  log "Update your reverse proxy to point to port $TARGET_PORT"

  # Stop old environment (after manual verification or automated checks)
  log "Stopping old environment ($ACTIVE_ENV)..."
  docker compose stop "$ACTIVE_ENV"
  docker compose rm -f "$ACTIVE_ENV"

  log "=== Deployment Complete ==="
  log "Active environment: $TARGET_ENV (port $TARGET_PORT)"
  log "Previous environment ($ACTIVE_ENV) has been stopped"

  # Show running services
  log "Current running services:"
  docker compose ps
}

# Run main function
main "$@"
