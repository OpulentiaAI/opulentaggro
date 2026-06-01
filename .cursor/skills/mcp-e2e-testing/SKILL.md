---
name: mcp-e2e-testing
description: End-to-end testing of erpnext-mcp-server MCP tools against live OpulentAggro ERPNext — mock tests, live API, stdio JSON-RPC, agent-browser desk verification, screenshots, and validation reports. Use when running MCP E2E tests, live application tests, browser verify MCP, sto_create browser checks, endpoint validation, or validating MCP tools against the desk UI.
---

# MCP E2E Testing (OpulentAggro)

Validate that MCP tools create real ERPNext documents and that results appear in the desk UI. **Never commit** `config/demo-credentials.env` or paste secrets into skills, reports, or screenshots metadata.

## When to load

- User asks to validate MCP endpoints, run E2E tests, or verify MCP → desk parity
- After adding/changing `sto_*` or `ic_*` tools (also load [mcp-db-alignment](../mcp-db-alignment/SKILL.md))
- Before merge when MCP behavior or browser pages changed
- Trigger terms: **MCP E2E test**, **live application test**, **browser verify MCP**, **sto_create browser**, **endpoint validation**

## Prerequisites

Run from workspace root (path may have **two spaces** after `FW_`).

```bash
cp config/demo-credentials.env.example config/demo-credentials.env   # one-time
./scripts/start_all.sh          # bench at http://localhost:8000
./scripts/run_seed.sh           # seed_mcp_alignment + desk pages
cd erpnext-mcp-server && npm run build
```

| Requirement | Check |
|-------------|-------|
| `config/demo-credentials.env` | Must exist; scripts fail without it |
| ERPNext ping | `curl -sf http://localhost:8000/api/method/ping` |
| Node for MCP | `scripts/run_mcp_server.sh` (NVM fallback if Homebrew simdjson broken) |
| agent-browser | `command -v agent-browser` + Playwright Chromium |
| Local auth | `ERPNEXT_NO_AUTH=1` — localhost only; uses `ERPNEXT_DEV_USER` / password from demo-credentials |

Desk login: **Administrator** (or `DEMO_ADMIN_USER`) / password from demo-credentials. After password change: `./scripts/set_demo_admin_password.sh`.

## Hosted validation (Railway + Vercel)

For deployed stack validation, set these env vars before running tests:

```bash
export ERPNEXT_URL=https://erpnext-production-512a.up.railway.app
export VERCEL_URL=https://vercel-indol-phi-69.vercel.app
export ERPNEXT_API_KEY=5b218748d06d007
export ERPNEXT_API_SECRET=b9a99536f8deac3
export STO_TEST_COMPANY='Opulent Fresh NA'
export STO_TEST_SUPPLIER='Internal Supplier Opulent Fresh APAC'
export STO_TEST_ITEM='STO-TEST-ITEM-001'
export IC_TEST_FROM_COMPANY='Opulent Fresh APAC'
export IC_TEST_TO_COMPANY='Opulent Fresh NA'

# Full 15-tool E2E against live backend (writes report to docs/)
python3 scripts/test_hosted_mcp_e2e.py --report docs/hosted-mcp-results.json
python3 scripts/test_all_mcp_endpoints.py
./scripts/verify_mcp_alignment.sh

# Browser-verify Vercel UI (MCP action visible)
agent-browser open $VERCEL_URL/login
agent-browser fill <username_ref> "Administrator"
agent-browser fill <password_ref> "OpulentAggro-Demo-2026!"
agent-browser click <signin_ref>
agent-browser open $VERCEL_URL/app/sto-dashboard
agent-browser wait 3000
agent-browser screenshot "docs/screenshots/hosted-mcp-validation/01-sto-dashboard-pre-mcp.png"
```

**Latest hosted result (2026-06-01 rerun, 100% pass):**

| Suite | Result |
|-------|--------|
| `test_hosted_mcp_e2e.py` (direct REST) | **15/15 PASS** |
| `test_all_mcp_endpoints.py` (live + mock) | **17/17 PASS** |
| `verify_mcp_alignment.sh` | **PASS** |
| Vercel MCP proxy (initialize + 5 read + 1 write) | **6/6 PASS** |
| **MCP action visible in UI** | **YES** — `PUR-ORD-2026-00023` Draft $4,400.00 via `/api/mcp` `sto_create` qty=88 |

See `docs/hosted-mcp-validation-report.md` and `docs/hosted-mcp-results.json` for full details.

Vercel MCP proxy requires `Accept: application/json, text/event-stream` header (SSE). Manual verify: `initialize` → `notifications/initialized` (empty body OK) → `tools/call`. Responses are SSE `event: message\ndata: {...}`.

Hosted screenshots: `docs/screenshots/hosted-mcp-validation/`
- `01-sto-dashboard-baseline.png` — before MCP action
- `05-ic-billing.png` — Sales Invoice embed
- `06-purchase-order-embed.png` — PO list, no "Page erpnext not found"
- `08-mcp-action-in-ui.png` — PUR-ORD-2026-00023 Draft $4,400.00 visible
- `09-sto-dashboard-pre-mcp.png` — STO dashboard baseline
- `10-sto-trace.png` — STO trace page

## Test pyramid (run bottom-up)

| Layer | What | Command | Proves |
|-------|------|---------|--------|
| **1 — Mock** | MCP handlers without ERPNext | `cd erpnext-mcp-server && npm test` | Tool wiring, arg validation |
| **2 — Live API** | Whitelisted methods (same as MCP) | `ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py` | 15 endpoints + 2 mock suites (17 rows) |
| **3 — MCP stdio** | Real JSON-RPC via `run_mcp_server.sh` | `ERPNEXT_NO_AUTH=1 python3 scripts/mcp_stdio_runner.py` | Transport + auth + tool chain |
| **4 — Browser E2E** | stdio + agent-browser + screenshots | `bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_endpoints_with_screenshots.sh'` | Desk visibility |
| **5 — Vercel HTTP MCP** | Deployed gateway (optional) | `vercel/` `/api/mcp` against remote ERPNext with API keys | Production-like HTTP transport |

Layer 2 hits API directly; layer 3 proves stdio MCP path. Layer 4 is the full acceptance test.

## Workflows

### Full 15-endpoint validation + screenshots

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_endpoints_with_screenshots.sh'
```

Orchestrator: MCP stdio (`mcp_stdio_runner.py`) → browser login → 12 PNGs → `docs/mcp-endpoint-validation-report.md`.

Outputs:
- `docs/mcp-stdio-results.json` — per-tool PASS/FAIL + created PO/SI/PI names
- `docs/screenshots/mcp-validation/*.png`
- `docs/mcp-endpoint-validation-report.md`

### Single tool + browser verify (`sto_create` pattern)

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_browser_e2e.sh'
```

Creates one PO via MCP stdio, waits for it on `/app/sto-dashboard`, screenshots `docs/screenshots/e2e-mcp-sto-create.png`, then runs alteration suite.

Manual variant after a single MCP call:

1. Note `purchase_order` from tool response
2. Login → `/app/sto-dashboard` → `agent-browser wait --text "PUR-ORD-..."` 
3. Screenshot → `docs/screenshots/mcp-validation/02-sto-create.png`

### Alteration test suite (API mutate + verify)

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 python3 scripts/test_mcp_alterations.py'
```

Creates docs via whitelisted methods, verifies via follow-up API/REST (list count, docstatus, trace chain). No browser required.

### Alignment gate (before E2E)

```bash
./scripts/verify_mcp_alignment.sh
```

Build + mock tests + registry parity. Run first when tools change.

## Verification checklist

For each of the **15 MCP tools** (9 `sto_*` + 6 `ic_*`):

```
- [ ] MCP call returns PASS (no isError)
- [ ] Response includes expected document name(s)
- [ ] Document exists via REST or follow-up tool
- [ ] Visible in desk (list/form or dashboard row)
- [ ] Screenshot captured (layer 4)
- [ ] Row in validation report
```

**Three-way proof:** MCP stdio result → ERPNext document name → browser shows same name.

### Screenshot naming

Directory: `docs/screenshots/mcp-validation/`

| File | Tools / page |
|------|----------------|
| `01-sto-list-baseline.png` | `sto_list` — `/app/sto-dashboard` |
| `02-sto-create.png` | `sto_create` — PO on dashboard |
| `03-sto-submit-approve.png` | `sto_submit`, `sto_approve_and_route` — PO form |
| `04-sto-git.png` | `sto_post_goods_in_transit` — delivery note |
| `05-sto-ic-invoice.png` | `sto_create_ic_invoice` — sales invoice list |
| `06-sto-receipt.png` | `sto_post_goods_receipt` — purchase receipt list |
| `07-sto-trace.png` | `sto_get_trace` — PO form (trace fallback) |
| `08-sto-three-way-match.png` | `sto_three_way_match` — PO form |
| `09-ic-list-accounts.png` | `ic_list_accounts` — `/app/intercompany` |
| `10-ic-invoice-pair.png` | `ic_create_sales_invoice`, `ic_create_purchase_invoice`, `ic_create_invoice_pair` |
| `11-ic-invoice-status.png` | `ic_submit_invoice`, `ic_get_invoice_status` |
| `summary-report.png` | Final dashboard with PO visible |

Ad-hoc E2E: `docs/screenshots/e2e-mcp-sto-create.png`, `e2e-intercompany-workspace.png`.

### Report generation

`test_mcp_endpoints_with_screenshots.sh` writes `docs/mcp-endpoint-validation-report.md` from `docs/mcp-stdio-results.json`. Template: timestamp, PO/SI/PI names, results table (endpoint | MCP | browser | screenshot), summary `15/15`, screenshot index.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `BASH_SOURCE` / `load_env.sh` fails in zsh | Wrap in `bash -lc 'source scripts/load_env.sh && ...'` |
| Login failures / dev session rejected | Sync site password: `./scripts/set_demo_admin_password.sh` |
| `agent-browser` / Playwright revision mismatch | Script symlinks `chromium_headless_shell-1200` → `-1208` under `~/Library/Caches/ms-playwright`; or `npx playwright install chromium` |
| `sto-trace` page blank in headless | Use linked form views (PO, DN, SI, PR lists) — see orchestrator script |
| Homebrew Node `libsimdjson.30.dylib` | `MCP_NODE=~/.nvm/versions/node/v20.19.0/bin/node` or NVM first on PATH |
| ERPNext unreachable | `./scripts/start_all.sh`; confirm `curl …/api/method/ping` |
| Live tests SKIP | Set `ERPNEXT_NO_AUTH=1` or API keys in demo-credentials |
| Missing seed data | `./scripts/run_seed.sh` |
| New tool not in E2E | Update `mcp_stdio_runner.py`, screenshot map, report generator, [endpoint-checklist](references/endpoint-checklist.md) |

## Related skills

| Skill | Role |
|-------|------|
| [erpnext-sto-mcp](../erpnext-sto-mcp/SKILL.md) | Tool args, MCP config, workflow order |
| [mcp-db-alignment](../mcp-db-alignment/SKILL.md) | Registry, seed, verify_mcp_alignment |
| [opulentaggro-sto-navigation](../opulentaggro-sto-navigation/SKILL.md) | Desk routes, stage names, UI pitfalls |

## Cloud agent runbook (hosted stack)

For cloud agents with computer/browser use validating Railway + Vercel in one pass:

- **[docs/cloud-agent-mcp-browser-runbook.md](../../docs/cloud-agent-mcp-browser-runbook.md)** — self-contained runbook (health → direct API → Vercel MCP SSE → browser → alignment)
- **`scripts/cloud_agent_validate.sh`** — wrapper: health checks + `test_hosted_mcp_e2e.py` + browser checklist

## Additional resources

- All test scripts: [references/test-scripts.md](references/test-scripts.md)
- 15-tool checklist + browser routes: [references/endpoint-checklist.md](references/endpoint-checklist.md)
- agent-browser commands: [references/browser-patterns.md](references/browser-patterns.md)
- Setup details: `docs/erpnext-sto-test-setup.md`
- Latest report: `docs/mcp-endpoint-validation-report.md`
