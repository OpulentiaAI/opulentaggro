#!/usr/bin/env bash
# Deploy OpulentAggro ERPNext backend to Railway.
# Prerequisites: railway CLI authenticated (`railway login`), project linked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[deploy-railway] $*"; }

if ! command -v railway >/dev/null 2>&1; then
  log "Install Railway CLI: https://docs.railway.com/guides/cli"
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  log "Not authenticated. Run: railway login"
  exit 1
fi

log "Ensure MySQL plugin exists (free tier: Redis is bundled in erpnext image)"
log "  railway add --database mysql"
log "  railway link  # project opulentaggro-erpnext"
log "  Root railway.toml / railway.json must set builder=DOCKERFILE"

if [[ ! -f railway/.env ]] && [[ -f railway/.env.example ]]; then
  log "Copy railway/.env.example → railway/.env and set FRAPPE_ADMIN_PASSWORD"
fi

log "Deploying from repository root (Dockerfile: railway/Dockerfile)"
railway up --detach --service erpnext 2>/dev/null || railway up --detach

log "After deploy:"
log "  1. Set public domain: Railway → erpnext service → Settings → Networking → Generate Domain"
log "  2. Set SITE_HOST and FRAPPE_SITE_NAME to the Railway domain"
log "  3. Generate API keys:"
log "     railway run bench --site \$FRAPPE_SITE_NAME execute frappe.core.doctype.user.user.generate_keys --args '[\"Administrator\"]'"
log "  4. Copy ERPNEXT_URL + keys to Vercel env vars"
