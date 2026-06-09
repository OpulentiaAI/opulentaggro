# MCP tool registry — STO + IC billing + IC extended + generic

Keep this file in sync when adding MCP tools, ERPNext whitelisted methods, or seed data.

**Total: 41 MCP tools** (16 `sto_*` + 6 `ic_*` billing + 8 `ic_*` extended + 11 generic)

Source files: `erpnext-mcp-server/src/sto-tools.ts`, `ic-billing-tools.ts`, `ic-extended-tools.ts`, `create-server.ts`

User-facing docs: [opulentaggro-sto-mcp/SKILL.md](../../opulentaggro-sto-mcp/SKILL.md)

## STO tools (16)

| MCP tool | ERPNext method | HTTP | DB prerequisites |
|----------|----------------|------|------------------|
| `sto_create` | `stock_transfer_order.create_stock_transfer_order` | POST | Receiving `Company`, internal `Supplier`, `Item`, warehouses, price list |
| `sto_submit` | `stock_transfer_order.submit_stock_transfer_order` | POST | Draft internal `Purchase Order` |
| `sto_approve_and_route` | `stock_transfer_order.approve_and_route_stock_transfer` | POST | Submitted PO |
| `sto_post_goods_in_transit` | `stock_transfer_order.post_goods_in_transit` | POST | Approved PO/SO; GIT `Warehouse` |
| `sto_create_ic_invoice` | `stock_transfer_order.create_intercompany_invoice` | POST | DN posted |
| `sto_post_goods_receipt` | `stock_transfer_order.post_stock_transfer_receipt` | POST | DN; PO |
| `sto_get_trace` | `stock_transfer_order.get_stock_transfer_trace` | POST | PO name |
| `sto_three_way_match` | `stock_transfer_order.run_stock_transfer_three_way_match` | POST | PO + PR + PI chain |
| `sto_list` | `stock_transfer_order.list_stock_transfer_orders` | POST | Optional company filter |
| `sto_generate_booking_advice` | `stock_transfer_order.generate_booking_advice` | POST | DN posted |
| `sto_request_approval` | `stock_transfer_order.request_sto_approval` | POST | Draft PO |
| `sto_approve` | `stock_transfer_order.approve_sto` | POST | Draft PO + approval request |
| `sto_reject` | `stock_transfer_order.reject_sto` | POST | Draft PO |
| `sto_open_dispute` | `stock_transfer_order.open_sto_dispute` | POST | PO |
| `sto_resolve_dispute` | `stock_transfer_order.resolve_sto_dispute` | POST | Open dispute |
| `sto_list_disputes` | `stock_transfer_order.list_sto_disputes` | POST | Optional company |

## IC billing tools (6)

| MCP tool | ERPNext method | HTTP | DB prerequisites |
|----------|----------------|------|------------------|
| `ic_list_accounts` | `intercompany_billing.list_intercompany_accounts` | POST | Internal Customer/Supplier per pair |
| `ic_create_sales_invoice` | `intercompany_billing.create_intercompany_sales_invoice` | POST | Pair; seller internal Customer |
| `ic_create_purchase_invoice` | `intercompany_billing.create_intercompany_purchase_invoice` | POST | Pair; buyer internal Supplier |
| `ic_create_invoice_pair` | `intercompany_billing.create_intercompany_invoice_pair` | POST | Both AR/AP links |
| `ic_submit_invoice` | `intercompany_billing.submit_intercompany_invoice` | POST | Draft SI and/or PI |
| `ic_get_invoice_status` | `intercompany_billing.get_intercompany_invoice_status` | POST | SI or PI name |

## IC extended tools (8)

| MCP tool | ERPNext method | HTTP | Notes |
|----------|----------------|------|-------|
| `ic_match_and_clear` | `intercompany_treasury.match_and_clear_intercompany_invoice` | POST | F110-lite Payment Entries |
| `ic_get_clearing_status` | `intercompany_treasury.get_clearing_status` | POST | Linked SI/PI |
| `ic_list_pending_clearing` | `intercompany_treasury.list_pending_ic_clearing` | POST | Reconciliation workspace |
| `ic_get_reconciliation_summary` | `intercompany_treasury.get_central_reconciliation_summary` | POST | Cross-company dashboard |
| `ic_triangular_sale` | `intercompany_triangular.create_triangular_sale` | POST | Customer + IC pair MVP |
| `ic_list_triangular_sales` | `intercompany_triangular.list_triangular_sales` | POST | List tagged SOs |
| `ic_create_accrual` | `intercompany_accrual.create_accrual_allocation` | POST | Journal Entry MVP |
| `ic_list_accruals` | `intercompany_accrual.list_accrual_allocations` | POST | List tagged JEs |

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

## Validation commands

```bash
cd erpnext-mcp-server && npm run build
node tests/sto-tools.test.mjs
node tests/ic-billing-tools.test.mjs
node tests/ic-extended-tools.test.mjs
./scripts/sync-mcp-vendor.sh
./scripts/verify_mcp_alignment.sh
python3 scripts/test_all_mcp_endpoints.py --mock-only
```
