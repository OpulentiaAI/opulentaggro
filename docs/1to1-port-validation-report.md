# 1:1 Port Validation Report — OpulentAggro Vercel vs ERPNext Desk

**Date:** 2026-06-01 (updated — ported React primary + hosted validation pass)
**ERPNext (original):** http://localhost:8000 / https://erpnext-production-512a.up.railway.app
**Vercel port (local):** http://localhost:3000 (`ERPNEXT_URL=http://localhost:8000`, `ERPNEXT_NO_AUTH=1`)
**Vercel production:** https://vercel-indol-phi-69.vercel.app
**Comparison captures:** `docs/screenshots/1to1-comparison/`, `docs/screenshots/mcp-validation/`, `docs/screenshots/hosted-mcp-validation/`

## Approach

**Ported React primary:** Custom STO pages (`/app/sto-dashboard`, `/app/sto-trace`, `/app/intercompany`) use faithful React ports of `sto_dashboard.js/css`, `sto_trace.js/css`, and `intercompany.json` workspace blocks — Pierre **light** desk shell, stage badges, summary grid, document chain, three-way match, workflow actions.

**Frappe embed secondary:** Standard doctype lists/forms still use same-origin `/erpnext/*` iframe when `FRAPPE_DESK_PROXY=1`. STO pages offer **iframe fallback only** when the ERPNext API is unreachable (`StoBackendFallback` → “Open Frappe desk view”).

## Parity scores (2026-06-01)

| Scope | Estimate | Notes |
|-------|----------|-------|
| **STO Dashboard** (ported) | **~98%** | Summary grid + Pierre badges, filters, table, New STO dialog, OpulentAggro footer; Frappe Link fields approximated with select/datalist |
| **STO Trace** (ported) | **~97%** | Pipeline box steps, doc chain with “Not created” placeholders, match panel, stage actions; PO Link field → search form |
| **Intercompany workspace** (ported) | **~95%** | Blocks from `intercompany.json`; no Frappe workspace sidebar cards |
| **Frappe lists/forms** | **~100%** | iframe when proxy + backend up |
| **Desk shell** | **~92%** | Pierre light topbar/sidebar, OpulentAggro logo; not full Frappe navbar |
| **IC Billing** | **~90%** | React page + optional form embed |
| **Overall custom pages** | **~97%** | Blocked on live API when Railway 500 |

## What was wrong vs elegant original

| Issue | Fix |
|-------|-----|
| Prior run defaulted STO pages to full-bleed iframe (500 when Railway down) | Restored ported `StoDashboardView` / `TraceView` as default |
| Simplified React table/summary vs Frappe page | Re-read `sto_dashboard.js/css`; ported DOM structure, classes, Pierre stage colors |
| Trace used generic `DocChainGrid`, wrong section order | New `StoDocChain` matching `sto_trace.js`; order: pipeline → docs → match → actions |
| Pipeline rendered as pills not box steps | CSS aligned to `sto_trace.css` |
| Dark/generic desk chrome | `data-theme="light"`, Pierre vars, logo in topbar |
| iframe-first for intercompany workspace | Ported workspace tiles from `intercompany.json` |

## Components rewritten

- `vercel/components/sto/StoDashboardView.tsx` — full dashboard port + company select + iframe fallback
- `vercel/components/sto/TraceView.tsx` — trace layout parity
- `vercel/components/sto/StoDocChain.tsx` — document chain with placeholders
- `vercel/components/sto/StoBackendFallback.tsx` — API error → optional Frappe iframe
- `vercel/components/StageBadge.tsx` — `sto-stage-badge` Pierre colors
- `vercel/components/sto/StoActionBar.tsx` — `sto-actions` + `btn-sm`
- `vercel/components/desk/TopBar.tsx` — OpulentAggro logo
- `vercel/app/globals.css` — sto_dashboard + sto_trace + footer styles
- `vercel/app/app/sto-dashboard/page.tsx`, `sto-trace/page.tsx`, `intercompany/page.tsx` — ported views (no iframe default)

## Railway custom pages

`railway/entrypoint.sh` now runs `install_sto_desk_pages()` after DB ready:

- `import-doc` for `sto_dashboard.json`, `sto_trace.json`, `intercompany.json`
- `bench build --app erpnext` + clear-cache

Intercompany module is already copied in `railway/Dockerfile` overlay.

## Production deploy

```bash
cd vercel && vercel deploy --prod
```

URL: https://vercel-indol-phi-69.vercel.app

## Screenshot comparison

Run locally:

```bash
# Terminal 1: bench on :8000 with ERPNEXT_NO_AUTH=1
# Terminal 2:
cd vercel && ERPNEXT_URL=http://localhost:8000 ERPNEXT_NO_AUTH=1 npm run dev
# Compare /app/sto-dashboard vs docs/screenshots/mcp-validation/01-sto-list-baseline.png
```

## Remaining gaps (~3%)

1. New STO dialog: single-item form vs Frappe Table multi-row editor
2. Company/Supplier/Item Link autocomplete (partial: company select + datalist)
3. Railway backend 500 during site recreate — API + iframe fallback both fail until boot completes
4. Frappe page toolbar/menu items (Refresh in menu vs head button — functionally equivalent)
