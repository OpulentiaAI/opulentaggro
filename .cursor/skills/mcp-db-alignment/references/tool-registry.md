# MCP tool registry — STO + IC billing + generic

Keep this file in sync when adding MCP tools, ERPNext whitelisted methods, or seed data.

**Total: 26 MCP tools** (9 `sto_*` + 6 `ic_*` + 11 generic)

Source files: `erpnext-mcp-server/src/sto-tools.ts`, `ic-billing-tools.ts`, `create-server.ts`

User-facing docs: [erpnext-sto-mcp/SKILL.md](../../erpnext-sto-mcp/SKILL.md)

## STO tools (9)

| MCP tool | ERPNext method | HTTP | DB prerequisites |
|----------|----------------|------|------------------|
| `sto_create` | `stock_transfer_order.create_stock_transfer_order` | POST | Receiving `Company`, internal `Supplier`, `Item`, receiving/sending `Warehouse`, price list |
| `sto_submit` | `stock_transfer_order.submit_stock_transfer_order` | POST | Draft internal `Purchase Order` |
| `sto_approve_and_route` | `stock_transfer_order.approve_and_route_stock_transfer` | POST | Submitted PO |
| `sto_post_goods_in_transit` | `stock_transfer_order.post_goods_in_transit` | POST | Approved PO/SO; GIT `Warehouse` on receiver |
| `sto_create_ic_invoice` | `stock_transfer_order.create_intercompany_invoice` | POST | DN posted; inter-company invoice settings |
| `sto_post_goods_receipt` | `stock_transfer_order.post_stock_transfer_receipt` | POST | DN; PO |
| `sto_get_trace` | `stock_transfer_order.get_stock_transfer_trace` | POST | PO name |
| `sto_three_way_match` | `stock_transfer_order.run_stock_transfer_three_way_match` | POST | PO + PR + PI chain |
| `sto_list` | `stock_transfer_order.list_stock_transfer_orders` | POST | Optional company filter |

## IC billing tools (6)

| MCP tool | ERPNext method | HTTP | DB prerequisites |
|----------|----------------|------|------------------|
| `ic_list_accounts` | `intercompany_billing.list_intercompany_accounts` | POST | Internal Customer/Supplier per pair |
| `ic_create_sales_invoice` | `intercompany_billing.create_intercompany_sales_invoice` | POST | Pair; seller internal Customer; items |
| `ic_create_purchase_invoice` | `intercompany_billing.create_intercompany_purchase_invoice` | POST | Pair; buyer internal Supplier; items |
| `ic_create_invoice_pair` | `intercompany_billing.create_intercompany_invoice_pair` | POST | Both AR/AP links; items |
| `ic_submit_invoice` | `intercompany_billing.submit_intercompany_invoice` | POST | Draft SI and/or PI |
| `ic_get_invoice_status` | `intercompany_billing.get_intercompany_invoice_status` | POST | SI or PI name |

## Generic MCP tools (11)

| MCP tool | ERPNext surface | Notes |
|----------|-----------------|-------|
| `get_doctypes` | DocType list | Auth required |
| `get_doctype_fields` | Sample doc fields | Auth required |
| `get_documents` | `/api/resource/{doctype}` | Auth required |
| `get_document` | `/api/resource/{doctype}/{name}` | Auth required |
| `create_document` | POST resource | Auth required; not for STO |
| `update_document` | PUT resource | Auth required |
| `submit_document` | `frappe.client.submit` | Auth required |
| `cancel_document` | `frappe.client.cancel` | Auth required |
| `delete_document` | DELETE resource | Auth required |
| `call_method` | `/api/method/{path}` | Escape hatch |
| `run_report` | `frappe.desk.query_report.run` | Auth required |

## Transport

| Mode | Entry | Auth to ERPNext |
|------|-------|-----------------|
| Stdio | `erpnext-mcp-server/src/index.ts` | API token or `ERPNEXT_NO_AUTH=1` (localhost) |
| HTTP | `vercel/api/mcp.ts` → `create-server.ts` | API token only; optional `MCP_AUTH_TOKEN` Bearer |

## Seed script mapping

`scripts/seed_mcp_alignment.py` creates:

- Companies: Opulent Fresh NA, EU, APAC
- Pairs: EU→NA (STO), EU→NA / A↔C / B↔C (IC multi-account)
- Items: `STO-TEST-ITEM-001`, `STO-TEST-ITEM-002` + Standard Selling prices
- Warehouses: Stores + GIT In Transit per NA/EU

## Validation commands

```bash
cd erpnext-mcp-server && npm run build
node tests/sto-tools.test.mjs
node tests/ic-billing-tools.test.mjs
./scripts/verify_mcp_alignment.sh
python3 scripts/test_all_mcp_endpoints.py --mock-only
# Live (site up, seeded):
source scripts/load_env.sh
ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py
# Full validation with screenshots:
ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_endpoints_with_screenshots.sh
```

Validated 2026-05-31: 15/15 STO + IC endpoints — see [docs/mcp-endpoint-validation-report.md](../../../docs/mcp-endpoint-validation-report.md).
