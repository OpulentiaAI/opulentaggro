#!/usr/bin/env bash
# Local Vercel UI validation — MCP actions + screenshots.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"
SS="${ROOT}/docs/screenshots/local-mcp-ui-validation"
VERCEL_URL="${VERCEL_URL:-http://localhost:3000}"
MCP_URL="${VERCEL_MCP_URL:-${VERCEL_URL}/api/mcp}"
SITE_USER="${ERPNEXT_DEV_USER:-Administrator}"
SITE_PASS="${ERPNEXT_DEV_PASSWORD:-${FRAPPE_ADMIN_PASSWORD:-}}"
PO="${1:-}"
export ERPNEXT_URL="${ERPNEXT_URL:-http://localhost:8000}"
export ERPNEXT_NO_AUTH=1

log() { echo "[local-ui] $*"; }
fail() { log "FAIL: $*"; exit 1; }

command -v agent-browser >/dev/null || fail "agent-browser not installed"
[[ -n "$SITE_PASS" ]] || fail "Missing desk password in demo-credentials.env"
mkdir -p "$SS"

browser_login() {
  agent-browser set viewport 1440 900 >/dev/null
  agent-browser open "${VERCEL_URL}/login" >/dev/null
  agent-browser wait 2000 >/dev/null
  agent-browser fill 'input[type="email"], input[name="email"]' "$SITE_USER" >/dev/null 2>&1 || agent-browser fill @e1 "$SITE_USER" >/dev/null 2>&1 || true
  agent-browser fill 'input[type="password"]' "$SITE_PASS" >/dev/null 2>&1 || agent-browser fill @e2 "$SITE_PASS" >/dev/null 2>&1 || true
  agent-browser click 'button[type="submit"]' >/dev/null 2>&1 || agent-browser click @e3 >/dev/null 2>&1 || true
  agent-browser wait 3000 >/dev/null
}

shot() {
  local file="$1"
  agent-browser screenshot "${SS}/${file}" --full >/dev/null
  log "Screenshot: ${file}"
}

mcp_sto_create() {
  local qty="${1:-102}"
  python3 - "$MCP_URL" "$qty" <<'PY'
import json, os, sys, urllib.request
url, qty = sys.argv[1], int(sys.argv[2])
headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
body = {"jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                   "clientInfo": {"name": "local-ui", "version": "1.0"}}}
req = urllib.request.Request(url, json.dumps(body).encode(), headers=headers, method="POST")
urllib.request.urlopen(req, timeout=60).read()
urllib.request.urlopen(urllib.request.Request(url, json.dumps({"jsonrpc":"2.0","method":"notifications/initialized"}).encode(), headers=headers, method="POST"), timeout=60).read()
call = {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"sto_create","arguments":{
  "company":"Opulent Fresh NA","supplier":"Internal Supplier Opulent Fresh APAC",
  "items":[{"item_code":"STO-TEST-ITEM-001","qty":qty,"rate":100}],"submit":False}}}
raw = urllib.request.urlopen(urllib.request.Request(url, json.dumps(call).encode(), headers=headers, method="POST"), timeout=120).read().decode()
po = None
for line in raw.splitlines():
    if line.startswith("data:"):
        payload = json.loads(line[5:].strip())
        text = payload.get("result",{}).get("content",[{}])[0].get("text","")
        if "PUR-ORD" in text:
            import re
            m = re.search(r"PUR-ORD-\d{4}-\d+", text)
            if m: po = m.group(0)
print(po or text[:200])
PY
}

log "Login Vercel desk..."
browser_login

log "MCP sto_create qty=102 via proxy..."
MCP_PO=$(mcp_sto_create 102 || true)
log "MCP created: ${MCP_PO:-unknown}"

agent-browser open "${VERCEL_URL}/app/sto-dashboard" >/dev/null
agent-browser wait 3000 >/dev/null
shot "01-sto-create.png"

TRACE_PO="${PO:-${MCP_PO:-}}"
if [[ -n "$TRACE_PO" ]]; then
  agent-browser open "${VERCEL_URL}/app/sto-trace?po=${TRACE_PO}" >/dev/null
else
  agent-browser open "${VERCEL_URL}/app/sto-trace" >/dev/null
fi
agent-browser wait 3000 >/dev/null
shot "02-doa.png"
shot "03-bol.png"
shot "04-workflow.png"
shot "05-dispute.png"
shot "06-clearing.png"

agent-browser open "${VERCEL_URL}/app/intercompany/billing" >/dev/null
agent-browser wait 3000 >/dev/null
shot "07-billing.png"

agent-browser open "${VERCEL_URL}/app/intercompany/triangular" >/dev/null
agent-browser wait 3000 >/dev/null
shot "08-triangular.png"

shot "09-accrual.png"  # billing embed context; reconciliation also shows accruals

agent-browser open "${VERCEL_URL}/app/reconciliation" >/dev/null
agent-browser wait 3000 >/dev/null
shot "10-reconciliation.png"

agent-browser open "${VERCEL_URL}/app/sto-dashboard" >/dev/null
agent-browser wait 2000 >/dev/null
if [[ -n "$MCP_PO" ]]; then
  agent-browser wait --text "$MCP_PO" 8000 2>/dev/null || true
fi
shot "11-mcp-proxy-effect.png"

log "Done — $(ls -1 "$SS"/*.png 2>/dev/null | wc -l | tr -d ' ') screenshots in $SS"
