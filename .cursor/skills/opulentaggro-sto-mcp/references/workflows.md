# STO + IC MCP workflows

Validated local 2026-06-09: **33/33** tools on direct REST + Vercel MCP. See [docs/local-mcp-ui-validation-report.md](../../../docs/local-mcp-ui-validation-report.md).

## Full STO chain (harness order)

| Step | Tool | MCP args | UI page |
|------|------|----------|---------|
| 1 | `sto_create` | qty **101**, NA ← APAC | `/app/sto-dashboard` |
| 2 | `sto_request_approval` | `{purchase_order}` | `/app/sto-trace` DoA |
| 3 | `sto_approve` | `{purchase_order}` | trace banner |
| 4 | `sto_submit` | `{purchase_order}` | PO submitted |
| 5 | `sto_approve_and_route` | `{purchase_order, submit: true}` | SO linked |
| 6 | `sto_post_goods_in_transit` | `{purchase_order, submit: true}` | DN / GIT |
| 7 | `sto_create_ic_invoice` | `{purchase_order, submit: true}` | SI+PI |
| 8 | `sto_post_goods_receipt` | `{purchase_order, submit: true}` | PR |
| 9 | `sto_get_trace` | `{purchase_order}` | full trace |
| 10 | `sto_three_way_match` | `{purchase_order}` | match panel |
| 11 | `sto_generate_booking_advice` | `{purchase_order}` | BOL panel |
| 12 | `sto_open_dispute` / `sto_resolve_dispute` | reason + resolution | dispute panel |
| 13 | `sto_list` | `{limit: 5}` | dashboard |

**Human gate:** DoA before submit in production; harness uses `sto_approve` for automation.

## IC billing + treasury chain

```json
// ic_list_accounts
{}

// ic_create_invoice_pair (then ic_submit_invoice both)
{
  "from_company": "Opulent Fresh APAC",
  "to_company": "Opulent Fresh NA",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 1, "rate": 50}],
  "submit": false
}

// ic_get_invoice_status + ic_submit_invoice
{"sales_invoice": "ACC-SINV-2026-00061", "purchase_invoice": "ACC-PINV-2026-00060"}

// ic_match_and_clear (after submit)
{"sales_invoice": "ACC-SINV-2026-00061", "purchase_invoice": "ACC-PINV-2026-00060"}
```

## Triangular + accrual

```json
// ic_triangular_sale
{
  "selling_company": "Opulent Fresh APAC",
  "billing_company": "Opulent Fresh NA",
  "customer": "Internal Customer Opulent Fresh NA",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 1, "rate": 50}],
  "submit": false
}

// ic_create_accrual
{
  "company": "Opulent Fresh APAC",
  "counterparty_company": "Opulent Fresh NA",
  "amount": 10.0,
  "debit_account": "Debtors - OFAP",
  "credit_account": "Creditors - OFAP",
  "submit": true,
  "remarks": "MCP E2E accrual test"
}
```

## Stock prereq (before GIT at qty=101)

```bash
python3 scripts/ensure_hosted_prereqs.py   # or API: erpnext.intercompany.ensure_hosted_prereqs.run
```

Seeds APAC/EU/NA Stores ≥150 units.
