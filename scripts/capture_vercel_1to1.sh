#!/usr/bin/env bash
# Re-capture Vercel port screenshots only (after ERPNext auth fix).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/load_env.sh"
SS="${ROOT}/docs/screenshots/1to1-comparison"
JSON="${ROOT}/docs/mcp-stdio-results.json"
VERCEL_URL="${VERCEL_URL:-http://localhost:3000}"
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
export PATH="${HOME}/.npm-global/bin:${PATH}"

agent-browser set viewport 1440 900 >/dev/null

shot() {
  agent-browser open "${VERCEL_URL}$1" >/dev/null
  agent-browser wait 4000 >/dev/null
  agent-browser screenshot "${SS}/vercel-$2.png" --full >/dev/null
  echo "vercel-$2.png"
}

shot "/app/sto-dashboard" "sto-dashboard"
shot "/app/sto-dashboard" "sto-create"
# sto-create uses same route; dialog state not captured separately
shot "/app/purchase-order/${PO}" "sto-submit-approve"
if [[ -n "$DN" ]]; then
  shot "/app/delivery-note/${DN}" "sto-git"
else
  shot "/app/delivery-note" "sto-git"
fi
shot "/app/sales-invoice" "sto-ic-invoice"
shot "/app/purchase-receipt" "sto-receipt"
shot "/app/sto-trace?purchase_order=${PO}" "sto-trace"
shot "/app/sto-trace?purchase_order=${PO}" "sto-three-way-match"
shot "/app/intercompany" "ic-list-accounts"
[[ -n "$SI" ]] && shot "/app/sales-invoice/${SI}" "ic-invoice-pair"
[[ -n "$PI" ]] && shot "/app/purchase-invoice/${PI}" "ic-invoice-status"
shot "/app/sto-dashboard" "summary-report"

agent-browser close >/dev/null 2>&1 || true
