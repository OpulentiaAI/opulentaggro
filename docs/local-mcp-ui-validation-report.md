# Local MCP + UI Validation Report

**Timestamp:** 2026-06-09T02:15:00Z  
**Environment:** ERPNext `http://localhost:8000` (sto.local) · Vercel `http://localhost:3000` · MCP `http://localhost:3000/api/mcp`  
**Scripts:** `test_all_41_mcp_tools.py` · `verify_mcp_alignment.sh` · `test_local_mcp_ui_screenshots.sh`

## Executive summary

| Metric | Result |
|--------|--------|
| **MCP tools exercised — direct REST** | **33/33 PASS** |
| **MCP tools exercised — Vercel `/api/mcp`** | **33/33 PASS** |
| **MCP alignment gate** | **PASS** |
| **UI screenshots** | **11/11** (prior run; unchanged) |
| **Services** | ERPNext :8000 ✓ · Vercel :3000 ✓ |

All seven previously failing tools now pass on both transports. The harness spot-checks **33 of 41** registered MCP tools (16 `sto_*`, 14 `ic_*`, 3 generic); the remaining 8 generic tools are registry-only and not exercised in this script.

## Fixes applied (2026-06-09)

| Tool | Fix |
|------|-----|
| `sto_submit` | Idempotent `submit_stock_transfer_order` when PO already submitted; harness accepts `docstatus=1` |
| `sto_post_goods_in_transit` / `sto_post_goods_receipt` / `sto_generate_booking_advice` | Multi-warehouse stock prereqs (APAC/EU/NA Stores ≥150); prereq call before E2E |
| `ic_match_and_clear` | Bidirectional SI↔PI linking in `create_intercompany_invoice_pair`; submit both invoices in harness |
| `ic_triangular_sale` | Default `warehouse` on SO lines from sender company Stores |
| `ic_create_accrual` | Auto `party_type`/`party` on Receivable/Payable JE lines |
| `get_document` (Vercel) | Harness uses valid Customer name (not `Administrator`); defaults local MCP URL to `localhost:3000` |

## Phase 2 — MCP tool results

Report: [`docs/local-mcp-41-results.json`](local-mcp-41-results.json)

### Summary by transport

| Transport | Pass | Fail | Artifacts |
|-----------|------|------|-----------|
| Direct REST | 33 | 0 | PO `PUR-ORD-2026-00070`, SI `ACC-SINV-2026-00061`, PI `ACC-PINV-2026-00060`, SO `SAL-ORD-2026-00034`, JE `ACC-JV-2026-00003` |
| Vercel MCP | 33 | 0 | Same tool coverage; independent PO/SI/PI chain |

### All exercised tools — pass/fail

| Tool | Direct | Vercel MCP |
|------|--------|------------|
| sto_create | PASS | PASS |
| sto_submit | PASS | PASS |
| sto_request_approval | PASS | PASS |
| sto_approve | PASS | PASS |
| sto_reject | PASS | PASS |
| sto_approve_and_route | PASS | PASS |
| sto_post_goods_in_transit | PASS | PASS |
| sto_create_ic_invoice | PASS | PASS |
| sto_post_goods_receipt | PASS | PASS |
| sto_get_trace | PASS | PASS |
| sto_three_way_match | PASS | PASS |
| sto_list | PASS | PASS |
| sto_generate_booking_advice | PASS | PASS |
| sto_open_dispute | PASS | PASS |
| sto_resolve_dispute | PASS | PASS |
| sto_list_disputes | PASS | PASS |
| ic_list_accounts | PASS | PASS |
| ic_create_sales_invoice | PASS | PASS |
| ic_create_purchase_invoice | PASS | PASS |
| ic_create_invoice_pair | PASS | PASS |
| ic_submit_invoice | PASS | PASS |
| ic_get_invoice_status | PASS | PASS |
| ic_match_and_clear | PASS | PASS |
| ic_get_clearing_status | PASS | PASS |
| ic_list_pending_clearing | PASS | PASS |
| ic_get_reconciliation_summary | PASS | PASS |
| ic_triangular_sale | PASS | PASS |
| ic_list_triangular_sales | PASS | PASS |
| ic_create_accrual | PASS | PASS |
| ic_list_accruals | PASS | PASS |
| get_document | PASS | PASS |
| call_method | PASS | PASS |
| get_documents | PASS | PASS |

### Alignment gate

```text
./scripts/verify_mcp_alignment.sh → PASS
```

## Files changed

| File | Change |
|------|--------|
| `erpnext/.../stock_transfer_order.py` | Idempotent `sto_submit` |
| `erpnext/.../intercompany_billing.py` | `_link_intercompany_invoices` after pair create |
| `erpnext/.../intercompany_treasury.py` | Back-fill SI reference; tolerate one-sided link |
| `erpnext/.../intercompany_triangular.py` | Default warehouse on SO items |
| `erpnext/.../intercompany_accrual.py` | Party on Receivable/Payable JE lines |
| `scripts/ensure_hosted_prereqs.py` | Multi-warehouse stock seed; `@frappe.whitelist` on `run` |
| `scripts/test_all_41_mcp_tools.py` | Stock prereq, local MCP URL, SI+PI submit, `get_document` customer, exit code |

## Deliverables

| Item | Value |
|------|-------|
| MCP direct count | **33/33 PASS** |
| MCP Vercel count | **33/33 PASS** |
| Registry total | 41 tools (33 spot-checked) |
| Reports | `docs/local-mcp-41-results.json`, this file |
