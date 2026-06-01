#!/usr/bin/env bash
# Verify MCP build, mock tests, and tool-registry parity with TypeScript tool names.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCP="$ROOT/erpnext-mcp-server"
REGISTRY="$ROOT/.cursor/skills/mcp-db-alignment/references/tool-registry.md"
FAIL=0

log() { echo "[verify_mcp_alignment] $*"; }

log "npm run build..."
(cd "$MCP" && npm run build >/dev/null)

log "Mock tests..."
(cd "$MCP" && node tests/sto-tools.test.mjs)
(cd "$MCP" && node tests/ic-billing-tools.test.mjs)

log "Registry vs sto-tools.ts..."
for tool in sto_create sto_submit sto_approve_and_route sto_post_goods_in_transit \
  sto_create_ic_invoice sto_post_goods_receipt sto_get_trace sto_three_way_match sto_list; do
  if ! grep -q "\`${tool}\`" "$REGISTRY" 2>/dev/null && ! grep -q "| \`${tool}\`" "$REGISTRY"; then
    echo "MISSING in registry: $tool"
    FAIL=1
  fi
  if ! grep -q "\"${tool}\"" "$MCP/src/sto-tools.ts"; then
    echo "MISSING in sto-tools.ts: $tool"
    FAIL=1
  fi
done

log "Registry vs ic-billing-tools.ts..."
for tool in ic_list_accounts ic_create_sales_invoice ic_create_purchase_invoice \
  ic_create_invoice_pair ic_submit_invoice ic_get_invoice_status; do
  if ! grep -q "\`${tool}\`" "$REGISTRY"; then
    echo "MISSING in registry: $tool"
    FAIL=1
  fi
  if ! grep -q "\"${tool}\"" "$MCP/src/ic-billing-tools.ts"; then
    echo "MISSING in ic-billing-tools.ts: $tool"
    FAIL=1
  fi
done

log "Python test script syntax..."
python3 -m py_compile "$ROOT/scripts/test_all_mcp_endpoints.py"
python3 -m py_compile "$ROOT/scripts/seed_mcp_alignment.py"

if [[ "$FAIL" -ne 0 ]]; then
  log "FAILED — fix registry or tool definitions"
  exit 1
fi

log "OK — MCP alignment checks passed"
