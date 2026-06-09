# Generic ERPNext MCP tools (11)

Source: `erpnext-mcp-server/src/create-server.ts`

**41 total** = 16 `sto_*` + 14 `ic_*` + 11 generic.

Use for non-workflow CRUD and discovery. **Not** for STO create or IC pair create.

---

## Catalog

| Tool | Example args | UI verify |
|------|--------------|-----------|
| `get_doctypes` | `{}` | — |
| `get_doctype_fields` | `{"doctype": "Purchase Order"}` | — |
| `get_documents` | `{"doctype": "Customer", "limit": 3}` | `/app/customer` list |
| `get_document` | `{"doctype": "Customer", "name": "Internal Customer Opulent Fresh NA"}` | `/app/customer/{name}` |
| `create_document` | doctype + fields | respective form |
| `update_document` | doctype + name + fields | form |
| `submit_document` | doctype + name | docstatus change |
| `cancel_document` | doctype + name | — |
| `delete_document` | doctype + name | — |
| `call_method` | `{"method": "frappe.ping", "args": {}}` | — |
| `run_report` | report name + filters | — |

---

## get_document (harness)

Use a real Customer name — **not** `Administrator` on Vercel MCP (fix 2026-06-09).

```json
{"doctype": "Customer", "name": "Internal Customer Opulent Fresh NA"}
```

---

## get_documents

```json
{"doctype": "Customer", "limit": 3}
```

---

## call_method

```json
{"method": "frappe.ping", "args": {}}
```

---

## create_document

Avoid for internal Purchase Orders — use `sto_create`.

```json
{
  "doctype": "Customer",
  "data": {"customer_name": "Test Customer MCP", "customer_type": "Company"}
}
```
