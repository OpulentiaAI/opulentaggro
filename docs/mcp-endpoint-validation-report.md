# MCP Endpoint Validation Report

**Timestamp:** 2026-05-31T21:12:00Z  
**ERPNext:** http://localhost:8000 (site sto.local)  
**STO Purchase Order:** `PUR-ORD-2026-00038`  
**IC Sales Invoice:** `ACC-SINV-2026-00029`  
**IC Purchase Invoice:** `ACC-PINV-2026-00029`  

## Results

| Endpoint | MCP Result | Browser Verified | Screenshot |
|----------|------------|------------------|------------|
| `ic_list_accounts` | PASS | Yes | `docs/screenshots/mcp-validation/09-ic-list-accounts.png` |
| `sto_list` | PASS | Yes | `docs/screenshots/mcp-validation/01-sto-list-baseline.png` |
| `sto_create` | PASS | Yes | `docs/screenshots/mcp-validation/02-sto-create.png` |
| `sto_submit` | PASS | Yes | `docs/screenshots/mcp-validation/03-sto-submit-approve.png` |
| `sto_approve_and_route` | PASS | Yes | `docs/screenshots/mcp-validation/03-sto-submit-approve.png` |
| `sto_post_goods_in_transit` | PASS | Yes | `docs/screenshots/mcp-validation/04-sto-git.png` |
| `sto_create_ic_invoice` | PASS | Yes | `docs/screenshots/mcp-validation/05-sto-ic-invoice.png` |
| `sto_post_goods_receipt` | PASS | Yes | `docs/screenshots/mcp-validation/06-sto-receipt.png` |
| `sto_get_trace` | PASS | Yes | `docs/screenshots/mcp-validation/07-sto-trace.png` |
| `sto_three_way_match` | PASS | Yes | `docs/screenshots/mcp-validation/08-sto-three-way-match.png` |
| `ic_create_sales_invoice` | PASS | Yes | `docs/screenshots/mcp-validation/10-ic-invoice-pair.png` |
| `ic_create_purchase_invoice` | PASS | Yes | `docs/screenshots/mcp-validation/10-ic-invoice-pair.png` |
| `ic_create_invoice_pair` | PASS | Yes | `docs/screenshots/mcp-validation/10-ic-invoice-pair.png` |
| `ic_get_invoice_status` | PASS | Yes | `docs/screenshots/mcp-validation/11-ic-invoice-status.png` |
| `ic_submit_invoice` | PASS | Yes | `docs/screenshots/mcp-validation/11-ic-invoice-status.png` |

**Summary:** 15/15 MCP endpoints passed.

## Notes

- MCP tests run via stdio JSON-RPC through `scripts/run_mcp_server.sh` (not API-direct).
- Workflow screenshots 03–08 use linked ERPNext forms (PO, Delivery Note, SI list, PR list) because the `sto-trace` page async loader is unreliable in headless agent-browser.
- Re-run: `bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_endpoints_with_screenshots.sh'`

## Screenshot index

- [01-sto-list-baseline.png](docs/screenshots/mcp-validation/01-sto-list-baseline.png)
- [02-sto-create.png](docs/screenshots/mcp-validation/02-sto-create.png)
- [03-sto-submit-approve.png](docs/screenshots/mcp-validation/03-sto-submit-approve.png)
- [04-sto-git.png](docs/screenshots/mcp-validation/04-sto-git.png)
- [05-sto-ic-invoice.png](docs/screenshots/mcp-validation/05-sto-ic-invoice.png)
- [06-sto-receipt.png](docs/screenshots/mcp-validation/06-sto-receipt.png)
- [07-sto-trace.png](docs/screenshots/mcp-validation/07-sto-trace.png)
- [08-sto-three-way-match.png](docs/screenshots/mcp-validation/08-sto-three-way-match.png)
- [09-ic-list-accounts.png](docs/screenshots/mcp-validation/09-ic-list-accounts.png)
- [10-ic-invoice-pair.png](docs/screenshots/mcp-validation/10-ic-invoice-pair.png)
- [11-ic-invoice-status.png](docs/screenshots/mcp-validation/11-ic-invoice-status.png)
- [summary-report.png](docs/screenshots/mcp-validation/summary-report.png)
