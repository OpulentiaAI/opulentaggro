# MCP troubleshooting — 10 fixes (2026-06-09)

From [docs/local-mcp-ui-validation-report.md](../../../docs/local-mcp-ui-validation-report.md).

| # | Tool / area | Symptom | Fix |
|---|-------------|---------|-----|
| 1 | `sto_submit` | Fails on re-submit | Idempotent `submit_stock_transfer_order`; accept `docstatus=1` |
| 2 | `sto_post_goods_in_transit`, `sto_post_goods_receipt`, `sto_generate_booking_advice` | NegativeStockError | Multi-warehouse stock prereqs (APAC/EU/NA Stores ≥250); call `ensure_hosted_prereqs.run` before **each** E2E transport (direct + MCP = 202 qty) |
| 3 | `ic_match_and_clear` | No linked PI on SI | Bidirectional SI↔PI in `create_intercompany_invoice_pair`; submit both in harness |
| 4 | `ic_triangular_sale` | Missing warehouse on SO | Default `warehouse` from sender company Stores |
| 5 | `ic_create_accrual` | JE validation party error | Auto `party_type`/`party` on Receivable/Payable lines |
| 6 | `get_document` (Vercel MCP) | Invalid Customer | Use real Customer name, not `Administrator` |
| 7 | Vercel MCP URL | Wrong endpoint | Default `http://localhost:3000/api/mcp` when `VERCEL_URL` set |
| 8 | `sto_generate_booking_advice` (hosted) | FileNotFoundError on BOL | Ensure `sites/<site>/public/files` exists; `ensure_hosted_prereqs._ensure_public_files_dir`; idempotent return via `get_booking_advice_status` |
| 9 | All MCP tools (hosted) | API 401 after Railway redeploy | `entrypoint.sh` must use `Fernet.generate_key().decode()` (not `token_hex`); regenerate keys via SSH; sync `ERPNEXT_API_SECRET` to Vercel |
| 10 | `sto_post_goods_in_transit` / `sto_post_goods_receipt` | MCP-only fail when direct passes | Usually stale Vercel API secret (#9) or stock depleted between transports (#2) |

## Hosted prerequisites (Railway)

1. `System Settings.currency = USD`
2. `System Settings.setup_complete = 1`
3. Fiscal Year 2026 for all companies
4. Internal customer `companies` child includes all counterparties
5. Material Receipt stock in source warehouses (≥250 units for dual-transport E2E)
6. `public/files` directory on site volume (BOL HTML attachments)
7. Valid Fernet `encryption_key` in `site_config.json` (see #9)

**API module:** `erpnext.intercompany.ensure_hosted_prereqs.run` (whitelisted; called by harness before direct + MCP runs).

## Bench sync (accounts overlay)

`AttributeError: pre_submit_validation` on hosted → redeploy with `Dockerfile` `accounts/utils.py` overlay. See [docs/railway-backend-deployment.md](../../../docs/railway-backend-deployment.md).

## Alignment gate

```bash
./scripts/verify_mcp_alignment.sh
cd erpnext-mcp-server && npm test
```
