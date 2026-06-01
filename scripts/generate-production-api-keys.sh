#!/usr/bin/env bash
# Generate ERPNext API keys on Railway (or local bench) and print env var names for Vercel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh" 2>/dev/null || true

SITE="${FRAPPE_SITE_NAME:-${STO_SITE:-sto.local}}"
BENCH="${BENCH_DIR:-${STO_BENCH_PATH:-/Users/jeremyalston/Perfect/sto-frappe-bench}}"

log() { echo "[generate-api-keys] $*"; }

if command -v railway >/dev/null 2>&1 && railway whoami >/dev/null 2>&1; then
  log "Generating keys on Railway site: $SITE"
  railway run bench --site "$SITE" execute \
    erpnext.intercompany.print_admin_api_keys.run 2>/dev/null || \
  railway run bench --site "$SITE" execute \
    frappe.core.doctype.user.user.generate_keys --args '["Administrator"]'
  log "Retrieve keys from ERPNext desk: User → Administrator → API Access"
elif [[ -d "$BENCH" ]]; then
  log "Generating keys on local bench site: $SITE"
  cd "$BENCH"
  bench --site "$SITE" execute \
    frappe.core.doctype.user.user.generate_keys --args '["Administrator"]'
  log "Keys stored in tabUser for Administrator — check desk or DB"
else
  log "No Railway auth or local bench. Generate manually on hosted site:"
  log "  User → Administrator → API Access → Generate Keys"
  exit 1
fi

log ""
log "Set these on Vercel (Production + Preview):"
log "  ERPNEXT_URL"
log "  ERPNEXT_API_KEY"
log "  ERPNEXT_API_SECRET"
log "  NEXT_PUBLIC_ERPNEXT_URL"
log "  NEXT_PUBLIC_APP_NAME=OpulentAggro"
log "  MCP_AUTH_TOKEN (optional, recommended for /api/mcp)"
