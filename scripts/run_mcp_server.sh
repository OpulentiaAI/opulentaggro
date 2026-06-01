#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load_env.sh"
if [[ -f "$ROOT/erpnext-mcp-server/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/erpnext-mcp-server/.env"
  set +a
fi
if [[ "${ERPNEXT_NO_AUTH:-0}" == "1" || "${MCP_NO_AUTH:-0}" == "1" ]]; then
  echo "[run_mcp_server] DEV ONLY: no-auth mode (localhost session login)" >&2
fi
NODE_BIN="${MCP_NODE:-${NODE_BIN:-}}"
if [[ -z "$NODE_BIN" ]]; then
  for candidate in     "${NVM_DIR:-$HOME/.nvm}/versions/node/v20.19.0/bin/node"     "${NVM_DIR:-$HOME/.nvm}/versions/node/v20.19.0/bin/node"     "$(command -v node 2>/dev/null || true)"; do
    if [[ -n "$candidate" && -x "$candidate" ]] && "$candidate" -e "process.exit(0)" 2>/dev/null; then
      NODE_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "[run_mcp_server] No working Node.js found (Homebrew node may need: brew reinstall node simdjson)" >&2
  exit 1
fi
exec "$NODE_BIN" "$ROOT/erpnext-mcp-server/build/index.js"
