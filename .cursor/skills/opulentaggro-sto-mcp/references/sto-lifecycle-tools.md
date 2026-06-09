# STO lifecycle MCP tools (`sto_*` × 16)

Source: `erpnext-mcp-server/src/sto-tools.ts` → `erpnext.intercompany.stock_transfer_order`

All tools return JSON in `content[0].text`. Errors: `isError: true`.

**Test harness:** `scripts/test_all_41_mcp_tools.py` uses `qty: 101`, company **Opulent Fresh NA**, supplier **Internal Supplier Opulent Fresh APAC**, item **STO-TEST-ITEM-001**.

---

## Catalog

| Tool | Prerequisite | Expected response keys | UI verify |
|------|--------------|------------------------|-----------|
| `sto_create` | Internal supplier, item, FY, stock | `purchase_order`, `stage` | `/app/sto-dashboard` — new PO row |
| `sto_request_approval` | Draft PO | `purchase_order`, `approval_status` | `/app/sto-trace` — DoA banner |
| `sto_approve` | Approval requested | `purchase_order`, `docstatus` | Trace — approved state |
| `sto_reject` | Approval requested | `purchase_order`, `rejected` | Trace — rejected badge |
| `sto_submit` | Approved or draft (idempotent) | `purchase_order`, `docstatus` | PO form docstatus Submitted |
| `sto_approve_and_route` | Submitted PO | `purchase_order`, `sales_order` | Trace — SO linked |
| `sto_post_goods_in_transit` | Approved + sender stock | `delivery_note`, `purchase_order` | `/app/delivery-note` or trace GIT panel |
| `sto_create_ic_invoice` | DN posted | `sales_invoice`, `purchase_invoice` | Trace IC invoice panel; `ACC-SINV-*`, `ACC-PINV-*` |
| `sto_post_goods_receipt` | DN + PO | `purchase_receipt`, `purchase_order` | `/app/purchase-receipt` list |
| `sto_get_trace` | PO name | `purchase_order`, `stage`, `documents` | `/app/sto-trace?purchase_order={PO}` |
| `sto_three_way_match` | PO+PR+PI chain | `matched`, `comparison`, `route` | Trace match panel |
| `sto_list` | — | `stock_transfer_orders[]` | `/app/sto-dashboard` stage cards |
| `sto_generate_booking_advice` | DN posted | `booking_advice`, `delivery_note` | Trace BOL panel + download |
| `sto_open_dispute` | PO exists | `purchase_order`, `dispute` | Trace dispute panel |
| `sto_resolve_dispute` | Open dispute | `purchase_order`, `resolved` | Trace — dispute cleared |
| `sto_list_disputes` | — | `disputes[]` | `/app/reconciliation` disputes section |

---

## sto_create

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `company` | string | yes | Receiving company |
| `supplier` | string | yes | Internal supplier (sending entity) |
| `items` | array | yes | `{item_code, qty, rate?, warehouse?, from_warehouse?}` |
| `transaction_date` | string | no | YYYY-MM-DD |
| `schedule_date` | string | no | YYYY-MM-DD |
| `submit` | boolean | no | Default `false` |

```json
{
  "company": "Opulent Fresh NA",
  "supplier": "Internal Supplier Opulent Fresh APAC",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 101, "rate": 100}],
  "submit": false
}
```

---

## sto_request_approval / sto_approve / sto_reject

```json
{"purchase_order": "PUR-ORD-2026-00070"}
```

```json
{"purchase_order": "PUR-ORD-2026-00071", "reason": "MCP E2E test rejection"}
```

`sto_approve` submits PO after DoA. Harness calls request → approve → submit.

---

## sto_submit

Idempotent when PO already submitted (`docstatus=1`).

```json
{"purchase_order": "PUR-ORD-2026-00070"}
```

---

## sto_approve_and_route

```json
{"purchase_order": "PUR-ORD-2026-00070", "submit": true}
```

---

## sto_post_goods_in_transit

**Prerequisite:** Stock ≥ qty in sender warehouse (APAC/EU/NA Stores ≥150).

```json
{"purchase_order": "PUR-ORD-2026-00070", "submit": true}
```

---

## sto_create_ic_invoice

```json
{"purchase_order": "PUR-ORD-2026-00070", "submit": true}
```

Expected: `ACC-SINV-2026-*`, `ACC-PINV-2026-*`.

---

## sto_post_goods_receipt

```json
{"purchase_order": "PUR-ORD-2026-00070", "submit": true}
```

---

## sto_get_trace

```json
{"purchase_order": "PUR-ORD-2026-00070"}
```

Response includes `stage`, linked `sales_order`, `delivery_note`, `purchase_receipt`, `sales_invoice`, `purchase_invoice`.

---

## sto_three_way_match

```json
{
  "purchase_order": "PUR-ORD-2026-00070",
  "qty_tolerance_percent": 0,
  "price_tolerance_percent": 0
}
```

---

## sto_list

```json
{"limit": 20, "include_stage": true}
```

---

## sto_generate_booking_advice

```json
{"purchase_order": "PUR-ORD-2026-00070"}
```

---

## sto_open_dispute / sto_resolve_dispute

```json
{"purchase_order": "PUR-ORD-2026-00070", "reason": "MCP E2E tolerance test"}
```

```json
{"purchase_order": "PUR-ORD-2026-00070", "resolution": "Resolved in MCP E2E test"}
```

---

## sto_list_disputes

```json
{"limit": 5}
```
