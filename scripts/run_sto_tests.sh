#!/usr/bin/env bash
# Run STO test suite (mock MCP + optional live API if ERPNEXT_* set).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"
if [[ -f "$ROOT/erpnext-mcp-server/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/erpnext-mcp-server/.env"
  set +a
fi

echo "=== Docker infra status ==="
if command -v docker >/dev/null 2>&1; then
  (cd docker && docker compose ps 2>/dev/null) || echo "Docker compose not running — start with: cd docker && docker compose up -d"
else
  echo "Docker not available"
fi

echo ""
echo "=== MCP STO tool tests (mock) ==="
cd erpnext-mcp-server
npm run build --silent
node tests/sto-tools.test.mjs

echo ""
echo "=== STO API integration tests ==="
cd "$ROOT"
python3 scripts/test_sto_api.py "$@" || true

echo ""
echo "Done. See docs/erpnext-sto-test-setup.md for full setup."
