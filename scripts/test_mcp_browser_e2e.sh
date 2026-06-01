#!/usr/bin/env bash
# MCP/API alteration → browser verification loop for STO dashboard.
# Requires: agent-browser, Playwright Chromium, running bench at :8000.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"
SS="${ROOT}/docs/screenshots"
CACHE="${HOME}/Library/Caches/ms-playwright"
export PATH="/opt/homebrew/opt/mariadb@10.6/bin:${HOME}/Library/Python/3.9/bin:${HOME}/.npm-global/bin:${PATH}"
ERPNEXT_URL="${ERPNEXT_URL:-http://localhost:8000}"
SITE_USER="${ERPNEXT_DEV_USER:-${DEMO_ADMIN_USER:-Administrator}}"
SITE_PASS="${ERPNEXT_DEV_PASSWORD:-${FRAPPE_ADMIN_PASSWORD:-${DEMO_ADMIN_PASSWORD:-}}}"
if [[ -z "$SITE_PASS" ]]; then
  echo "[test_mcp_browser_e2e] Missing desk password — set in config/demo-credentials.env" >&2
  exit 1
fi

log() { echo "[test_mcp_browser_e2e] $*"; }
fail() { log "FAIL: $*"; exit 1; }

command -v agent-browser >/dev/null || fail "agent-browser not installed (npm install -g agent-browser)"
curl -sf "${ERPNEXT_URL}/api/method/ping" >/dev/null || fail "ERPNext not reachable at ${ERPNEXT_URL}"

# agent-browser 0.13 expects Playwright build 1208; npx may install 1200 — symlink fallback
if [[ ! -d "${CACHE}/chromium_headless_shell-1208" && -d "${CACHE}/chromium_headless_shell-1200" ]]; then
  ln -sf "${CACHE}/chromium_headless_shell-1200" "${CACHE}/chromium_headless_shell-1208"
  ln -sf "${CACHE}/chromium-1200" "${CACHE}/chromium-1208" 2>/dev/null || true
  log "Linked Playwright 1200 → 1208 for agent-browser"
fi

mkdir -p "$SS"

# --- Shell: create STO via MCP stdio ---
log "Creating STO via MCP stdio (sto_create)..."
export ROOT
MCP_OUT=$(python3 <<'PY'
import json, os, subprocess, sys
root = os.environ["ROOT"]
env = {**os.environ, "ERPNEXT_NO_AUTH": "1", "ERPNEXT_URL": os.environ.get("ERPNEXT_URL", "http://localhost:8000")}
msgs = [
  {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"e2e","version":"1.0"}}},
  {"jsonrpc":"2.0","method":"notifications/initialized"},
  {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"sto_create","arguments":{
    "company":"Opulent Fresh NA",
    "supplier":"Internal Supplier Opulent Fresh EU",
    "warehouse":"Stores - OFNA",
    "items":[{"item_code":"STO-TEST-ITEM-001","qty":1,"rate":42}],
    "submit":False
  }}},
]
inp = "\n".join(json.dumps(m) for m in msgs) + "\n"
proc = subprocess.run(
  ["timeout", "20", f"{root}/scripts/run_mcp_server.sh"],
  input=inp, capture_output=True, text=True, env=env, cwd=root,
)
for line in proc.stdout.splitlines():
    if '"id":2' in line:
        data = json.loads(line)
        text = data["result"]["content"][0]["text"]
        if data["result"].get("isError"):
            print("ERROR", text, file=sys.stderr)
            sys.exit(1)
        po = json.loads(text)["purchase_order"]
        print(po)
        sys.exit(0)
print("ERROR: no MCP response", file=sys.stderr)
sys.exit(1)
PY
)
NEW_PO="$MCP_OUT"
log "MCP created PO: ${NEW_PO}"

# --- Browser: login + verify on sto-dashboard ---
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

agent-browser open "${ERPNEXT_URL}/app/sto-dashboard" >/dev/null
agent-browser wait 5000 >/dev/null

if ! agent-browser wait --text "$NEW_PO" 5000 2>/dev/null; then
  agent-browser reload >/dev/null
  agent-browser wait 4000 >/dev/null
  agent-browser wait --text "$NEW_PO" 10000 || fail "PO ${NEW_PO} not visible on sto-dashboard"
fi

COUNT=$(agent-browser get count "text=${NEW_PO}" 2>/dev/null || echo 0)
[[ "$COUNT" -ge 1 ]] || fail "Expected ${NEW_PO} in dashboard table"

agent-browser screenshot "${SS}/e2e-mcp-sto-create.png" --full >/dev/null
log "Browser verified ${NEW_PO} on sto-dashboard"

# --- Shell: run alteration suite (API-equivalent to MCP tools) ---
log "Running scripts/test_mcp_alterations.py..."
ERPNEXT_NO_AUTH=1 python3 "${ROOT}/scripts/test_mcp_alterations.py"

# --- Browser: intercompany workspace smoke ---
agent-browser open "${ERPNEXT_URL}/app/intercompany" >/dev/null
agent-browser wait 3000 >/dev/null
agent-browser screenshot "${SS}/e2e-intercompany-workspace.png" --full >/dev/null
log "Intercompany workspace loaded"

agent-browser close >/dev/null 2>&1 || true

log "PASS — MCP stdio create + browser verify + alteration suite"
echo "  PO verified in UI: ${NEW_PO}"
echo "  Screenshots: ${SS}/e2e-mcp-sto-create.png, ${SS}/e2e-intercompany-workspace.png"
