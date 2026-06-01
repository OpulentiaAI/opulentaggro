#!/usr/bin/env bash
# Capture original ERPNext + Vercel port screenshots for 1:1 comparison.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"
SS="${ROOT}/docs/screenshots/1to1-comparison"
JSON="${ROOT}/docs/mcp-stdio-results.json"
ERPNEXT_URL="${ERPNEXT_URL:-http://localhost:8000}"
VERCEL_URL="${VERCEL_URL:-http://localhost:3000}"
SITE_USER="${ERPNEXT_DEV_USER:-${DEMO_ADMIN_USER:-Administrator}}"
SITE_PASS="${ERPNEXT_DEV_PASSWORD:-${FRAPPE_ADMIN_PASSWORD:-${DEMO_ADMIN_PASSWORD:-}}}"
export ERPNEXT_NO_AUTH=1
export PATH="/opt/homebrew/opt/mariadb@10.6/bin:${HOME}/Library/Python/3.9/bin:${HOME}/.npm-global/bin:${PATH}"

PO=$(python3 -c "import json; d=json.load(open('$JSON')); print(d.get('po_name') or '')")
SI=$(python3 -c "import json; d=json.load(open('$JSON')); print(d.get('pair_si') or d.get('si_name') or '')")
PI=$(python3 -c "import json; d=json.load(open('$JSON')); print(d.get('pair_pi') or d.get('pi_name') or '')")
DN=$(python3 -c "
import json
d=json.load(open('$JSON'))
for r in d.get('results',[]):
    if r.get('tool')=='sto_post_goods_in_transit' and r.get('response'):
        print(r['response'].get('delivery_note',''))
        break
")

log() { echo "[1to1] $*"; }
mkdir -p "$SS"
command -v agent-browser >/dev/null || { echo "agent-browser required"; exit 1; }

browser_login_erp() {
  agent-browser set viewport 1440 900 >/dev/null
  agent-browser open "${ERPNEXT_URL}" >/dev/null
  agent-browser wait 2000 >/dev/null
  SNAP=$(agent-browser snapshot -i 2>/dev/null || true)
  if echo "$SNAP" | grep -q 'textbox "Email"'; then
    agent-browser fill @e2 "$SITE_USER" >/dev/null
    agent-browser fill @e3 "$SITE_PASS" >/dev/null
    agent-browser click @e5 >/dev/null
    agent-browser wait 3000 >/dev/null
  fi
}

shot_pair() {
  local name="$1"
  local erp_path="$2"
  local vercel_path="$3"
  log "Capturing $name..."
  agent-browser open "${ERPNEXT_URL}${erp_path}" >/dev/null
  agent-browser wait 4000 >/dev/null
  agent-browser screenshot "${SS}/original-${name}.png" --full >/dev/null
  agent-browser open "${VERCEL_URL}${vercel_path}" >/dev/null
  agent-browser wait 4000 >/dev/null
  agent-browser screenshot "${SS}/vercel-${name}.png" --full >/dev/null
}

wait_po() {
  agent-browser wait --text "$PO" 8000 2>/dev/null || {
    agent-browser reload >/dev/null
    agent-browser wait 3000 >/dev/null
    agent-browser wait --text "$PO" 12000 2>/dev/null || true
  }
}

curl -sf "${ERPNEXT_URL}/api/method/ping" >/dev/null || exit 1
curl -sf "${VERCEL_URL}/app/sto-dashboard" >/dev/null || exit 1

browser_login_erp

# 01 STO dashboard
shot_pair "sto-dashboard" "/app/sto-dashboard" "/app/sto-dashboard"
wait_po
agent-browser open "${ERPNEXT_URL}/app/sto-dashboard" >/dev/null
agent-browser wait 3000 >/dev/null
wait_po
agent-browser screenshot "${SS}/original-sto-create.png" --full >/dev/null
agent-browser open "${VERCEL_URL}/app/sto-dashboard" >/dev/null
agent-browser wait 3000 >/dev/null
wait_po
agent-browser screenshot "${SS}/vercel-sto-create.png" --full >/dev/null

# 03 PO form
shot_pair "sto-submit-approve" "/app/purchase-order/${PO}" "/app/purchase-order/${PO}"

# 04 GIT delivery note
if [[ -n "$DN" ]]; then
  shot_pair "sto-git" "/app/delivery-note/${DN}" "/app/delivery-note/${DN}"
else
  shot_pair "sto-git" "/app/delivery-note" "/app/delivery-note"
fi

shot_pair "sto-ic-invoice" "/app/sales-invoice" "/app/sales-invoice"
shot_pair "sto-receipt" "/app/purchase-receipt" "/app/purchase-receipt"

# 07 trace — Vercel dedicated trace page
agent-browser open "${ERPNEXT_URL}/app/purchase-order/${PO}" >/dev/null
agent-browser wait 5000 >/dev/null
agent-browser screenshot "${SS}/original-sto-trace.png" --full >/dev/null
agent-browser open "${VERCEL_URL}/app/sto-trace?purchase_order=${PO}" >/dev/null
agent-browser wait 5000 >/dev/null
agent-browser screenshot "${SS}/vercel-sto-trace.png" --full >/dev/null

# 08 three-way (PO completed on ERP; trace on Vercel)
agent-browser open "${ERPNEXT_URL}/app/purchase-order/${PO}" >/dev/null
agent-browser wait 5000 >/dev/null
agent-browser screenshot "${SS}/original-sto-three-way-match.png" --full >/dev/null
agent-browser open "${VERCEL_URL}/app/sto-trace?purchase_order=${PO}" >/dev/null
agent-browser wait 5000 >/dev/null
agent-browser screenshot "${SS}/vercel-sto-three-way-match.png" --full >/dev/null

shot_pair "ic-list-accounts" "/app/intercompany" "/app/intercompany"

if [[ -n "$SI" ]]; then
  shot_pair "ic-invoice-pair" "/app/sales-invoice/${SI}" "/app/sales-invoice/${SI}"
fi
if [[ -n "$PI" ]]; then
  shot_pair "ic-invoice-status" "/app/purchase-invoice/${PI}" "/app/purchase-invoice/${PI}"
fi

# summary dashboard
agent-browser open "${ERPNEXT_URL}/app/sto-dashboard" >/dev/null
agent-browser wait 4000 >/dev/null
wait_po
agent-browser screenshot "${SS}/original-summary-report.png" --full >/dev/null
agent-browser open "${VERCEL_URL}/app/sto-dashboard" >/dev/null
agent-browser wait 4000 >/dev/null
wait_po
agent-browser screenshot "${SS}/vercel-summary-report.png" --full >/dev/null

agent-browser close >/dev/null 2>&1 || true
log "Done — screenshots in ${SS}/"
ls -1 "$SS"/*.png 2>/dev/null
