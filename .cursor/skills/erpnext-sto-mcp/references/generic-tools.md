# Generic ERPNext MCP Tools

Source of truth: `erpnext-mcp-server/src/create-server.ts` (registered in `ListToolsRequestSchema` handler)

**11 generic tools** plus 9 `sto_*` and 6 `ic_*` = **26 total MCP tools**.

Use these for non-STO ERPNext operations. Auth: API token (`ERPNEXT_API_KEY` + `ERPNEXT_API_SECRET`) or localhost dev session (`ERPNEXT_NO_AUTH=1` / `MCP_NO_AUTH=1`).

---

## get_doctypes

Get a list of all available DocTypes.

| Parameter | Type | Required |
|-----------|------|----------|
| _(none)_ | — | — |

```json
{}
```

---

## get_doctype_fields

Get fields list for a specific DocType (samples first document to infer field names).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doctype` | string | yes | ERPNext DocType (e.g., Customer, Item) |

```json
{"doctype": "Purchase Order"}
```

---

## get_documents

Get a list of documents for a specific doctype.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `doctype` | string | yes | — | ERPNext DocType |
| `fields` | string[] | no | — | Fields to include |
| `filters` | object | no | — | Filters as `{field: value}` |
| `limit` | number | no | — | Maximum documents to return |

```json
{
  "doctype": "Purchase Order",
  "fields": ["name", "company", "status"],
  "filters": {"is_internal_supplier": 1},
  "limit": 20
}
```

---

## get_document

Get a single document by DocType and name, including all child tables and linked data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doctype` | string | yes | ERPNext DocType |
| `name` | string | yes | Document name/ID |

```json
{"doctype": "Purchase Order", "name": "PUR-ORD-2026-00038"}
```

---

## create_document

Create a new document in ERPNext.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `doctype` | string | yes | — | ERPNext DocType |
| `data` | object | yes | — | Document data |
| `verbose` | boolean | no | `false` | Return full document if true |

```json
{
  "doctype": "Customer",
  "data": {"customer_name": "Test Co", "customer_type": "Company"},
  "verbose": false
}
```

Default response: `{status, doctype, name, docstatus}`. **Do not use for STO** — use `sto_create`.

---

## update_document

Update an existing document in ERPNext.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `doctype` | string | yes | — | ERPNext DocType |
| `name` | string | yes | — | Document name/ID |
| `data` | object | yes | — | Fields to update |
| `verbose` | boolean | no | `false` | Return full document if true |

```json
{
  "doctype": "Customer",
  "name": "Test Co",
  "data": {"customer_group": "Commercial"},
  "verbose": false
}
```

---

## submit_document

Submit a document (set docstatus to 1). Loads full doc then calls `frappe.client.submit`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `doctype` | string | yes | — | ERPNext DocType |
| `name` | string | yes | — | Document name/ID |
| `verbose` | boolean | no | `false` | Return full document if true |

```json
{"doctype": "Sales Invoice", "name": "ACC-SINV-2026-00029", "verbose": false}
```

---

## cancel_document

Cancel a submitted document (set docstatus to 2). Calls `frappe.client.cancel`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `doctype` | string | yes | — | ERPNext DocType |
| `name` | string | yes | — | Document name/ID |
| `verbose` | boolean | no | `false` | Return full document if true |

```json
{"doctype": "Sales Invoice", "name": "ACC-SINV-2026-00029", "verbose": false}
```

---

## delete_document

Permanently delete a document from ERPNext.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doctype` | string | yes | ERPNext DocType |
| `name` | string | yes | Document name/ID |

```json
{"doctype": "Customer", "name": "Test Co"}
```

Returns `{status: "success", action: "deleted", doctype, name}`.

---

## call_method

Call an ERPNext/Frappe whitelisted server-side API method. Escape hatch — prefer typed `sto_*` / `ic_*` tools.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `method` | string | yes | — | Dotted method path |
| `args` | object | no | — | Method arguments |
| `http_method` | `"GET"` \| `"POST"` | no | `"POST"` | HTTP method |

```json
{
  "method": "erpnext.intercompany.stock_transfer_order.get_stock_transfer_trace",
  "args": {"purchase_order": "PUR-ORD-2026-00038"},
  "http_method": "POST"
}
```

---

## run_report

Run an ERPNext report via `frappe.desk.query_report.run`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `report_name` | string | yes | Name of the report |
| `filters` | object | no | Report filters |

```json
{
  "report_name": "Stock Balance",
  "filters": {"company": "Opulent Fresh NA"}
}
```

---

## MCP resources

| URI | Content |
|-----|---------|
| `erpnext://DocTypes` | All DocType names |
| `erpnext://Purchase Order/PUR-ORD-2026-00038` | Document JSON |

Read via MCP `ReadResource` (when client supports resources).

Resource templates: `erpnext://{doctype}/{name}`
