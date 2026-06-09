# UI screenshot matrix (11 flows)

Script: `scripts/test_local_mcp_ui_screenshots.sh`  
Output: `docs/screenshots/local-mcp-ui-validation/`

MCP action: `sto_create` with **qty=102** via `http://localhost:3000/api/mcp`.

| # | File | MCP / page | Visible effect |
|---|------|------------|----------------|
| 01 | `01-sto-create.png` | `sto_create` qty=102 | PO row on `/app/sto-dashboard` |
| 02 | `02-doa.png` | trace DoA | Approval banner on `/app/sto-trace` |
| 03 | `03-bol.png` | `sto_generate_booking_advice` | BOL panel on trace |
| 04 | `04-workflow.png` | full chain stages | Workflow timeline on trace |
| 05 | `05-dispute.png` | `sto_open_dispute` | Dispute panel on trace |
| 06 | `06-clearing.png` | `ic_match_and_clear` | Clearing panel on trace |
| 07 | `07-billing.png` | `ic_*` billing | `/app/intercompany/billing` |
| 08 | `08-triangular.png` | `ic_triangular_sale` | `/app/intercompany/triangular` |
| 09 | `09-accrual.png` | `ic_create_accrual` | Reconciliation accrual context |
| 10 | `10-reconciliation.png` | `ic_get_reconciliation_summary` | `/app/reconciliation` |
| 11 | `11-mcp-proxy-effect.png` | MCP proxy | qty=102 PO visible after SSE call |

## Legacy 15-tool matrix

`docs/screenshots/mcp-validation/` from `test_mcp_endpoints_with_screenshots.sh` — see [mcp-e2e-testing/references/endpoint-checklist.md](../../mcp-e2e-testing/references/endpoint-checklist.md).

## Hosted screenshots

`docs/screenshots/mcp-full-ui-validation/` — 16 flows from full UI validation run.
