# IC extended MCP tools (`ic_*` × 8)

Source: `erpnext-mcp-server/src/ic-extended-tools.ts`

Modules: `intercompany_treasury`, `intercompany_triangular`, `intercompany_accrual`

Harness env: `IC_TEST_FROM_COMPANY=Opulent Fresh APAC`, `IC_TEST_TO_COMPANY=Opulent Fresh NA`

---

## Treasury / clearing (4)

| Tool | Prerequisite | UI verify |
|------|--------------|-----------|
| `ic_match_and_clear` | Submitted linked SI+PI | `/app/reconciliation`, trace clearing panel |
| `ic_get_clearing_status` | SI or PI name | Reconciliation outstanding table |
| `ic_list_pending_clearing` | — | `/app/reconciliation` pending list |
| `ic_get_reconciliation_summary` | — | `/app/reconciliation` dashboard cards |

### ic_match_and_clear

Requires bidirectional SI↔PI link (`inter_company_invoice_reference` both ways). Harness submits both invoices before calling.

```json
{
  "sales_invoice": "ACC-SINV-2026-00061",
  "purchase_invoice": "ACC-PINV-2026-00060"
}
```

**Expected:** Payment Entry names or `cleared: true`. Non-fatal if already cleared.

### ic_get_clearing_status

```json
{
  "sales_invoice": "ACC-SINV-2026-00061",
  "purchase_invoice": "ACC-PINV-2026-00060"
}
```

### ic_list_pending_clearing

```json
{"limit": 5}
```

### ic_get_reconciliation_summary

```json
{}
```

---

## Triangular sales (2)

| Tool | Prerequisite | UI verify |
|------|--------------|-----------|
| `ic_triangular_sale` | Customer, IC pair, sender warehouse | `/app/intercompany/triangular` |
| `ic_list_triangular_sales` | — | Same page list embed |

### ic_triangular_sale

Default `warehouse` on SO lines from sender company Stores (fix 2026-06-09).

```json
{
  "selling_company": "Opulent Fresh APAC",
  "billing_company": "Opulent Fresh NA",
  "customer": "Internal Customer Opulent Fresh NA",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 1, "rate": 50}],
  "submit": false
}
```

**Expected:** `sales_order` e.g. `SAL-ORD-2026-00034`

### ic_list_triangular_sales

```json
{"limit": 5}
```

---

## Accrual allocations (2)

| Tool | Prerequisite | UI verify |
|------|--------------|-----------|
| `ic_create_accrual` | Valid debit/credit accounts, party on AR/AP lines | `/app/reconciliation` accrual list |
| `ic_list_accruals` | — | Same |

### ic_create_accrual

Auto `party_type`/`party` on Receivable/Payable JE lines (fix 2026-06-09).

```json
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

**Expected:** `journal_entry` e.g. `ACC-JV-2026-00003`

### ic_list_accruals

```json
{"limit": 5}
```
