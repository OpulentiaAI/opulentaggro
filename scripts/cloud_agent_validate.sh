#!/usr/bin/env bash
# Cloud agent validation wrapper — health checks + hosted MCP E2E + browser checklist.
# Usage:
#   source scripts/load_cloud_agent_env.sh
#   ./scripts/cloud_agent_validate.sh
#   ./scripts/cloud_agent_validate.sh --direct-only
#   ./scripts/cloud_agent_validate.sh --skip-e2e
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/load_cloud_agent_env.sh"

ERPNEXT_URL="${ERPNEXT_URL:-https://erpnext-production-512a.up.railway.app}"
VERCEL_URL="${VERCEL_URL:-https://vercel-indol-phi-69.vercel.app}"
VERCEL_MCP_URL="${VERCEL_MCP_URL:-${VERCEL_URL}/api/mcp}"
REPORT="${REPORT:-docs/hosted-mcp-results.json}"

DIRECT_ONLY=0
SKIP_E2E=0
for arg in "$@"; do
  case "$arg" in
    --direct-only) DIRECT_ONLY=1 ;;
    --skip-e2e) SKIP_E2E=1 ;;
  esac
done

log() { echo "[cloud_agent_validate] $*"; }
fail=0

log "=== Phase A: Health ==="

log "Railway ping: $ERPNEXT_URL/api/method/ping"
if curl -sf "${ERPNEXT_URL%/}/api/method/ping" | grep -qi pong; then
  log "  ✓ Railway ping OK"
else
  log "  ✗ Railway ping FAILED"
  fail=1
fi

log "Vercel health: $VERCEL_URL/api/health"
if health=$(curl -sf "${VERCEL_URL%/}/api/health" 2>/dev/null); then
  reachable=$(echo "$health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('components',{}).get('erpnext',{}).get('reachable', False))" 2>/dev/null || echo "False")
  desk_ok=$(echo "$health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('components',{}).get('erpnext',{}).get('deskBootHealthy', False))" 2>/dev/null || echo "False")
  if [[ "$reachable" == "True" ]]; then
    log "  ✓ ERPNext reachable via Vercel"
  else
    log "  ✗ ERPNext not reachable via Vercel"
    fail=1
  fi
  if [[ "$desk_ok" == "True" ]]; then
    log "  ✓ deskBootHealthy"
  else
    log "  ✗ deskBootHealthy false — embeds may fail"
    fail=1
  fi
else
  log "  ✗ Vercel health endpoint unreachable"
  fail=1
fi

if [[ -n "${ERPNEXT_API_KEY:-}" && -n "${ERPNEXT_API_SECRET:-}" ]]; then
  log "API auth probe"
  if curl -sf -H "Authorization: token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}" \
    "${ERPNEXT_URL%/}/api/method/frappe.auth.get_logged_user" | grep -q Administrator; then
    log "  ✓ API token valid (Administrator)"
  else
    log "  ✗ API token invalid — get keys from Railway logs: grep ERPNEXT_API_KEY="
    fail=1
  fi
else
  log "  ⚠ ERPNEXT_API_KEY/SECRET not set — skipping auth probe"
fi

if [[ "$SKIP_E2E" -eq 1 ]]; then
  log "Skipping E2E (--skip-e2e)"
else
  log ""
  log "=== Phase B/C: Hosted MCP E2E ==="
  e2e_args=(--report "$REPORT")
  if [[ "$DIRECT_ONLY" -eq 1 ]]; then
    e2e_args+=(--direct-only)
  fi
  export VERCEL_MCP_URL
  if python3 "$ROOT/scripts/test_hosted_mcp_e2e.py" "${e2e_args[@]}"; then
    log "  ✓ Hosted MCP E2E passed"
  else
    log "  ✗ Hosted MCP E2E failed — see $REPORT"
    fail=1
  fi
fi

log ""
log "=== Phase E: Alignment gate ==="
if "$ROOT/scripts/verify_mcp_alignment.sh"; then
  log "  ✓ MCP alignment OK"
else
  log "  ✗ MCP alignment FAILED"
  fail=1
fi

log ""
log "=== Phase D: Browser validation checklist (manual / computer use) ==="
cat <<EOF

Complete these steps after API/MCP tests pass:

  [ ] Open ${VERCEL_URL}/login
  [ ] Login: Administrator / OpulentAggro-Demo-2026!
  [ ] Navigate ${VERCEL_URL}/app/sto-dashboard — screenshot baseline
  [ ] Run sto_create via MCP (qty=88, rate=50) if not already done
  [ ] Refresh dashboard — verify new PUR-ORD-* Draft \$4,400.00
  [ ] Screenshot: docs/screenshots/hosted-mcp-validation/08-mcp-action-in-ui.png
  [ ] Verify ${VERCEL_URL}/app/purchase-order (no "Page erpnext not found")
  [ ] Verify ${VERCEL_URL}/app/intercompany/billing
  [ ] Optional: ${VERCEL_URL}/app/sto-trace

Full runbook: docs/cloud-agent-mcp-browser-runbook.md

agent-browser quick start:
  agent-browser open ${VERCEL_URL}/login
  agent-browser open ${VERCEL_URL}/app/sto-dashboard
  agent-browser screenshot docs/screenshots/hosted-mcp-validation/01-sto-dashboard-baseline.png --full

EOF

if [[ "$fail" -ne 0 ]]; then
  log "OVERALL: FAIL — fix issues above before browser validation"
  exit 1
fi

log "OVERALL: API/MCP gates PASS — proceed with browser checklist (Phase D)"
exit 0
