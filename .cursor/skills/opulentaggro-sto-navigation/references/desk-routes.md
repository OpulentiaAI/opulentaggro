# OpulentAggro Desk URL Patterns

## Route types

| Type | URL pattern | Example |
|------|-------------|---------|
| Workspace | `/app/{workspace-slug}` | `/app/intercompany` |
| Custom page | `/app/{page-name}` | `/app/sto-dashboard` |
| DocType list | `/app/{doctype-slug}` | `/app/purchase-order` |
| DocType form | `/app/{doctype-slug}/{docname}` | `/app/purchase-order/PO-00001` |
| Query report | `/app/query-report/{report}` | `/app/query-report/Stock Balance` |

## STO routes with query params

```
/app/sto-trace?purchase_order=PO-00001
```

Desk also accepts route options: `frappe.set_route("sto-trace", { purchase_order: "PO-00001" })`.

## Common DocType slugs

| DocType | Slug |
|---------|------|
| Purchase Order | `purchase-order` |
| Sales Order | `sales-order` |
| Delivery Note | `delivery-note` |
| Purchase Receipt | `purchase-receipt` |
| Sales Invoice | `sales-invoice` |
| Purchase Invoice | `purchase-invoice` |
| Item | `item` |
| Supplier | `supplier` |
| Company | `company` |
| Warehouse | `warehouse` |

## Intercompany workspace sidebar

Defined in `erpnext/workspace_sidebar/intercompany.json`:

- Home → Intercompany workspace
- STO Dashboard → `sto-dashboard`
- STO Trace → `sto-trace`
- Purchase Order, Delivery Note, Purchase Receipt lists

## Boot metadata

`bootinfo.opulentaggro` (from `erpnext/intercompany/boot.py`) exposes brand keys for desk JS. App title in picker: **OpulentAggro**.

## Local dev URLs

| Resource | URL |
|----------|-----|
| Desk | `http://localhost:8000/app` |
| API base | `http://localhost:8000/api` |
| Optional host alias | `http://sto.local:8000` (requires `/etc/hosts`) |
