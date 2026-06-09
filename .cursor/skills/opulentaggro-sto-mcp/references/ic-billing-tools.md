# IC billing MCP tools (`ic_*` × 6)

Source: `erpnext-mcp-server/src/ic-billing-tools.ts` → `erpnext.intercompany.intercompany_billing`

Standalone AR/AP invoicing across company pairs (not tied to STO chain).

---

## Catalog

| Tool | Prerequisite | Expected keys | UI verify |
|------|--------------|---------------|-----------|
| `ic_list_accounts` | Internal Customer/Supplier per pair | `accounts[]` | `/app/intercompany/billing` pairs table |
| `ic_create_sales_invoice` | Pair configured | `sales_invoice` | `/app/sales-invoice` list |
| `ic_create_purchase_invoice` | Pair configured | `purchase_invoice` | `/app/purchase-invoice` list |
| `ic_create_invoice_pair` | Both AR/AP links | `sales_invoice`, `purchase_invoice` | Billing `IcBillingForm` |
| `ic_submit_invoice` | Draft SI and/or PI | `submitted[]` | `IcInvoiceStatusPanel` |
| `ic_get_invoice_status` | SI or PI name | `status`, `linked_*` | Billing status panel |

---

## Shared: company pair

- **`from_company`** — seller (AR / Sales Invoice company)
- **`to_company`** — buyer (AP / Purchase Invoice company)

Harness: `from_company: Opulent Fresh APAC`, `to_company: Opulent Fresh NA`.

---

## ic_list_accounts

```json
{}
```

```json
{"company": "Opulent Fresh NA"}
```

---

## ic_create_sales_invoice

```json
{
  "from_company": "Opulent Fresh APAC",
  "to_company": "Opulent Fresh NA",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 1, "rate": 50}],
  "submit": false
}
```

---

## ic_create_purchase_invoice

```json
{
  "from_company": "Opulent Fresh APAC",
  "to_company": "Opulent Fresh NA",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 1, "rate": 50}],
  "submit": false
}
```

---

## ic_create_invoice_pair

Bidirectional SI↔PI link applied in `intercompany_billing.py` (fix 2026-06-09). Harness creates pair then submits both before `ic_match_and_clear`.

```json
{
  "from_company": "Opulent Fresh APAC",
  "to_company": "Opulent Fresh NA",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 1, "rate": 50}],
  "submit": false
}
```

Validated: `ACC-SINV-2026-00061` / `ACC-PINV-2026-00060` (local 2026-06-09).

---

## ic_submit_invoice

```json
{
  "sales_invoice": "ACC-SINV-2026-00061",
  "purchase_invoice": "ACC-PINV-2026-00060"
}
```

---

## ic_get_invoice_status

```json
{
  "sales_invoice": "ACC-SINV-2026-00061",
  "purchase_invoice": "ACC-PINV-2026-00060"
}
```

---

## vs STO invoicing

| Use case | Tool |
|----------|------|
| Invoice from STO DN chain | `sto_create_ic_invoice` |
| Standalone IC billing | `ic_create_invoice_pair` |
| All configured pairs | `ic_list_accounts` |
