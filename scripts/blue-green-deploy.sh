#!/bin/bash
set -euo pipefail

# Blue/Green Deployment Script for pNode Pulse
# Performs zero-downtime deployment by switching between blue and green environments

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BLUE_PORT=7000
GREEN_PORT=7001
MAX_HEALTH_CHECKS=60
HEALTH_CHECK_INTERVAL=2
NGINX_CONFIG="/etc/nginx/sites-enabled/pulse.rectorspace.com"

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

# Check if a service is healthy using Docker's health status
is_healthy() {
  local service=$1
  local container_name="pnode-pulse-web-${service}"
  local status
  status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unhealthy")
  [ "$status" = "healthy" ]
}

# Wait for service to become healthy
wait_for_health() {
  local service=$1
  local checks=0

  log "Waiting for $service to become healthy..."

  while [ $checks -lt $MAX_HEALTH_CHECKS ]; do
    if is_healthy "$service"; then
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
  if is_running "blue" && is_healthy "blue"; then
    echo "blue"
  elif is_running "green" && is_healthy "green"; then
    echo "green"
  else
    # If neither is running or both are unhealthy, default to blue
    echo "blue"
  fi
}

# Switch nginx to point to a specific port
switch_nginx() {
  local target_port=$1
  local old_port=$2

  log "Switching nginx from port $old_port to port $target_port..."

  # Check if nginx config exists
  if [ ! -f "$NGINX_CONFIG" ]; then
    log "WARNING: Nginx config not found at $NGINX_CONFIG, skipping nginx switch"
    return 0
  fi

  # Update nginx config to point to new port
  if sudo sed -i "s/localhost:${old_port}/localhost:${target_port}/g" "$NGINX_CONFIG"; then
    log "Updated nginx config"
  else
    error "Failed to update nginx config"
  fi

  # Test nginx configuration
  if sudo nginx -t 2>&1; then
    log "Nginx config test passed"
  else
    # Rollback the change
    log "Nginx config test failed, rolling back..."
    sudo sed -i "s/localhost:${target_port}/localhost:${old_port}/g" "$NGINX_CONFIG"
    error "Nginx config test failed, rolled back changes"
  fi

  # Reload nginx
  if sudo systemctl reload nginx; then
    log "Nginx reloaded successfully"
  else
    error "Failed to reload nginx"
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
    ACTIVE_PORT=$BLUE_PORT
  else
    TARGET_ENV="blue"
    TARGET_PORT=$BLUE_PORT
    ACTIVE_PORT=$GREEN_PORT
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
  wait_for_health "$TARGET_ENV"

  # Switch nginx to point to new environment
  switch_nginx "$TARGET_PORT" "$ACTIVE_PORT"

  log "Traffic now routed to $TARGET_ENV (port $TARGET_PORT)"

  # Stop old environment
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
