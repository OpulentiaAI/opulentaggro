# STO MCP Workflows

Validated against `sto.local` on 2026-05-31 — see [docs/mcp-endpoint-validation-report.md](../../../docs/mcp-endpoint-validation-report.md) (15/15 endpoints passed).

## Standard 9-step chain

Sequential order is mandatory. Each step depends on documents from prior steps.

| Step | Tool | Expected stage after |
|------|------|---------------------|
| 1 | sto_create | Draft |
| 2 | sto_submit | Pending Approval |
| 3 | sto_approve_and_route | Approved |
| 4 | sto_post_goods_in_transit | Goods In Transit |
| 5 | sto_create_ic_invoice | IC Invoiced |
| 6 | sto_post_goods_receipt | Received |
| 7 | sto_three_way_match | Three Way Matched or Dispute |
| 8 | sto_get_trace | (audit) |
| 9 | sto_list | (index check) |

### Human gate at step 2

DoA approval is **not** automated. Agent workflow:

1. Call `sto_create` → notify user PO name and Draft stage
2. **Wait** for explicit user confirmation of DoA approval
3. Only then call `sto_submit`

Same applies when using desk UI: Submit button maps to `submit_stock_transfer_order`.

## Validated end-to-end example

Test run produced PO **`PUR-ORD-2026-00038`** with IC invoices **`ACC-SINV-2026-00029`** / **`ACC-PINV-2026-00029`**.

```json
// Step 1 — sto_create
{
  "company": "Opulent Fresh NA",
  "supplier": "Internal Supplier Opulent Fresh EU",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 10, "rate": 50}]
}

// Steps 2–6 — same PO for each tool
{"purchase_order": "PUR-ORD-2026-00038"}

// Step 7 — sto_three_way_match
{
  "purchase_order": "PUR-ORD-2026-00038",
  "qty_tolerance_percent": 0,
  "price_tolerance_percent": 0
}

// Step 8 — sto_get_trace
{"purchase_order": "PUR-ORD-2026-00038"}

// Step 9 — sto_list
{"limit": 20, "include_stage": true}
```

### IC billing validated workflow

```json
// ic_list_accounts
{}

// ic_create_invoice_pair (validated SI/PI pair)
{
  "from_company": "Opulent Fresh EU",
  "to_company": "Opulent Fresh NA",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 10, "rate": 50}]
}

// ic_get_invoice_status
{"sales_invoice": "ACC-SINV-2026-00029"}

// ic_submit_invoice
{
  "sales_invoice": "ACC-SINV-2026-00029",
  "purchase_invoice": "ACC-PINV-2026-00029"
}
```

Re-run with screenshots:

```bash
bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_endpoints_with_screenshots.sh'
```

## Idempotency notes

| Tool | Behavior |
|------|----------|
| sto_approve_and_route | Returns existing SO if already linked |
| sto_post_goods_in_transit | Throws if DN already exists for PO lines |
| sto_create_ic_invoice | Throws if invoices already exist |

On retry after partial failure, call `sto_get_trace` first to see which documents exist.

## Observability pattern

Before advancing stage, agents should:

```
sto_get_trace → inspect stage + documents → call next sto_* tool → sto_get_trace confirm
```

## Three-way match tolerances

Default tolerances are 0% (strict match). For production AgroFresh-style MIRO:

```json
{
  "purchase_order": "PUR-ORD-2026-00038",
  "qty_tolerance_percent": 2.0,
  "price_tolerance_percent": 1.0
}
```

Dispute result includes `dispute_parties: ["Requestor", "Sender"]`.

## Partial workflows

### List open STOs at a stage

```
sto_list with include_stage: true
```

Filter client-side by `stage` field, or filter by `company` server-side.

### Trace from PO name only

```
sto_get_trace → read documents.* → open forms via get_document if needed
```

### Re-run match after dispute resolution

```
sto_three_way_match (with updated tolerances or fixed documents)
```

Desk equivalent: **Re-run Three-Way Match** button on STO Trace.

## Transport options

| Transport | Entry | Use case |
|-----------|-------|----------|
| Stdio | `erpnext-mcp-server/build/index.js` | Cursor local, MCP Inspector |
| HTTP | `vercel/` → `/api/mcp` | Remote agents, production demos |

Both expose the same 26 tools via `create-server.ts`. HTTP requires API token auth to ERPNext + optional `MCP_AUTH_TOKEN` Bearer header. See [docs/vercel-deployment-plan.md](../../../docs/vercel-deployment-plan.md).

## Integration test commands

```bash
# Mock MCP (no site)
cd erpnext-mcp-server && node tests/sto-tools.test.mjs
cd erpnext-mcp-server && node tests/ic-billing-tools.test.mjs

# Live API (requires site + keys or ERPNEXT_NO_AUTH=1)
source scripts/load_env.sh
python3 scripts/test_sto_api.py
python3 scripts/test_ic_billing_api.py
python3 scripts/test_all_mcp_endpoints.py

# All local checks
./scripts/verify_mcp_alignment.sh
./scripts/run_sto_tests.sh
```

## SAP → ERPNext → MCP mapping

| SAP step | ERPNext doc | MCP tool |
|----------|-------------|----------|
| Create & code STO | Internal PO | sto_create |
| DoA approve & post | Submit PO | sto_submit |
| Route to Sender | Intercompany SO | sto_approve_and_route |
| Goods in transit (643) | Delivery Note → GIT | sto_post_goods_in_transit |
| Auto IC invoice | SI + PI | sto_create_ic_invoice |
| Goods receipt | Intercompany PR | sto_post_goods_receipt |
| Trace chain | — | sto_get_trace |
| Three-way match | PO/PR/PI compare | sto_three_way_match |
| List STOs | — | sto_list |

## Alignment

When changing workflow steps or adding tools, update [mcp-db-alignment/references/tool-registry.md](../../mcp-db-alignment/references/tool-registry.md) and re-run `./scripts/verify_mcp_alignment.sh`.
