# STO Whitelisted API Reference

Module path: `erpnext.intercompany.stock_transfer_order`

HTTP: `POST /api/method/erpnext.intercompany.stock_transfer_order.<method_name>`

Auth header: `Authorization: token <ERPNEXT_API_KEY>:<ERPNEXT_API_SECRET>`

---

## create_stock_transfer_order

Creates an internal Purchase Order (STO).

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `company` | string | yes | Receiving company (requestor) |
| `supplier` | string | yes | Must have `is_internal_supplier = 1` |
| `items` | JSON array or string | yes | `[{item_code, qty, rate?, warehouse?, from_warehouse?, schedule_date?}]` |
| `transaction_date` | YYYY-MM-DD | no | Defaults to today |
| `schedule_date` | YYYY-MM-DD | no | Defaults to tomorrow |
| `from_warehouse` | string | no | Default sending warehouse for all lines |
| `warehouse` | string | no | Default receiving warehouse for all lines |
| `submit` | 0/1 | no | Submit immediately (default 0) |

Returns: `{purchase_order, docstatus, stage, status}`

---

## submit_stock_transfer_order

Submit draft PO after DoA approval.

| Parameter | Required |
|-----------|----------|
| `purchase_order` | yes |

Requires `docstatus = 0`. Returns updated stage (typically **Pending Approval**).

---

## approve_and_route_stock_transfer

Creates intercompany Sales Order from submitted PO.

| Parameter | Required | Notes |
|-----------|----------|-------|
| `purchase_order` | yes | |
| `delivery_date` | no | Applied to SO line items |
| `submit` | no | Default 1 (submit SO) |

Requires `docstatus = 1`. Idempotent if SO already linked.

Returns: `{purchase_order, sales_order, sales_order_docstatus, stage}`

---

## post_goods_in_transit

Creates Delivery Note from SO; posts to GIT warehouse (SAP 643 equivalent).

| Parameter | Required | Notes |
|-----------|----------|-------|
| `purchase_order` | yes | |
| `in_transit_warehouse` | no | Auto-resolves warehouse with `%GIT%` in name |
| `submit` | no | Default 1 |

Requires linked Sales Order.

Returns: `{purchase_order, delivery_note, stage, ...}`

---

## create_intercompany_invoice

Auto-creates Sales Invoice (sender) and Purchase Invoice (receiver).

| Parameter | Required | Notes |
|-----------|----------|-------|
| `purchase_order` | yes | |
| `submit` | no | Default 1 |

Returns: `{purchase_order, sales_invoice, purchase_invoice, stage, ...}`

---

## post_stock_transfer_receipt

Creates intercompany Purchase Receipt from Delivery Note.

| Parameter | Required | Notes |
|-----------|----------|-------|
| `purchase_order` | one of PO/DN | |
| `delivery_note` | one of PO/DN | Resolved from PO if omitted |
| `submit` | no | Default 1 |

Returns: `{purchase_order, purchase_receipt, stage, ...}`

---

## get_stock_transfer_trace

Full document chain + inferred stage + three-way match (when docs exist).

| Parameter | Required |
|-----------|----------|
| `purchase_order` | yes |

Returns:

```json
{
  "purchase_order": "PO-00001",
  "stage": "Goods In Transit",
  "documents": {
    "purchase_order": {...},
    "sales_order": {...},
    "delivery_notes": [...],
    "purchase_receipts": [...],
    "sales_invoices": [...],
    "purchase_invoices": [...]
  },
  "three_way_match": null
}
```

---

## run_stock_transfer_three_way_match

Compares PO qty/amount vs PR qty vs PI amount.

| Parameter | Default | Notes |
|-----------|---------|-------|
| `purchase_order` | — | required |
| `qty_tolerance_percent` | 0 | Allowed qty variance % |
| `price_tolerance_percent` | 0 | Allowed price variance % |
| `return_only` | 0 | Internal; skip side effects |

Returns: `{matched, comparison: {po_qty, pr_qty, qty_variance_percent, po_amount, pi_amount, price_variance_percent}, route}`

`route`: `ic_match_and_clear` if matched, else `dispute`.

---

## list_stock_transfer_orders

| Parameter | Default | Notes |
|-----------|---------|-------|
| `company` | — | Filter by receiving company |
| `status` | — | PO status field |
| `limit` | 20 | Max 100 |
| `include_stage` | 0 | Quick stage inference per row |

Filters: `is_internal_supplier = 1`, `docstatus != 2`.

When `include_stage=1`, stage may show **Reconciliation Pending** instead of running full match — use trace for accuracy.
