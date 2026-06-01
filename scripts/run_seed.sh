#!/usr/bin/env bash
# Sync MCP alignment seed into bench and run via bench execute.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BENCH="${STO_BENCH_PATH:-/Users/jeremyalston/Perfect/sto-frappe-bench}"
SITE="${STO_SITE:-sto.local}"
export PATH="/opt/homebrew/opt/mariadb@10.6/bin:${HOME}/Library/Python/3.9/bin:${PATH}"

TARGET="$BENCH/apps/erpnext/erpnext/intercompany/mcp_alignment_seed.py"
log() { echo "[run_seed] $*"; }

if [[ ! -d "$BENCH" ]]; then
  log "Bench not found at $BENCH — run ./scripts/setup_bench.sh first"
  exit 1
fi

log "Sync seed script → erpnext.intercompany.mcp_alignment_seed"
cp "$ROOT/scripts/seed_mcp_alignment.py" "$TARGET"

"$ROOT/scripts/install_sto_desk.sh"

log "Running bench --site $SITE execute erpnext.intercompany.mcp_alignment_seed.run"
cd "$BENCH"
RESULT=$(bench --site "$SITE" execute erpnext.intercompany.mcp_alignment_seed.run)
log "Seed result: $RESULT"
log "OK — MCP alignment master data seeded"
