# 1:1 Port Validation Report — OpulentAggro Vercel vs ERPNext Desk

**Date:** 2026-06-01 (updated)
**ERPNext (original):** http://localhost:8000 / https://erpnext-production-512a.up.railway.app
**Vercel port (local):** http://localhost:3000 (`ERPNEXT_URL=http://localhost:8000`, `ERPNEXT_NO_AUTH=1`)
**Vercel production:** https://vercel-indol-phi-69.vercel.app
**Comparison captures:** `docs/screenshots/1to1-comparison/`, `docs/screenshots/mcp-validation/`

## Approach

**Frappe embed-first:** All desk routes (`/app/sto-dashboard`, `/app/sto-trace`, `/app/intercompany`, doctype lists/forms) default to same-origin `/erpnext/*` proxy + full-bleed iframe when `FRAPPE_DESK_PROXY=1`. React ports (`StoDashboardView`, `TraceView`, workspace tiles) remain as **fallback only** when proxy is disabled (local `ERPNEXT_NO_AUTH=0`).

## Parity scores (2026-06-01)

| Scope | Estimate | Notes |
|-------|----------|-------|
| **STO Dashboard** (embed) | **~100%** | iframe → `/erpnext/app/sto-dashboard` |
| **STO Trace** (embed) | **~100%** | iframe → `/erpnext/app/sto-trace` |
| **Frappe lists/forms** | **~100%** | iframe when proxy + backend up |
| **Intercompany workspace** | **~100%** | iframe → `/erpnext/app/intercompany` |
| **IC Billing** | **~90%** | React page + optional form embed |
| **Overall** | **Blocked on Railway** | Backend returning 500 during site recreate |

## Production diagnosis (2026-06-01)

| URL | Before fix | After fix |
|-----|------------|-----------|
| `/app/sto-dashboard` | Ported React `StoDashboardView` (simplified tables) | Full-bleed iframe → `/erpnext/app/sto-dashboard` |
| `/app/purchase-order` | iframe embed (correct) | unchanged |
| `/erpnext/app/sto-dashboard` | 500 (Railway backend down) | 500 (upstream; proxy working) |
| `/api/health` | `reachable: false` | `reachable: false` — Railway 500 on STO API |

**Root cause:** (1) STO dashboard/trace/intercompany used ported React instead of Frappe embed; (2) desk proxy used API token auth for HTML pages (no `sid` session); (3) Railway ERPNext redeploying/recreating site (all endpoints 500).

## Changes this run (2026-06-01)

1. **`FrappeDeskPageEmbed`** — reusable embed wrapper with React fallback
2. **`sto-dashboard`, `sto-trace`, `intercompany`** — default to Frappe iframe embed
3. **`service-session.ts`** — server-side `sid` login via `ERPNEXT_SERVICE_USER`/`PASSWORD` for desk proxy without user login
4. **`frappe-desk-proxy.ts`** — forward `set-cookie`, rewrite `login`/`desk` paths, strip absolute Railway URLs
5. **Vercel env** — `FRAPPE_DESK_PROXY=1`, `ERPNEXT_SERVICE_USER=Administrator`, `ERPNEXT_SERVICE_PASSWORD` set
6. Deploy: `vercel deploy --prod` → https://vercel-indol-phi-69.vercel.app

## Production deploy

Deployed: https://vercel-indol-phi-69.vercel.app

Frappe desk proxy: `/erpnext/*` route handler forwards `erpnext_sid` (from `/login`) or service session to Railway. Required env:

| Variable | Purpose |
|----------|---------|
| `ERPNEXT_URL` | Railway backend URL |
| `ERPNEXT_API_KEY` / `SECRET` | API/MCP token auth |
| `FRAPPE_DESK_PROXY=1` | Enable iframe + proxy |
| `ERPNEXT_SERVICE_USER` / `PASSWORD` | Server sid for desk HTML without user login |
| `ERPNEXT_REQUIRE_LOGIN=true` | Optional — force `/login` before `/app` |

## Remaining gaps

1. **Railway backend down** — ping/STO APIs return 500; iframe shows Internal Server Error until site boot completes (~5 min after redeploy)
2. Re-sync `ERPNEXT_API_KEY`/`SECRET` after Railway site recreate
3. IC Billing page still React-native (forms can embed individually)
4. Full-page redirect (`/app/*` → `/erpnext/app/*`) not implemented — iframe keeps `/app/*` URLs
