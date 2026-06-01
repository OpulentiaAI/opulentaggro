# STO MCP Tool Schemas

Source of truth: `erpnext-mcp-server/src/sto-tools.ts`

All tools return JSON text in MCP `content[0].text`. Errors set `isError: true`.

API prefix: `erpnext.intercompany.stock_transfer_order`

---

## sto_create

Create intercompany STO (internal Purchase Order). Maps to SAP MM STO creation by Requestor.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `company` | string | yes | — | Receiving company (Requestor entity) |
| `supplier` | string | yes | — | Internal supplier representing the sending company |
| `items` | array | yes | — | Line items (see below) |
| `transaction_date` | string | no | — | YYYY-MM-DD |
| `schedule_date` | string | no | — | YYYY-MM-DD |
| `submit` | boolean | no | `false` | Submit immediately after create |

**Item object** (required: `item_code`, `qty`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `item_code` | string | yes | Item code |
| `qty` | number | yes | Quantity |
| `rate` | number | no | Unit rate |
| `warehouse` | string | no | Receiving warehouse |
| `from_warehouse` | string | no | Sending warehouse |

```json
{
  "company": "Opulent Fresh NA",
  "supplier": "Internal Supplier Opulent Fresh EU",
  "items": [
    {
      "item_code": "STO-TEST-ITEM-001",
      "qty": 10,
      "rate": 50,
      "warehouse": "Stores - OFNA",
      "from_warehouse": "Stores - OFEU"
    }
  ],
  "transaction_date": "2026-05-31",
  "schedule_date": "2026-06-01",
  "submit": false
}
```

**Note:** `items` is JSON-stringified when sent to the API.

---

## sto_submit

Submit a draft STO after DoA approval (post the internal Purchase Order).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `purchase_order` | string | yes | — | Purchase Order / STO name |

```json
{"purchase_order": "PUR-ORD-2026-00038"}
```

---

## sto_approve_and_route

Approve and route STO to Sender: creates intercompany Sales Order from submitted PO.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `purchase_order` | string | yes | — | Purchase Order name |
| `delivery_date` | string | no | — | YYYY-MM-DD |
| `submit` | boolean | no | `true` | Submit Sales Order |

```json
{
  "purchase_order": "PUR-ORD-2026-00038",
  "delivery_date": "2026-06-05",
  "submit": true
}
```

---

## sto_post_goods_in_transit

Sender confirms delivery and posts goods in transit (SAP movement type 643 equivalent). Creates Delivery Note with in-transit warehouse.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `purchase_order` | string | yes | — | Purchase Order name |
| `in_transit_warehouse` | string | no | auto | GIT warehouse |
| `submit` | boolean | no | `true` | Submit Delivery Note |

```json
{
  "purchase_order": "PUR-ORD-2026-00038",
  "in_transit_warehouse": "GIT In Transit - OFEU",
  "submit": true
}
```

---

## sto_create_ic_invoice

Auto-create intercompany Sales Invoice and Purchase Invoice (IC AR/AP settlement).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `purchase_order` | string | yes | — | Purchase Order name |
| `submit` | boolean | no | `true` | Submit both invoices |

```json
{
  "purchase_order": "PUR-ORD-2026-00038",
  "submit": true
}
```

---

## sto_post_goods_receipt

Requestor posts goods receipt (intercompany Purchase Receipt from Delivery Note).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `purchase_order` | string | one of | — | STO Purchase Order |
| `delivery_note` | string | one of | — | Source Delivery Note (resolved from PO if omitted) |
| `submit` | boolean | no | `true` | Submit Purchase Receipt |

**Required:** `purchase_order` OR `delivery_note`

```json
{
  "purchase_order": "PUR-ORD-2026-00038",
  "delivery_note": "MAT-DN-2026-00001",
  "submit": true
}
```

---

## sto_get_trace

Trace full STO document chain: PO → SO → DN → PR → SI → PI with workflow stage and three-way match status.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `purchase_order` | string | yes | — | Purchase Order name |

```json
{"purchase_order": "PUR-ORD-2026-00038"}
```

Use for observability and debugging — preferred over `sto_list` when you need accurate stage.

---

## sto_three_way_match

Run three-way match among STO (PO), goods receipt (PR), and IC invoice (PI). Returns match/dispute with tolerance bands.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `purchase_order` | string | yes | — | Purchase Order name |
| `qty_tolerance_percent` | number | no | `0` | Allowed qty variance % |
| `price_tolerance_percent` | number | no | `0` | Allowed price variance % |

```json
{
  "purchase_order": "PUR-ORD-2026-00038",
  "qty_tolerance_percent": 0,
  "price_tolerance_percent": 0
}
```

Production: set non-zero tolerances for MIRO-style variance bands.

Response fields: `matched`, `comparison`, `route` (`ic_match_and_clear` | dispute path).

---

## sto_list

List intercompany stock transfer orders (internal Purchase Orders).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `company` | string | no | — | Filter by company |
| `status` | string | no | — | Filter by PO status |
| `limit` | number | no | `20` | Max results (max 100) |
| `include_stage` | boolean | no | `false` | Include workflow stage per row (quick stage, no three-way match) |

All parameters optional.

```json
{
  "company": "Opulent Fresh NA",
  "status": "To Receive and Bill",
  "limit": 20,
  "include_stage": false
}
```

`include_stage: true` adds quick stage per row (may show **Reconciliation Pending**).

---

## API method mapping

| MCP tool | Frappe method |
|----------|---------------|
| sto_create | erpnext.intercompany.stock_transfer_order.create_stock_transfer_order |
| sto_submit | erpnext.intercompany.stock_transfer_order.submit_stock_transfer_order |
| sto_approve_and_route | erpnext.intercompany.stock_transfer_order.approve_and_route_stock_transfer |
| sto_post_goods_in_transit | erpnext.intercompany.stock_transfer_order.post_goods_in_transit |
| sto_create_ic_invoice | erpnext.intercompany.stock_transfer_order.create_intercompany_invoice |
| sto_post_goods_receipt | erpnext.intercompany.stock_transfer_order.post_stock_transfer_receipt |
| sto_get_trace | erpnext.intercompany.stock_transfer_order.get_stock_transfer_trace |
| sto_three_way_match | erpnext.intercompany.stock_transfer_order.run_stock_transfer_three_way_match |
| sto_list | erpnext.intercompany.stock_transfer_order.list_stock_transfer_orders |
