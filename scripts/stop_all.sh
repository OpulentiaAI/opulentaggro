#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"
BENCH="${BENCH_DIR:-$ROOT/frappe-bench}"
export PATH="${HOME}/Library/Python/3.9/bin:${PATH}"

log() { echo "[stop_all] $*"; }

if [[ -f "$BENCH/config/pids/bench-start.pid" ]]; then
  pid=$(cat "$BENCH/config/pids/bench-start.pid" 2>/dev/null || true)
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    log "Stopping bench supervisor (pid $pid)..."
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$BENCH/config/pids/bench-start.pid"
fi

if command -v bench >/dev/null 2>&1 && [[ -d "$BENCH/sites" ]]; then
  (cd "$BENCH" && bench stop >/dev/null 2>&1) || true
fi

log "Bench stopped (infra left running; use docker compose down in docker/ to stop MariaDB)."
