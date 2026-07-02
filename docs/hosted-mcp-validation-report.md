# Hosted MCP validation report

**Date:** 2026-06-09
**Stack:** Railway ERPNext + Vercel MCP proxy
**Result:** **33/33 PASS** direct + **33/33 PASS** Vercel MCP (matches local)

| Interface | URL |
|-----------|-----|
| ERPNext | https://erpnext-production-512a.up.railway.app |
| Vercel desk | https://vercel-indol-phi-69.vercel.app |
| MCP proxy | https://vercel-indol-phi-69.vercel.app/api/mcp |

## Root causes fixed

| Tool | Symptom | Root cause | Fix |
|------|---------|------------|-----|
| `sto_post_goods_in_transit` | HTTP 417 NegativeStockError (direct + MCP) | E2E harness runs qty=101 on **both** transports; APAC Stores depleted below 202 | `ensure_hosted_prereqs` module (MIN_STOCK_QTY=250); harness calls prereqs before direct **and** MCP |
| `sto_post_goods_receipt` | Cascaded from GIT failure | No submitted DN when GIT failed | Same stock fix; idempotent return if PR already exists |
| `sto_generate_booking_advice` | FileNotFoundError (500/417) | Missing `sites/<site>/public/files` on Railway volume | `_ensure_public_files_dir`; idempotent via `get_booking_advice_status` |
| All Vercel MCP tools | 401 / "Failed to call method" | Invalid Fernet `encryption_key` (`token_hex` in entrypoint) invalidated API secrets after redeploy | `entrypoint.sh` uses `Fernet.generate_key()`; regenerated Administrator keys; synced `ERPNEXT_API_SECRET` to Vercel |

## Files changed

- `erpnext/erpnext/intercompany/ensure_hosted_prereqs.py` — new whitelisted module (stock, FY, public/files)
- `erpnext/erpnext/intercompany/stock_transfer_order.py` — idempotent GIT/GR/BOL; booking advice files dir
- `scripts/ensure_hosted_prereqs.py` — delegates to erpnext module
- `scripts/test_all_41_mcp_tools.py` — hosted stock prereqs; fix `total` print bug
- `railway/entrypoint.sh` — Fernet encryption key generation
- `.cursor/skills/opulentaggro-sto-mcp/references/troubleshooting.md` — hosted fixes #8–10

## Verification

```bash
source scripts/load_cloud_agent_env.sh
# ERPNEXT_API_SECRET must match Railway Administrator keys
python3 scripts/test_all_41_mcp_tools.py --report docs/hosted-mcp-41-results.json
./scripts/verify_mcp_alignment.sh
```

Latest artifacts: `docs/hosted-mcp-41-results.json` (PO `PUR-ORD-2026-00061`).

## Deploy status

- **Railway erpnext:** deployed (`railway up --service erpnext`)
- **Vercel production:** deployed (`vercel deploy --prod`); `ERPNEXT_API_SECRET` updated in production env

**Note:** After Railway redeploy, confirm API token auth with `curl …/api/method/frappe.ping`. If 401, regenerate keys via `railway ssh` and re-sync Vercel env.
