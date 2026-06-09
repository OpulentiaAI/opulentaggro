# MCP troubleshooting — 7 fixes (2026-06-09)

From [docs/local-mcp-ui-validation-report.md](../../../docs/local-mcp-ui-validation-report.md).

| # | Tool / area | Symptom | Fix |
|---|-------------|---------|-----|
| 1 | `sto_submit` | Fails on re-submit | Idempotent `submit_stock_transfer_order`; accept `docstatus=1` |
| 2 | `sto_post_goods_in_transit`, `sto_post_goods_receipt`, `sto_generate_booking_advice` | NegativeStockError | Multi-warehouse stock prereqs (APAC/EU/NA Stores ≥150); `ensure_hosted_prereqs.run` |
| 3 | `ic_match_and_clear` | No linked PI on SI | Bidirectional SI↔PI in `create_intercompany_invoice_pair`; submit both in harness |
| 4 | `ic_triangular_sale` | Missing warehouse on SO | Default `warehouse` from sender company Stores |
| 5 | `ic_create_accrual` | JE validation party error | Auto `party_type`/`party` on Receivable/Payable lines |
| 6 | `get_document` (Vercel MCP) | Invalid Customer | Use real Customer name, not `Administrator` |
| 7 | Vercel MCP URL | Wrong endpoint | Default `http://localhost:3000/api/mcp` when `VERCEL_URL` set |

## Hosted prerequisites (Railway)

1. `System Settings.currency = USD`
2. `System Settings.setup_complete = 1`
3. Fiscal Year 2026 for all companies
4. Internal customer `companies` child includes all counterparties
5. Material Receipt stock in source warehouses

## Bench sync (accounts overlay)

`AttributeError: pre_submit_validation` on hosted → redeploy with `Dockerfile` `accounts/utils.py` overlay. See [docs/railway-backend-deployment.md](../../../docs/railway-backend-deployment.md).

## Alignment gate

```bash
./scripts/verify_mcp_alignment.sh
cd erpnext-mcp-server && npm test
```
