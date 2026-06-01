#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"
BENCH="${BENCH_DIR:-${STO_BENCH_PATH:-/Users/jeremyalston/Perfect/sto-frappe-bench}}"
export PATH="/opt/homebrew/opt/mariadb@10.6/bin:${HOME}/Library/Python/3.9/bin:${PATH}"

"$ROOT/scripts/start_infra.sh"

if ! lsof -i :8000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[start_all] Starting bench at $BENCH"
  (cd "$BENCH" && bench use sto.local && bench start) &
  sleep 8
else
  echo "[start_all] Port 8000 already in use (bench may already be running)"
fi

echo "[start_all] ERPNext: ${FRAPPE_SITE_URL:-http://localhost:8000} (site ${FRAPPE_SITE_NAME:-sto.local}, credentials in config/demo-credentials.env)"
echo "[start_all] MCP: cd erpnext-mcp-server && node build/index.js (stdio)"
