#!/usr/bin/env bash
# Load local demo credentials (required) and optional root .env overrides.
# Usage: source "$(dirname "$0")/load_env.sh"   OR   ROOT=... source scripts/load_env.sh
set -euo pipefail

if [[ -z "${ROOT:-}" ]]; then
  _LOAD_ENV_SCRIPT="${BASH_SOURCE[0]}"
  if [[ "$_LOAD_ENV_SCRIPT" == */* ]]; then
    ROOT="$(cd "$(dirname "$_LOAD_ENV_SCRIPT")/.." && pwd)"
  else
    ROOT="$(cd "$(pwd)" && pwd)"
  fi
fi

CREDS="${ROOT}/config/demo-credentials.env"
if [[ ! -f "$CREDS" ]]; then
  echo "Missing config/demo-credentials.env — copy from config/demo-credentials.env.example" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$CREDS"
if [[ -f "${ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
fi
set +a
