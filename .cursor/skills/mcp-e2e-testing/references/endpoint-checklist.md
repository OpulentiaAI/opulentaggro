# 15 MCP endpoint E2E checklist

STO + IC billing tools exercised by `mcp_stdio_runner.py` and browser validation. Registry details: [mcp-db-alignment/references/tool-registry.md](../../mcp-db-alignment/references/tool-registry.md).

Default seed: **Opulent Fresh NA** / **Internal Supplier Opulent Fresh EU** / **STO-TEST-ITEM-001** / **Stores - OFNA**.

## Execution order (stdio runner)

Tools run in dependency order; later steps require earlier document names.

| # | Tool | Creates / mutates | Browser verify route | Screenshot |
|---|------|-------------------|----------------------|------------|
| 1 | `ic_list_accounts` | Lists IC pairs | `/app/intercompany` | `09-ic-list-accounts.png` |
| 2 | `sto_list` | Lists STO rows | `/app/sto-dashboard` | `01-sto-list-baseline.png` |
| 3 | `sto_create` | Draft internal PO | `/app/sto-dashboard` (PO row) | `02-sto-create.png` |
| 4 | `sto_submit` | Submitted PO | `/app/purchase-order/{PO}` | `03-sto-submit-approve.png` |
| 5 | `sto_approve_and_route` | Sales Order on sender | Same PO form | `03-sto-submit-approve.png` |
| 6 | `sto_post_goods_in_transit` | Delivery Note + GIT | `/app/delivery-note/{DN}` or list | `04-sto-git.png` |
| 7 | `sto_create_ic_invoice` | SI + PI for STO | `/app/sales-invoice` list | `05-sto-ic-invoice.png` |
| 8 | `sto_post_goods_receipt` | Purchase Receipt | `/app/purchase-receipt` list | `06-sto-receipt.png` |
| 9 | `sto_get_trace` | Trace JSON | `/app/purchase-order/{PO}` (fallback) | `07-sto-trace.png` |
| 10 | `sto_three_way_match` | Match result | Same PO form | `08-sto-three-way-match.png` |
| 11 | `ic_create_sales_invoice` | Draft SI (standalone) | `/app/sales-invoice/{SI}` | `10-ic-invoice-pair.png` |
| 12 | `ic_create_purchase_invoice` | Draft PI (standalone) | (paired with SI) | `10-ic-invoice-pair.png` |
| 13 | `ic_create_invoice_pair` | SI + PI pair | `/app/sales-invoice/{SI}` | `10-ic-invoice-pair.png` |
| 14 | `ic_get_invoice_status` | Status dict | `/app/purchase-invoice/{PI}` | `11-ic-invoice-status.png` |
| 15 | `ic_submit_invoice` | Submitted SI | Same PI form | `11-ic-invoice-status.png` |

**Summary screenshot:** `summary-report.png` — dashboard with final PO visible.

## Per-tool verification

Copy and track during a manual or partial run:

```
STO + IC E2E progress:
- [ ] ic_list_accounts — ≥1 pair returned
- [ ] sto_list — list returns (count ≥ 0)
- [ ] sto_create — purchase_order in response; PO on sto-dashboard
- [ ] sto_submit — docstatus 1 on PO REST
- [ ] sto_approve_and_route — sales_order in response/trace
- [ ] sto_post_goods_in_transit — delivery_note in response
- [ ] sto_create_ic_invoice — sales_invoice + purchase_invoice in response
- [ ] sto_post_goods_receipt — purchase_receipt in response
- [ ] sto_get_trace — documents chain includes PO/SO/DN
- [ ] sto_three_way_match — match result without error
- [ ] ic_create_sales_invoice — sales_invoice name
- [ ] ic_create_purchase_invoice — purchase_invoice name
- [ ] ic_create_invoice_pair — both SI and PI names
- [ ] ic_get_invoice_status — status for SI/PI
- [ ] ic_submit_invoice — SI docstatus submitted (PI optional)
```

## Response fields to capture

| Tool | Key response fields |
|------|---------------------|
| `sto_create` | `purchase_order`, `stage` |
| `sto_submit` | `docstatus`, `stage` |
| `sto_approve_and_route` | `sales_order`, `stage` |
| `sto_post_goods_in_transit` | `delivery_note`, `stage` |
| `sto_create_ic_invoice` | `sales_invoice`, `purchase_invoice` |
| `sto_post_goods_receipt` | `purchase_receipt`, `stage` |
| `sto_get_trace` | `documents`, `stage` |
| `sto_three_way_match` | match status fields |
| `ic_create_*` | `sales_invoice`, `purchase_invoice` |
| `ic_get_invoice_status` | paired status dict |

## sto-trace fallback

`/app/sto-trace?purchase_order={PO}` async loader is **unreliable in headless agent-browser**. Full E2E uses linked forms instead:

- PO form → submit/approve/trace proof
- Delivery Note list/form → GIT
- Sales Invoice list → IC invoice
- Purchase Receipt list → receipt
- Intercompany workspace → IC accounts

For interactive desk testing, sto-trace works after full page load; prefer form views for CI/screenshots.

## When adding tool #16

1. Add to `mcp_stdio_runner.py` `run_all()`
2. Add row to [tool-registry.md](../../mcp-db-alignment/references/tool-registry.md)
3. Extend `test_all_mcp_endpoints.py` live path
4. Add screenshot mapping in `test_mcp_endpoints_with_screenshots.sh` report generator
5. Update this checklist
6. Run `./scripts/verify_mcp_alignment.sh`
