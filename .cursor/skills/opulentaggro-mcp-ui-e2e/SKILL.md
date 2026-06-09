---
name: opulentaggro-mcp-ui-e2e
description: End-to-end MCP + Vercel UI validation for OpulentAggro — 41-tool harness (33 exercised + 8 generic registry), local stack startup, screenshot matrix (11 flows), alignment gate, bench sync, hosted vs local env. Use when running MCP E2E tests, browser verify MCP, test_all_41_mcp_tools, local UI screenshots, endpoint validation, or proving MCP call → API response → visible UI effect. Trigger terms: MCP E2E, browser verify MCP, test_all_41, local-mcp-ui-validation, 33/33 PASS.
---

# OpulentAggro MCP + UI E2E Testing

Prove **MCP call → ERPNext document → Vercel UI visibility** per [Letta converting-mcps-to-skills](https://github.com/letta-ai/letta-code/tree/main/src/skills/builtin/converting-mcps-to-skills) pattern.

**Never commit** `config/demo-credentials.env` or secrets.

## When to load

- Validate MCP after tool/API changes
- Run full 41-tool or UI screenshot suite
- Hosted cloud-agent validation
- Trigger terms: **MCP E2E test**, **browser verify MCP**, **test_all_41**, **local-mcp-ui-validation**, **33/33 PASS**

## Quick start (local one-liner)

```bash
bash -lc 'source scripts/load_env.sh && ./scripts/start_all.sh && cd erpnext-mcp-server && npm run build && cd .. && ./scripts/verify_mcp_alignment.sh && ERPNEXT_NO_AUTH=1 python3 scripts/test_all_41_mcp_tools.py --report docs/local-mcp-41-results.json && ./scripts/test_local_mcp_ui_screenshots.sh'
```

Requires: `config/demo-credentials.env`, `agent-browser`, ERPNext :8000, Vercel :3000.

## Test pyramid

| Layer | Command | Proves |
|-------|---------|--------|
| 1 Mock | `cd erpnext-mcp-server && npm test` | Handler wiring |
| 2 Alignment | `./scripts/verify_mcp_alignment.sh` | 41-tool registry parity |
| 3 Live 41-tool | `python3 scripts/test_all_41_mcp_tools.py` | 33 exercised × direct + Vercel MCP |
| 4 UI screenshots | `./scripts/test_local_mcp_ui_screenshots.sh` | 11 Vercel pages |
| 5 Hosted | `source scripts/load_cloud_agent_env.sh && python3 scripts/test_all_41_mcp_tools.py` | Railway + prod Vercel |

Details: [test-harness.md](references/test-harness.md). Screenshot map: [screenshot-matrix.md](references/screenshot-matrix.md).

## MCP → API → UI proof pattern

For each workflow tool:

1. **MCP call** — stdio or `POST /api/mcp` `tools/call`
2. **Parse response** — `purchase_order`, `ACC-SINV-*`, `ACC-PINV-*`, `stage`
3. **REST confirm** — optional `get_document` or trace tool
4. **UI verify** — Vercel route; `agent-browser wait --text "{name}"`
5. **Screenshot** — `docs/screenshots/local-mcp-ui-validation/*.png`

### Harness markers

| Marker | Script | Visible effect |
|--------|--------|----------------|
| `qty: 101` | `test_all_41_mcp_tools.py` | PO on sto-dashboard |
| `qty: 102` | `test_local_mcp_ui_screenshots.sh` | `01-sto-create.png` |
| `qty: 88` | hosted historical | Draft $4,400 PO |

## Local stack startup

```bash
cp config/demo-credentials.env.example config/demo-credentials.env
./scripts/start_all.sh          # ERPNext :8000
cd vercel && npm run dev &      # Vercel :3000, MCP :3000/api/mcp
./scripts/run_seed.sh
cd erpnext-mcp-server && npm run build
```

| Check | Command |
|-------|---------|
| ERPNext | `curl -sf http://localhost:8000/api/method/ping` |
| Vercel health | `curl -sf http://localhost:3000/api/health` |
| MCP SSE | `Accept: application/json, text/event-stream` on `/api/mcp` |

## Environment loading

| Target | Load | Vars |
|--------|------|------|
| Local | `source scripts/load_env.sh` | `ERPNEXT_URL`, `ERPNEXT_NO_AUTH`, demo password |
| Hosted | `source scripts/load_cloud_agent_env.sh` | Railway URL, API keys, `VERCEL_URL`, `VERCEL_MCP_URL` |

See [env-loading.md](references/env-loading.md).

## 41-tool harness (`test_all_41_mcp_tools.py`)

- **33 exercised:** 16 `sto_*`, 14 `ic_*`, 3 generic spot-checks (`get_document`, `get_documents`, `call_method`)
- **8 generic** not in harness: registry-only; covered by mock tests + alignment gate

```bash
# Local both transports
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 python3 scripts/test_all_41_mcp_tools.py --report docs/local-mcp-41-results.json'

# Hosted
bash -lc 'source scripts/load_cloud_agent_env.sh && python3 scripts/test_all_41_mcp_tools.py --report docs/hosted-mcp-41-results.json'
```

**Latest local (2026-06-09):** 33/33 direct + 33/33 Vercel MCP. Artifacts: `PUR-ORD-2026-00070`, `ACC-SINV-2026-00061`, `ACC-PINV-2026-00060`.

## Prereqs before E2E

```bash
./scripts/verify_mcp_alignment.sh
python3 scripts/ensure_hosted_prereqs.py   # multi-warehouse stock
```

Bench overlay: `accounts/utils.py` on Railway — see [docs/railway-backend-deployment.md](../../docs/railway-backend-deployment.md).

## UI screenshot matrix (11 flows)

```bash
./scripts/test_local_mcp_ui_screenshots.sh
```

Output: `docs/screenshots/local-mcp-ui-validation/`. Full mapping: [screenshot-matrix.md](references/screenshot-matrix.md).

## Troubleshooting (7 fixes)

| Tool | Fix |
|------|-----|
| `sto_submit` | Idempotent — accept docstatus=1 |
| GIT/GR/BOL | Stock prereq `ensure_hosted_prereqs` |
| `ic_match_and_clear` | Submit linked SI+PI pair first |
| `ic_triangular_sale` | Sender warehouse default |
| `ic_create_accrual` | Party on JE lines |
| `get_document` | Valid Customer name |
| Vercel MCP URL | `VERCEL_MCP_URL=http://localhost:3000/api/mcp` |

Full table: [opulentaggro-sto-mcp/references/troubleshooting.md](../opulentaggro-sto-mcp/references/troubleshooting.md).

## Related skills

| Skill | Role |
|-------|------|
| [opulentaggro-sto-mcp](../opulentaggro-sto-mcp/SKILL.md) | Tool schemas, MCP config, workflows |
| [opulentaggro-sto-navigation](../opulentaggro-sto-navigation/SKILL.md) | Desk routes |
| [opulentaggro-vercel](../opulentaggro-vercel/SKILL.md) | Vercel deploy, `/api/mcp` |
| [mcp-db-alignment](../mcp-db-alignment/SKILL.md) | Registry SSOT |

## Docs

- [docs/local-mcp-ui-validation-report.md](../../docs/local-mcp-ui-validation-report.md)
- [docs/cloud-agent-mcp-browser-runbook.md](../../docs/cloud-agent-mcp-browser-runbook.md)
- [docs/opulentaggro-flow-coverage.mdx](../../docs/opulentaggro-flow-coverage.mdx) — flow diagrams
