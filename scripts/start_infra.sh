#!/usr/bin/env bash
# Start STO local infrastructure: MariaDB (Docker) + Redis (Docker or Homebrew).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$ROOT/docker"

log() { echo "[start_infra] $*"; }

start_redis_queue_local() {
  if redis-cli -p "${STO_REDIS_QUEUE_PORT:-6380}" ping >/dev/null 2>&1; then
    log "Redis queue already listening on port ${STO_REDIS_QUEUE_PORT:-6380}"
    return 0
  fi
  log "Starting local Redis queue on port ${STO_REDIS_QUEUE_PORT:-6380}..."
  redis-server --port "${STO_REDIS_QUEUE_PORT:-6380}" --daemonize yes --save "" --appendonly no
  redis-cli -p "${STO_REDIS_QUEUE_PORT:-6380}" ping
}

start_docker_compose() {
  if ! command -v docker >/dev/null 2>&1; then
    log "Docker CLI not found — skip MariaDB container"
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    log "Docker daemon not running — start Docker Desktop, then re-run this script"
    return 1
  fi
  cd "$DOCKER_DIR"
  # MariaDB only when Homebrew Redis already uses 6379 (common on macOS).
  local compose_services="mariadb"
  if ! redis-cli -p "${STO_REDIS_CACHE_PORT:-6379}" ping >/dev/null 2>&1; then
    compose_services="mariadb redis-cache redis-queue"
    log "No local Redis on :6379 — starting Redis containers too"
  fi
  local profile_args=()
  if [[ "$compose_services" != "mariadb" ]]; then
    profile_args=(--profile redis)
  fi
  if docker compose version >/dev/null 2>&1; then
    docker compose "${profile_args[@]}" up -d $compose_services
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "${profile_args[@]}" up -d $compose_services
  else
    log "docker compose plugin not available"
    return 1
  fi
  docker compose ps 2>/dev/null || docker-compose ps
}

# Load demo credentials (required)
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"

log "=== Redis ==="
if redis-cli -p "${STO_REDIS_CACHE_PORT:-6379}" ping >/dev/null 2>&1; then
  log "Redis cache OK (127.0.0.1:${STO_REDIS_CACHE_PORT:-6379}) — Homebrew or existing instance"
else
  log "Redis cache not on :6379 — start with: brew services start redis"
fi
start_redis_queue_local

log ""
log "=== MariaDB (Docker) ==="
if start_docker_compose; then
  log "Waiting for MariaDB health..."
  sleep 3
  docker compose -f "$DOCKER_DIR/docker-compose.yml" ps 2>/dev/null || true
else
  log "MariaDB not started. Options:"
  log "  1) Start Docker Desktop → ./scripts/start_infra.sh"
  log "  2) brew install mariadb@10.6 && brew services start mariadb@10.6"
  log "     Then create user/db matching config/demo-credentials.env (frappe / frappe_dev)"
fi

log ""
log "Done. Connection defaults: docs/erpnext-sto-test-setup.md § Local values"
