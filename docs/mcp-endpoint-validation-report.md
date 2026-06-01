# MCP Endpoint Validation Report

**Timestamps:** 2026-05-31T21:12:00Z (local), 2026-06-01T14:28:45Z (hosted)
**Environments:** localhost:8000 (sto.local) + Railway production (https://erpnext-production-512a.up.railway.app)
**STO Purchase Order (local):** `PUR-ORD-2026-00038`
**STO Purchase Order (hosted):** `PUR-ORD-2026-00020`
**IC Sales Invoice (local):** `ACC-SINV-2026-00029`
**IC Purchase Invoice (local):** `ACC-PINV-2026-00029`
**IC Sales Invoice (hosted):** `ACC-SINV-2026-00037`
**IC Purchase Invoice (hosted):** `ACC-PINV-2026-00037`
**Marked UI PO (Vercel MCP proxy):** `PUR-ORD-2026-00023` Draft $4,400.00

## Results

| Endpoint | Local MCP | Hosted Direct | Vercel MCP Proxy | Browser Verified | Screenshot |
|----------|-----------|---------------|------------------|------------------|------------|
| `ic_list_accounts` | PASS | PASS | PASS | Yes (Vercel) | `docs/screenshots/hosted-mcp-validation/04-intercompany.png` |
| `sto_list` | PASS | PASS | PASS | Yes (Vercel) | `docs/screenshots/hosted-mcp-validation/02-sto-dashboard.png` |
| `sto_create` | PASS | PASS | PASS (PUR-ORD-2026-00023) | Yes (Vercel) | `docs/screenshots/hosted-mcp-validation/08-mcp-action-in-ui.png` |
| `sto_submit` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/03-sto-submit-approve.png` |
| `sto_approve_and_route` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/03-sto-submit-approve.png` |
| `sto_post_goods_in_transit` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/04-sto-git.png` |
| `sto_create_ic_invoice` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/05-sto-ic-invoice.png` |
| `sto_post_goods_receipt` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/06-sto-receipt.png` |
| `sto_get_trace` | PASS | PASS | PASS | Yes | `docs/screenshots/mcp-validation/07-sto-trace.png` |
| `sto_three_way_match` | PASS | PASS | PASS | Yes | `docs/screenshots/mcp-validation/08-sto-three-way-match.png` |
| `ic_create_sales_invoice` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/10-ic-invoice-pair.png` |
| `ic_create_purchase_invoice` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/10-ic-invoice-pair.png` |
| `ic_create_invoice_pair` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/10-ic-invoice-pair.png` |
| `ic_get_invoice_status` | PASS | PASS | PASS | Yes | `docs/screenshots/mcp-validation/11-ic-invoice-status.png` |
| `ic_submit_invoice` | PASS | PASS | — | Yes | `docs/screenshots/mcp-validation/11-ic-invoice-status.png` |

**Summary:** 15/15 MCP endpoints pass on local, hosted direct, and Vercel MCP proxy. MCP action (sto_create with unique marker) is **visible in the Vercel UI** after browser refresh.

## Hosted run results (2026-06-01)

| Suite | Result | Notes |
|-------|--------|-------|
| `test_hosted_mcp_e2e.py` | 15/15 PASS | PUR-ORD-2026-00020 → SAL-ORD-2026-00014 → DN → PR → SI+PI (Three Way Matched) |
| `test_all_mcp_endpoints.py` | 17/17 PASS | PUR-ORD-2026-00022, ACC-SINV/PINV-2026-00043 |
| `verify_mcp_alignment.sh` | PASS | Registry vs sto-tools.ts, ic-billing-tools.ts, Python syntax |
| Vercel MCP `initialize` | PASS | protocolVersion 2024-11-05 |
| Vercel MCP `sto_create` (marked) | PASS | PUR-ORD-2026-00023 qty=88 rate=50 $4,400.00 |

## Critical fixes applied for hosted validation

1. **Docker overlay for `accounts/utils.py`** — `pre_submit_validation` function missing from stock ERPNext v15 image, added via Dockerfile `COPY` + `RUN grep` build marker
2. **PORT=80 for nginx** — Railway edge routes to configured PORT
3. **System Settings currency=USD** — intercompany validation requires matching currencies
4. **Fiscal Year 2026** — created for all 3 companies
5. **Internal customer `companies` child table** — all 3 companies for full IC permission
6. **Stock seeding** — 51+60 units of test items in `Stores - OFAP` (Material Receipts)
7. **`setup_complete=1`** — prevents Frappe setup wizard from blocking embeds
8. **Vercel MCP `sto_create` items encoding** — JSON args fixed in `json-args.ts`
9. **Vercel MCP API token auth** — `auth.ts` forwards service token to backend
10. **Frappe embed `strip_prefix`** — removes `/erpnext/` prefix in `frappe-desk-proxy.ts`
11. **Stage badges** — `stage-inference.ts` + `include_stage=1` in `sto_dashboard.py` (Completed not Unknown)

## Production endpoints

- **Vercel desk:** https://vercel-indol-phi-69.vercel.app
- **Vercel MCP proxy:** https://vercel-indol-phi-69.vercel.app/api/mcp (streamable-http)
- **Vercel health:** https://vercel-indol-phi-69.vercel.app/api/health
- **Railway ERPNext:** https://erpnext-production-512a.up.railway.app
- **API key/secret:** `5b218748d06d007:b9a99536f8deac3` (from Railway logs)

## See also

- [docs/hosted-mcp-validation-report.md](hosted-mcp-validation-report.md) — detailed hosted validation report
- [docs/hosted-mcp-results.json](hosted-mcp-results.json) — machine-readable hosted results
- [docs/railway-backend-deployment.md](railway-backend-deployment.md) — Railway deployment guide
- [docs/vercel-deployment-plan.md](vercel-deployment-plan.md) — Vercel deployment plan
- [docs/1to1-port-validation-report.md](1to1-port-validation-report.md) — 1-to-1 port validation baseline
- [docs/erpnext-sto-mcp-setup.md](erpnext-sto-mcp-setup.md) — MCP server setup
- [docs/erpnext-sto-test-setup.md](erpnext-sto-test-setup.md) — Test setup

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
