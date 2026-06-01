# Agent instructions — OpulentAggro Intercompany STO

## Repo layout

| Path | Purpose |
|------|---------|
| `erpnext/` | OpulentAggro ERPNext fork (STO module, desk pages, Pierre theme) |
| `erpnext-mcp-server/` | MCP server with `sto_*` and `ic_*` tools |
| `docs/` | Setup and test documentation |
| `vercel/` | Vercel Next.js frontend + MCP/STO/IC API gateway |

## Agent skills (SSOT)

Project skills live in `.cursor/skills/`. Read the relevant skill **before** navigating the desk, calling STO APIs, or using MCP tools.

| Skill | When to load |
|-------|--------------|
| [opulentaggro-sto-navigation](.cursor/skills/opulentaggro-sto-navigation/SKILL.md) | Desk UI routes, STO workflow stages, Frappe REST, UI vs API vs MCP, prerequisites |
| [opulentaggro-vercel](.cursor/skills/opulentaggro-vercel/SKILL.md) | Vercel Next.js frontend, `/api/sto` / `/api/ic` proxies, deploy, remote ERPNext |
| [erpnext-sto-mcp](.cursor/skills/erpnext-sto-mcp/SKILL.md) | MCP server setup (stdio + Vercel HTTP), 26 tools (`sto_*`, `ic_*`, generic), STO + IC billing automation |
| [mcp-db-alignment](.cursor/skills/mcp-db-alignment/SKILL.md) | Keep MCP tools, ERPNext APIs, seed data, and tests in sync; tool registry |
| [mcp-e2e-testing](.cursor/skills/mcp-e2e-testing/SKILL.md) | End-to-end MCP tests against live ERPNext — stdio, API, agent-browser, screenshots, validation reports |

Trigger terms: OpulentAggro, intercompany, STO, stock transfer order, sto-dashboard, sto-trace, erpnext-mcp-server, Vercel deploy, MCP E2E test, endpoint validation, browser verify MCP.

## Conventions

- Do not commit secrets (`.env`, API keys). Use `*.env.example` as templates.
- **Local demo credentials:** `config/demo-credentials.env` (gitignored). Copy from `config/demo-credentials.env.example`. Scripts load via `scripts/load_env.sh`.
- DoA approval is human-governed — never auto-submit STOs without explicit approval.
- Prefer `sto_*` MCP tools over generic `call_method` for intercompany workflow steps.
- Prefer `ic_*` MCP tools for standalone intercompany AR/AP invoicing across company pairs.
- Workspace path may contain **two spaces** after `FW_`: `/Users/jeremyalston/Perfect/FW_  Intercompany Files/`

## Docs

- [docs/erpnext-sto-mcp-setup.md](docs/erpnext-sto-mcp-setup.md) — branding, desk pages, MCP config
- [docs/vercel-deployment-plan.md](docs/vercel-deployment-plan.md) — Vercel Next.js architecture and deploy
