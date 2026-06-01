#!/usr/bin/env bash
# One-time: set sto.local Administrator password to DEMO_ADMIN_PASSWORD from credentials file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/opt/mariadb@10.6/bin:${HOME}/Library/Python/3.9/bin:${PATH}"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"

BENCH="${BENCH_DIR:-${STO_BENCH_PATH:-/Users/jeremyalston/Perfect/sto-frappe-bench}}"
SITE="${FRAPPE_SITE_NAME:-sto.local}"
PASS="${DEMO_ADMIN_PASSWORD:-${FRAPPE_ADMIN_PASSWORD:-}}"

if [[ -z "$PASS" ]]; then
  echo "[set_demo_admin_password] DEMO_ADMIN_PASSWORD not set in config/demo-credentials.env" >&2
  exit 1
fi

if [[ ! -d "$BENCH/sites/$SITE" ]]; then
  echo "[set_demo_admin_password] Site $SITE not found at $BENCH" >&2
  exit 1
fi

echo "[set_demo_admin_password] Setting Administrator password on $SITE..."
(cd "$BENCH" && bench --site "$SITE" set-admin-password "$PASS")
echo "[set_demo_admin_password] Done — login: ${DEMO_ADMIN_USER:-Administrator} / (see config/demo-credentials.env)"
