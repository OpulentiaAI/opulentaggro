#!/usr/bin/env bash
# One-time Frappe bench + sto.local site for STO dev (paths without spaces).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"
BENCH="${BENCH_DIR:-${STO_BENCH_PATH:-/Users/jeremyalston/Perfect/sto-frappe-bench}}"
ERPNext_FORK="${ROOT}/erpnext"
export PATH="/opt/homebrew/opt/mariadb@10.6/bin:${HOME}/Library/Python/3.9/bin:${PATH}"

log() { echo "[setup_bench] $*"; }

if [[ ! -d "$BENCH" ]]; then
  log "Initializing bench at $BENCH"
  bench init "$BENCH" --frappe-branch version-15 --python python3.11 --skip-redis-config-generation
fi

cp "$ROOT/config/bench/common_site_config.json" "$BENCH/sites/common_site_config.json"

cd "$BENCH"
if [[ ! -d apps/erpnext ]]; then
  bench get-app erpnext --branch version-15
fi

log "Sync intercompany STO module from workspace fork into ERPNext v15"
rsync -a "$ERPNext_FORK/erpnext/intercompany/" apps/erpnext/erpnext/intercompany/
rsync -a "$ERPNext_FORK/erpnext/public/js/intercompany/" apps/erpnext/erpnext/public/js/intercompany/ 2>/dev/null || true
cp "$ROOT/scripts/seed_sto_test_data.py" apps/erpnext/erpnext/intercompany/sto_test_seed.py

./env/bin/pip install -e apps/erpnext

if [[ ! -d sites/sto.local ]]; then
  bench new-site sto.local \
    --db-root-password "${STO_MYSQL_ROOT_PASSWORD:-sto_root_dev}" \
    --admin-password "${FRAPPE_ADMIN_PASSWORD:-${DEMO_ADMIN_PASSWORD:-}}" \
    --mariadb-user-host-login-scope=localhost \
    --db-host 127.0.0.1 \
    --db-port 3306
fi

bench --site sto.local install-app erpnext
bench --site sto.local set-config developer_mode 1
bench --site sto.local migrate
bench build --app erpnext

bench --site sto.local execute erpnext.setup.setup_wizard.operations.install_fixtures.install --kwargs '{"country": "United States"}' || true
bench --site sto.local execute erpnext.intercompany.sto_test_seed.run

log "Generate API keys: bench --site sto.local execute frappe.core.doctype.user.user.generate_keys --args '[\"Administrator\"]'"
log "Bench ready at $BENCH — run: ./scripts/start_all.sh"
