---
name: mcp-db-alignment
description: Keeps erpnext-mcp-server MCP tools, ERPNext whitelisted APIs, seed data, and tests aligned. Use when adding sto_* or ic_* tools, changing intercompany APIs, updating seed scripts, or verifying MCP/DB parity.
---

# MCP ↔ DB alignment

## When to load

- Adding or renaming an MCP tool (`sto_*`, `ic_*`)
- Changing `erpnext/erpnext/intercompany/*.py` whitelisted methods
- Updating `scripts/seed_mcp_alignment.py` or integration tests
- CI / local verification before merge

## Source of truth

| Layer | Path |
|-------|------|
| MCP tools | `erpnext-mcp-server/src/sto-tools.ts`, `ic-billing-tools.ts`, `create-server.ts` (generic) |
| ERPNext API | `erpnext/erpnext/intercompany/stock_transfer_order.py`, `intercompany_billing.py` |
| Tool registry | [references/tool-registry.md](references/tool-registry.md) |
| Seed data | `scripts/seed_mcp_alignment.py` |
| Mock tests | `erpnext-mcp-server/tests/*.test.mjs` |
| Live tests | `scripts/test_all_mcp_endpoints.py` |

## Checklist — new MCP tool

1. Add whitelisted method on ERPNext with matching parameter names.
2. Add tool definition + handler in `sto-tools.ts` or `ic-billing-tools.ts`.
3. Add row to [tool-registry.md](references/tool-registry.md) (tool → method → DB prereqs).
4. Extend `seed_mcp_alignment.py` if new master data is required.
5. Add mock test case in `tests/sto-tools.test.mjs` or `ic-billing-tools.test.mjs`.
6. Extend `scripts/test_all_mcp_endpoints.py` live path if applicable.
7. Run `./scripts/verify_mcp_alignment.sh`.
8. Update [erpnext-sto-mcp](../erpnext-sto-mcp/SKILL.md) if user-facing tool docs change (26 tools: 9 + 6 + 11).

## Local auth (dev only)

- `ERPNEXT_NO_AUTH=1` or `MCP_NO_AUTH=1` with `ERPNEXT_URL` on **localhost** only.
- MCP logs in via `ERPNEXT_DEV_USER` / `ERPNEXT_DEV_PASSWORD` from `config/demo-credentials.env` (aliases: `DEMO_ADMIN_*`, `FRAPPE_ADMIN_PASSWORD`).
- Production: always `ERPNEXT_API_KEY` + `ERPNEXT_API_SECRET`.

## Seed

```bash
bench --site sto.local execute scripts.seed_mcp_alignment.run
```

Idempotent; safe to re-run after schema changes.

## Verify

```bash
./scripts/verify_mcp_alignment.sh
ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py
```
