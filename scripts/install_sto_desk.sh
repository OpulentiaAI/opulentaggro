#!/usr/bin/env bash
# Import STO desk pages (Module Def, Page, Workspace) into bench DB — idempotent.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BENCH="${STO_BENCH_PATH:-/Users/jeremyalston/Perfect/sto-frappe-bench}"
SITE="${STO_SITE:-sto.local}"
export PATH="/opt/homebrew/opt/mariadb@10.6/bin:${HOME}/Library/Python/3.9/bin:${PATH}"

log() { echo "[install_sto_desk] $*"; }

if [[ ! -d "$BENCH" ]]; then
  log "Bench not found at $BENCH"
  exit 1
fi

log "Sync intercompany module from workspace fork"
rsync -a "$ROOT/erpnext/erpnext/intercompany/" "$BENCH/apps/erpnext/erpnext/intercompany/"
rsync -a "$ROOT/erpnext/erpnext/public/js/intercompany/" "$BENCH/apps/erpnext/erpnext/public/js/intercompany/" 2>/dev/null || true

cd "$BENCH"
bench --site "$SITE" console <<'PY'
import frappe
if not frappe.db.exists("Module Def", "Intercompany"):
    frappe.get_doc({"doctype":"Module Def","module_name":"Intercompany","app_name":"erpnext","custom":0}).insert(ignore_permissions=True)
    print("Created Module Def Intercompany")
frappe.db.commit()
PY

for doc in \
  apps/erpnext/erpnext/intercompany/page/sto_dashboard/sto_dashboard.json \
  apps/erpnext/erpnext/intercompany/page/sto_trace/sto_trace.json \
  apps/erpnext/erpnext/intercompany/workspace/intercompany/intercompany.json; do
  bench --site "$SITE" import-doc "$doc" >/dev/null 2>&1 || bench --site "$SITE" import-doc "$doc"
done

bench build --app erpnext >/dev/null
bench --site "$SITE" clear-cache >/dev/null
log "OK — STO desk pages installed (sto-dashboard, sto-trace, Intercompany workspace)"
