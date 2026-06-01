# MCP E2E test scripts

All scripts load credentials via `scripts/load_env.sh` → `config/demo-credentials.env`. Use `ERPNEXT_NO_AUTH=1` for localhost dev (never production).

## Orchestrators

### `scripts/test_mcp_endpoints_with_screenshots.sh`

**Full acceptance test** — layer 3 + 4.

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_endpoints_with_screenshots.sh'
```

1. Pings ERPNext; starts stack via `start_all.sh` if down
2. Symlinks Playwright 1200→1208 if needed
3. Runs `mcp_stdio_runner.py` → `docs/mcp-stdio-results.json`
4. Logs into desk with agent-browser
5. Captures 12 screenshots under `docs/screenshots/mcp-validation/`
6. Writes `docs/mcp-endpoint-validation-report.md`
7. Exit code = MCP stdio fail count

### `scripts/test_mcp_browser_e2e.sh`

**Single-tool + alteration loop** — `sto_create` → dashboard verify → alterations → intercompany workspace.

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_browser_e2e.sh'
```

Outputs: `docs/screenshots/e2e-mcp-sto-create.png`, `e2e-intercompany-workspace.png`.

## MCP stdio

### `scripts/mcp_stdio_runner.py`

JSON-RPC client for all **15** STO + IC tools via `scripts/run_mcp_server.sh`.

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 python3 scripts/mcp_stdio_runner.py'
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 python3 scripts/mcp_stdio_runner.py --report /tmp/mcp-stdio.json'
```

Runs full chain: `ic_list_accounts` → `sto_list` → `sto_create` → STO workflow → IC standalone tools. Writes JSON with `po_name`, `si_name`, `pi_name`, `results[]`.

Env overrides: `STO_TEST_COMPANY`, `STO_TEST_SUPPLIER`, `STO_TEST_ITEM`, `IC_TEST_FROM_COMPANY`, `IC_TEST_TO_COMPANY`.

### `scripts/run_mcp_server.sh`

Launches `erpnext-mcp-server/build/index.js` with demo env. Node fallback: NVM v20.19.0 if Homebrew simdjson broken. Set `MCP_NODE` to override.

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/run_mcp_server.sh'
```

## Live API tests

### `scripts/test_all_mcp_endpoints.py`

Layer 1 (mock) + layer 2 (live API). **17 test rows**: 2 mock suites + 15 live endpoint calls.

```bash
python3 scripts/test_all_mcp_endpoints.py --mock-only
ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py
ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py --live-only
ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py --report /tmp/mcp-report.json
```

Live path calls whitelisted methods directly (not stdio). Same document chain as `mcp_stdio_runner.py`.

### `scripts/test_mcp_alterations.py`

API mutation + verification steps (create → list/REST docstatus → trace → IC pair). No MCP transport.

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 python3 scripts/test_mcp_alterations.py'
```

Steps: `ic_list_accounts`, `sto_create → sto_list/REST`, `sto_submit → REST docstatus`, `sto_approve_and_route → sto_get_trace`, `ic_create_invoice_pair → ic_get_invoice_status/REST`.

## Alignment & infra

### `scripts/verify_mcp_alignment.sh`

Pre-E2E gate: `npm run build`, mock `.mjs` tests, registry vs `sto-tools.ts` / `ic-billing-tools.ts`.

```bash
./scripts/verify_mcp_alignment.sh
```

### `scripts/start_all.sh`

Start bench (port 8000). Called automatically by screenshot orchestrator if ping fails.

### `scripts/run_seed.sh`

Seed MCP alignment data + install desk pages (`sto-dashboard`, `sto-trace`, intercompany workspace).

### `scripts/set_demo_admin_password.sh`

Sync Administrator password from demo-credentials to site. Run after credential changes.

### `scripts/load_env.sh`

Sources `config/demo-credentials.env` + optional root `.env`. **Must be sourced under bash** (not bare zsh).

## Mock tests (layer 1)

```bash
cd erpnext-mcp-server
npm run build
npm test                    # or: node tests/sto-tools.test.mjs && node tests/ic-billing-tools.test.mjs
```

## Layer 5 — Vercel HTTP MCP (optional)

When `vercel/` gateway is deployed, point MCP Inspector or HTTP client at `/api/mcp` with Bearer token and **API key auth** to remote ERPNext (no `ERPNEXT_NO_AUTH`). See `docs/vercel-deployment-plan.md`.

## Output artifacts

| Path | Producer |
|------|----------|
| `docs/mcp-stdio-results.json` | `mcp_stdio_runner.py` |
| `docs/mcp-endpoint-validation-report.md` | `test_mcp_endpoints_with_screenshots.sh` |
| `docs/screenshots/mcp-validation/*.png` | `test_mcp_endpoints_with_screenshots.sh` |
| `docs/screenshots/e2e-*.png` | `test_mcp_browser_e2e.sh` |
