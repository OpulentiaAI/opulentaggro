# Agent instructions — OpulentAggro Intercompany STO

## Repo layout

| Path | Purpose |
|------|---------|
| `erpnext/` | OpulentAggro ERPNext fork (STO module, desk pages, Pierre theme) |
| `erpnext-mcp-server/` | MCP server with `sto_*`, `ic_*` billing, and `ic_*` extended tools (41 total) |
| `docs/` | Setup and test documentation |
| `vercel/` | Vercel Next.js frontend + MCP/STO/IC API gateway |

## Agent skills (SSOT)

Project skills live in `.cursor/skills/`. Read the relevant skill **before** navigating the desk, calling STO APIs, or using MCP tools.

| Skill | When to load |
|-------|--------------|
| [opulentaggro-sto-mcp](.cursor/skills/opulentaggro-sto-mcp/SKILL.md) | **Primary MCP** — 41 tools with JSON schemas, UI verify routes, stdio + Vercel SSE `/api/mcp`, workflows, troubleshooting |
| [opulentaggro-mcp-ui-e2e](.cursor/skills/opulentaggro-mcp-ui-e2e/SKILL.md) | **MCP + UI E2E** — `test_all_41_mcp_tools.py`, screenshot matrix, alignment gate, local/hosted env |
| [opulentaggro-sto-navigation](.cursor/skills/opulentaggro-sto-navigation/SKILL.md) | Desk UI routes, STO workflow stages, Frappe REST, UI vs API vs MCP, prerequisites, hosted prod URLs + prod pitfalls |
| [opulentaggro-vercel](.cursor/skills/opulentaggro-vercel/SKILL.md) | Vercel Next.js frontend, `/api/sto` / `/api/ic` / `/api/mcp` / `/api/health` proxies, deploy, prod URLs, MCP proxy SSE |
| [mcp-db-alignment](.cursor/skills/mcp-db-alignment/SKILL.md) | Keep MCP tools, ERPNext APIs, seed data, and tests in sync; tool registry, Railway hosted seed data + re-seed scripts |
| [erpnext-sto-mcp](.cursor/skills/erpnext-sto-mcp/SKILL.md) | Alias → opulentaggro-sto-mcp (backward compatibility) |
| [mcp-e2e-testing](.cursor/skills/mcp-e2e-testing/SKILL.md) | Alias → opulentaggro-mcp-ui-e2e (backward compatibility) |

Trigger terms: OpulentAggro, intercompany, STO, stock transfer order, sto-dashboard, sto-trace, erpnext-mcp-server, Vercel deploy, MCP E2E test, endpoint validation, browser verify MCP, hosted MCP, Railway ERPNext, Vercel MCP proxy.

## Hosted stack (production — 2026-06-01)

| Interface | URL | Auth |
|-----------|-----|------|
| Vercel desk | https://vercel-indol-phi-69.vercel.app | Session login (Administrator / `OpulentAggro-Demo-2026!`) |
| Vercel MCP proxy | https://vercel-indol-phi-69.vercel.app/api/mcp | Streamable HTTP, Accept SSE |
| Railway ERPNext | https://erpnext-production-512a.up.railway.app | API token OR session |
| API key/secret | `5b218748d06d007:b9a99536f8deac3` | from `railway logs --service erpnext --lines 200 \| grep api_key` |

**Latest hosted validation (2026-06-01):** 15/15 direct + 17/17 live + alignment PASS. MCP action (sto_create qty=88) confirmed visible in Vercel UI. See [docs/hosted-mcp-validation-report.md](docs/hosted-mcp-validation-report.md) and [docs/hosted-mcp-results.json](docs/hosted-mcp-results.json).

**Critical hosted prerequisites (set on Railway after fresh deploy):**
1. `System Settings.currency = USD` (intercompany validation requires matching currencies)
2. `System Settings.setup_complete = 1` (prevents Frappe setup wizard from blocking embeds)
3. `Fiscal Year 2026` for all companies (no active FY → FiscalYearError)
4. Internal customer `companies` child table includes all counterparty companies
5. Material Receipt stock entries in source warehouse (otherwise NegativeStockError)

## Conventions

- Do not commit secrets (`.env`, API keys). Use `*.env.example` as templates.
- **Local demo credentials:** `config/demo-credentials.env` (gitignored). Copy from `config/demo-credentials.env.example`. Scripts load via `scripts/load_env.sh`.
- **Cloud agent remote (hosted):** `config/cloud-agent-remote.env` (gitignored). Copy from `config/cloud-agent-remote.env.example`. Load via `source scripts/load_cloud_agent_env.sh` before `scripts/cloud_agent_validate.sh`. See [docs/cloud-agent-mcp-browser-runbook.md](docs/cloud-agent-mcp-browser-runbook.md).
- **Hosted API keys:** Get from `railway logs --service erpnext --lines 200 | grep api_key`. Sync to Vercel: `vercel env add ERPNEXT_API_KEY production` and `vercel env add ERPNEXT_API_SECRET production`.
- DoA approval is human-governed — never auto-submit STOs without explicit approval.
- Prefer `sto_*` MCP tools over generic `call_method` for intercompany workflow steps.
- Prefer `ic_*` MCP tools for standalone intercompany AR/AP invoicing across company pairs.
- Workspace path may contain **two spaces** after `FW_`: `/Users/jeremyalston/Perfect/FW_  Intercompany Files/`

## Docs

- [docs/opulentaggro-flow-coverage.mdx](docs/opulentaggro-flow-coverage.mdx) — AgroFresh IC flows → MCP tools → Vercel UI → Railway API; coverage % and gaps
- [docs/erpnext-sto-mcp-setup.md](docs/erpnext-sto-mcp-setup.md) — branding, desk pages, MCP config
- [docs/vercel-deployment-plan.md](docs/vercel-deployment-plan.md) — Vercel Next.js architecture and deploy
