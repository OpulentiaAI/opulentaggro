# Intercompany billing MCP tools (`ic_*`)

Source of truth: `erpnext-mcp-server/src/ic-billing-tools.ts`

Maps standalone AR/AP intercompany invoicing for **multiple company pairs** to `erpnext.intercompany.intercompany_billing`.

All tools return JSON text in MCP `content[0].text`. Errors set `isError: true`.

---

## Tool reference

| MCP tool | API method | Purpose |
|----------|------------|---------|
| `ic_list_accounts` | `list_intercompany_accounts` | List configured company pairs with internal Customer/Supplier links |
| `ic_create_sales_invoice` | `create_intercompany_sales_invoice` | AR — Sales Invoice on seller (`from_company`) |
| `ic_create_purchase_invoice` | `create_intercompany_purchase_invoice` | AP — Purchase Invoice on buyer (`to_company`) |
| `ic_create_invoice_pair` | `create_intercompany_invoice_pair` | Linked SI + PI (recommended) |
| `ic_submit_invoice` | `submit_intercompany_invoice` | Submit draft SI and/or PI |
| `ic_get_invoice_status` | `get_intercompany_invoice_status` | Trace AR/AP posting and linkage |

---

## Shared: company pair

All create tools use:

- **`from_company`** — selling company (AR / Sales Invoice company)
- **`to_company`** — buying company (AP / Purchase Invoice company)

The API resolves:

- Internal **Customer** on `from_company` with `represents_company = to_company`
- Internal **Supplier** on `to_company` with `represents_company = from_company`

Optional overrides: `customer`, `supplier`.

---

## Shared: items array

Required on all create tools. Each item requires `item_code` and `qty`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `item_code` | string | yes | Item code |
| `qty` | number | yes | Quantity |
| `rate` | number | no | Unit rate |
| `description` | string | no | Line description |
| `warehouse` | string | no | Warehouse |

```json
[
  { "item_code": "STO-TEST-ITEM-001", "qty": 10, "rate": 100, "warehouse": "Stores - OFNA" }
]
```

**Note:** `items` is JSON-stringified when sent to the API.

---

## ic_list_accounts

List configured intercompany company pairs with internal Customer (AR) and Supplier (AP) master data links.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `company` | string | no | — | Filter pairs involving this company |

```json
{}
```

```json
{"company": "Opulent Fresh NA"}
```

---

## ic_create_sales_invoice

Create intercompany Sales Invoice on the selling company (`from_company`) — posts to Accounts Receivable (AR).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `from_company` | string | yes | — | Selling company (AR side) |
| `to_company` | string | yes | — | Buying company |
| `items` | array | yes | — | Invoice line items |
| `posting_date` | string | no | — | YYYY-MM-DD |
| `customer` | string | no | auto | Override internal customer |
| `submit` | boolean | no | `false` | Submit after create |

```json
{
  "from_company": "Opulent Fresh EU",
  "to_company": "Opulent Fresh NA",
  "items": [{ "item_code": "STO-TEST-ITEM-001", "qty": 10, "rate": 50 }],
  "posting_date": "2026-05-31",
  "submit": false
}
```

---

## ic_create_purchase_invoice

Create intercompany Purchase Invoice on the buying company (`to_company`) — posts to Accounts Payable (AP).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `from_company` | string | yes | — | Selling company |
| `to_company` | string | yes | — | Buying company (AP side) |
| `items` | array | yes | — | Invoice line items |
| `posting_date` | string | no | — | YYYY-MM-DD |
| `supplier` | string | no | auto | Override internal supplier |
| `submit` | boolean | no | `false` | Submit after create |

```json
{
  "from_company": "Opulent Fresh EU",
  "to_company": "Opulent Fresh NA",
  "items": [{ "item_code": "STO-TEST-ITEM-001", "qty": 10, "rate": 50 }]
}
```

---

## ic_create_invoice_pair

Create linked Sales Invoice (AR on seller) and Purchase Invoice (AP on buyer) for a company pair.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `from_company` | string | yes | — | Selling company |
| `to_company` | string | yes | — | Buying company |
| `items` | array | yes | — | Invoice line items |
| `posting_date` | string | no | — | YYYY-MM-DD |
| `customer` | string | no | auto | Override internal customer |
| `supplier` | string | no | auto | Override internal supplier |
| `submit` | boolean | no | `true` | Submit both invoices |

```json
{
  "from_company": "Opulent Fresh EU",
  "to_company": "Opulent Fresh NA",
  "items": [{ "item_code": "STO-TEST-ITEM-001", "qty": 10, "rate": 50 }]
}
```

Validated (2026-05-31): `ACC-SINV-2026-00029`, `ACC-PINV-2026-00029`.

---

## ic_submit_invoice

Submit one or both intercompany Sales Invoice and/or Purchase Invoice.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sales_invoice` | string | one of | — | Sales Invoice name |
| `purchase_invoice` | string | one of | — | Purchase Invoice name |

**Required:** `sales_invoice` AND/OR `purchase_invoice`

```json
{
  "sales_invoice": "ACC-SINV-2026-00029",
  "purchase_invoice": "ACC-PINV-2026-00029"
}
```

---

## ic_get_invoice_status

Trace AR/AP posting status for intercompany invoice(s). Resolves linked SI/PI from `inter_company_invoice_reference`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sales_invoice` | string | one of | — | Sales Invoice name |
| `purchase_invoice` | string | one of | — | Purchase Invoice name |

**Required:** `sales_invoice` AND/OR `purchase_invoice`

```json
{"sales_invoice": "ACC-SINV-2026-00029"}
```

---

## Example: multi-pair workflow

```json
// 1. Discover configured pairs
{}

// 2. EU → NA linked invoice (AR + AP)
{
  "from_company": "Opulent Fresh EU",
  "to_company": "Opulent Fresh NA",
  "items": [{ "item_code": "STO-TEST-ITEM-001", "qty": 10, "rate": 50 }]
}

// 3. EU → APAC (requires separate master data — see prerequisites)
{
  "from_company": "Opulent Fresh EU",
  "to_company": "Opulent Fresh APAC",
  "items": [{ "item_code": "STO-TEST-ITEM-001", "qty": 5, "rate": 75 }]
}

// 4. Status trace
{ "sales_invoice": "ACC-SINV-2026-00029" }

// 5. Submit drafts
{ "sales_invoice": "ACC-SINV-2026-00002", "purchase_invoice": "ACC-PINV-2026-00001" }
```

---

## vs STO invoicing

| Use case | Tool |
|----------|------|
| Invoice tied to STO (PO → SO chain) | `sto_create_ic_invoice` |
| Standalone intercompany billing | `ic_create_invoice_pair` or `ic_create_sales_invoice` / `ic_create_purchase_invoice` |
| List STO-specific IC pairs from PO context | `sto_get_trace` |
| List all configured IC account pairs | `ic_list_accounts` |

---

## Master data prerequisites (per pair)

For each direction **Seller → Buyer**:

1. **Internal Customer** on seller: `represents_company = buyer`, Allowed To Transact With = seller
2. **Internal Supplier** on buyer: `represents_company = seller`, Allowed To Transact With = buyer
3. Inter Company invoicing enabled in Selling/Buying Settings
4. Shared currency across companies
5. Items with valid price list rates

Seed helper: `scripts/seed_sto_test_data.py` → `_ensure_company_pair(seller, buyer)`.

Live test: `python3 scripts/test_ic_billing_api.py`

Mock test: `node tests/ic-billing-tools.test.mjs`
