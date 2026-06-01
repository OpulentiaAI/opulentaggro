#!/usr/bin/env bash
# Load production env for cloud agent remote testing (Railway + Vercel).
# Usage: source "$(dirname "$0")/load_cloud_agent_env.sh"
#   OR:  ROOT=... source scripts/load_cloud_agent_env.sh
set -euo pipefail

if [[ -z "${ROOT:-}" ]]; then
  _LOAD_SCRIPT="${BASH_SOURCE[0]}"
  if [[ "$_LOAD_SCRIPT" == */* ]]; then
    ROOT="$(cd "$(dirname "$_LOAD_SCRIPT")/.." && pwd)"
  else
    ROOT="$(cd "$(pwd)" && pwd)"
  fi
fi

REMOTE_ENV="${ROOT}/config/cloud-agent-remote.env"
DEMO_CREDS="${ROOT}/config/demo-credentials.env"

_apply_remote_defaults() {
  export ERPNEXT_URL="${ERPNEXT_URL:-https://erpnext-production-512a.up.railway.app}"
  export FRAPPE_SITE_URL="${FRAPPE_SITE_URL:-$ERPNEXT_URL}"
  export VERCEL_URL="${VERCEL_URL:-https://vercel-indol-phi-69.vercel.app}"
  export VERCEL_MCP_URL="${VERCEL_MCP_URL:-${VERCEL_URL%/}/api/mcp}"
  export NEXT_PUBLIC_ERPNEXT_URL="${NEXT_PUBLIC_ERPNEXT_URL:-$ERPNEXT_URL}"
  export NEXT_PUBLIC_APP_NAME="${NEXT_PUBLIC_APP_NAME:-OpulentAggro}"
  export FRAPPE_SITE_NAME="${FRAPPE_SITE_NAME:-erpnext-production-512a.up.railway.app}"
  export FRAPPE_DESK_PROXY="${FRAPPE_DESK_PROXY:-1}"
  export ERPNEXT_AUTH_MODE="${ERPNEXT_AUTH_MODE:-service_session}"
  export ERPNEXT_SERVICE_USER="${ERPNEXT_SERVICE_USER:-${DEMO_ADMIN_USER:-Administrator}}"
  export ERPNEXT_SERVICE_PASSWORD="${ERPNEXT_SERVICE_PASSWORD:-${DEMO_ADMIN_PASSWORD:-}}"
  export ERPNEXT_DEV_USER="${ERPNEXT_DEV_USER:-${ERPNEXT_SERVICE_USER}}"
  export ERPNEXT_DEV_PASSWORD="${ERPNEXT_DEV_PASSWORD:-${ERPNEXT_SERVICE_PASSWORD}}"
  export STO_TEST_COMPANY="${STO_TEST_COMPANY:-Opulent Fresh NA}"
  export STO_TEST_SUPPLIER="${STO_TEST_SUPPLIER:-Internal Supplier Opulent Fresh APAC}"
  export STO_TEST_ITEM="${STO_TEST_ITEM:-STO-TEST-ITEM-001}"
  export STO_TEST_WAREHOUSE="${STO_TEST_WAREHOUSE:-Stores - OFAP}"
  export IC_TEST_FROM_COMPANY="${IC_TEST_FROM_COMPANY:-Opulent Fresh APAC}"
  export IC_TEST_TO_COMPANY="${IC_TEST_TO_COMPANY:-Opulent Fresh NA}"
  export REPORT="${REPORT:-docs/hosted-mcp-results.json}"
  unset ERPNEXT_NO_AUTH 2>/dev/null || true
}

if [[ -f "$REMOTE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$REMOTE_ENV"
  set +a
  _apply_remote_defaults
elif [[ -f "$DEMO_CREDS" ]]; then
  echo "load_cloud_agent_env: using demo-credentials + remote URL overrides (set config/cloud-agent-remote.env for production API keys)" >&2
  set -a
  # shellcheck disable=SC1090
  source "$DEMO_CREDS"
  set +a
  _apply_remote_defaults
else
  echo "Missing config/cloud-agent-remote.env and config/demo-credentials.env" >&2
  echo "  cp config/cloud-agent-remote.env.example config/cloud-agent-remote.env" >&2
  echo "  OR cp config/demo-credentials.env.example config/demo-credentials.env" >&2
  exit 1
fi

if [[ -z "${ERPNEXT_API_KEY:-}" || -z "${ERPNEXT_API_SECRET:-}" ]]; then
  echo "load_cloud_agent_env: ERPNEXT_API_KEY/SECRET unset — Railway REST/MCP direct tests will skip auth" >&2
fi
