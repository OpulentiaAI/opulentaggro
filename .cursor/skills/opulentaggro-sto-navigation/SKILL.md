---
name: opulentaggro-sto-navigation
description: Navigates the OpulentAggro ERPNext desk (Frappe) for intercompany Stock Transfer Orders — workspaces, STO Dashboard, STO Trace, standard list/form routes, and whitelisted STO API methods. Use when working in erpnext/, OpulentAggro, intercompany STO, desk UI, Frappe REST, purchase orders with internal suppliers, or choosing UI vs API vs MCP for STO data.
---

# OpulentAggro STO Navigation & Data

OpulentAggro is an ERPNext fork in `erpnext/` with Pierre-theme branding (`#009fff` accent). STO logic lives in `erpnext/erpnext/intercompany/stock_transfer_order.py`.

## Hosted stack (production)

| Interface | URL | Auth |
|-----------|-----|------|
| **Vercel desk** (recommended) | `https://vercel-indol-phi-69.vercel.app/app/*` | Session login (Administrator / `OpulentAggro-Demo-2026!`) |
| **Vercel MCP proxy** | `https://vercel-indol-phi-69.vercel.app/api/mcp` | Streamable HTTP, Accept SSE |
| **ERPNext desk (Railway)** | `https://erpnext-production-512a.up.railway.app/app/*` | Session login OR API token |
| **ERPNext REST** | `https://erpnext-production-512a.up.railway.app/api/method/...` | `Authorization: token <key>:<secret>` |
| **API key/secret** | from Railway logs: `railway logs --service erpnext --lines 200 \| grep api_key` | Current: `5b218748d06d007:b9a99536f8deac3` |

For agents and CI, the **Vercel MCP proxy** is the preferred single endpoint. It forwards to Railway ERPNext with the service API key already attached.

## When to use which interface

| Goal | Prefer |
|------|--------|
| Human review, DoA approval, visual trace | **Desk UI** (`/app/sto-dashboard`, `/app/sto-trace`) |
| Scripted integration, agents, CI tests | **MCP** — see [opulentaggro-sto-mcp](../opulentaggro-sto-mcp/SKILL.md) (41 tools) |
| Direct HTTP without MCP | **Frappe REST** + whitelisted methods (below) |
| Generic CRUD on any DocType | MCP generic tools (`get_document`, `get_documents`) — not for STO workflow steps |

**DoA is human-governed.** Agents must not call `sto_submit` / `submit_stock_transfer_order` until approval is confirmed.

## Desk navigation

Base URL: `http://localhost:8000` (site `sto.local` in dev). All desk routes start with `/app/`.

### STO-specific pages

| Page | Route | Purpose |
|------|-------|---------|
| Intercompany workspace | `/app/intercompany` | Sidebar shortcuts to STO pages and related DocTypes |
| STO Dashboard | `/app/sto-dashboard` | List internal POs as STOs; stage summary cards; **New STO** dialog |
| STO Trace | `/app/sto-trace?purchase_order=PO-XXXX` | Document chain, three-way match, DoA banner, BOL, clearing, dispute panels |
| IC Billing | `/app/intercompany/billing` | Invoice pair form, status/submit panel |
| Triangular Sales | `/app/intercompany/triangular` | Triangular sale MVP form + list |
| IC Reconciliation | `/app/reconciliation` | Pending clearing, disputes, cross-company summary |

Programmatic navigation (desk JS): `frappe.set_route("sto-trace", { purchase_order: "PO-00001" })`.

### Standard ERPNext routes

| Pattern | Example |
|---------|---------|
| DocType list | `/app/purchase-order` |
| DocType form | `/app/purchase-order/PO-00001` |
| Custom page | `/app/sto-dashboard` |
| Workspace | `/app/intercompany` |

Slug rule: DocType names become lowercase with hyphens (`Purchase Order` → `purchase-order`). Use `frappe.router.slug(doctype)` in code.

### Purchase Order list shortcuts

`erpnext/public/js/intercompany/purchase_order_sto_list.js` adds:

- Menu: **STO Dashboard** → `/app/sto-dashboard`
- Bulk action: **View STO Trace** (requires exactly one selected PO)

Internal PO filter in trace page: `is_internal_supplier: 1`.

## STO workflow stages

Ordered pipeline (see `STO_STAGES` in `stock_transfer_order.py`):

```
Draft → Pending Approval → Approved → Goods In Transit → IC Invoiced → Received → Three Way Matched → Completed
                                                                                      ↘ Dispute
```

| Stage | Meaning | Desk action (STO Trace) | API method |
|-------|---------|-------------------------|------------|
| Draft | Internal PO created, not submitted | Submit (DoA Approval) | `submit_stock_transfer_order` |
| Pending Approval | PO submitted, no SO yet | Approve & Route to Sender | `approve_and_route_stock_transfer` |
| Approved | SO linked | Post Goods In Transit | `post_goods_in_transit` |
| Goods In Transit | Delivery Note posted | Create IC Invoice | `create_intercompany_invoice` |
| IC Invoiced | SI + PI exist | Post Goods Receipt | `post_stock_transfer_receipt` |
| Received | PR posted | Run Three-Way Match | `run_stock_transfer_three_way_match` |
| Three Way Matched / Dispute | Match result | Re-run Three-Way Match (optional) | same |
| Completed | PO status Completed | — | — |

Stage badge colors are defined in `STO_STAGE_COLORS` (`sto_dashboard.js` / `sto_trace.js`).

## Data interfacing

### Whitelisted STO API (preferred for STO)

Module: `erpnext.intercompany.stock_transfer_order`

POST to `/api/method/erpnext.intercompany.stock_transfer_order.<method>` with token auth:

```
Authorization: token <api_key>:<api_secret>
```

| Method | Key args |
|--------|----------|
| `create_stock_transfer_order` | `company`, `supplier`, `items` (JSON array) |
| `submit_stock_transfer_order` | `purchase_order` |
| `approve_and_route_stock_transfer` | `purchase_order`, `delivery_date?`, `submit?` |
| `post_goods_in_transit` | `purchase_order`, `in_transit_warehouse?`, `submit?` |
| `create_intercompany_invoice` | `purchase_order`, `submit?` |
| `post_stock_transfer_receipt` | `purchase_order?`, `delivery_note?`, `submit?` |
| `get_stock_transfer_trace` | `purchase_order` |
| `run_stock_transfer_three_way_match` | `purchase_order`, `qty_tolerance_percent?`, `price_tolerance_percent?` |
| `list_stock_transfer_orders` | `company?`, `status?`, `limit?` (max 100), `include_stage?` |

Page-specific helpers (desk only, same auth):

- `erpnext.intercompany.page.sto_dashboard.sto_dashboard.get_sto_dashboard_data`
- `erpnext.intercompany.page.sto_trace.sto_trace.get_sto_trace_page_data`

Full parameter details: [references/api-methods.md](references/api-methods.md)

### Frappe REST patterns

```bash
# List internal POs
GET /api/resource/Purchase%20Order?filters=[["is_internal_supplier","=",1]]&fields=["name","company","status"]

# Get document
GET /api/resource/Purchase%20Order/PO-00001

# Generic whitelisted call
POST /api/method/erpnext.intercompany.stock_transfer_order.get_stock_transfer_trace
Content-Type: application/json
{"purchase_order": "PO-00001"}
```

List filters use JSON arrays: `[["field","operator",value]]`. Common operators: `=`, `!=`, `like`, `in`.

### List filters for STO discovery

- Internal POs: `{"is_internal_supplier": 1, "docstatus": ["!=", 2]}`
- By company: add `"company": "Opulent Fresh NA"`
- Prefer `list_stock_transfer_orders` over raw PO list — it caps at 100 and supports `include_stage`

## Prerequisites (master data)

Before creating STOs, verify on the site:

1. **Inter Company** enabled (Selling/Buying Settings)
2. **Internal Customer** on sending company (represents receiving company)
3. **Internal Supplier** on receiving company (`is_internal_supplier = 1`) — required; create will throw without it
4. Warehouses: sending, receiving, and **GIT** (goods-in-transit; auto-resolved if name contains `GIT`)
5. Shared **currency** across both companies
6. **Price list** with buying + selling (or internal transfer pricing configured)

Seed script for dev: `scripts/seed_sto_test_data.py` (companies **Opulent Fresh NA** / **Opulent Fresh EU**).

## Common pitfalls

| Error / symptom | Cause | Fix |
|-----------------|-------|-----|
| "Supplier X must be flagged as an internal supplier" | Supplier missing `is_internal_supplier` | Fix Supplier master or pick correct internal supplier |
| "Purchase Order X is not an internal supplier STO" | PO is not an internal transfer | Use internal supplier on create; filter `is_internal_supplier: 1` |
| "must be submitted before routing" | Skipped submit / DoA | Submit PO first; wait for human DoA |
| "No linked Sales Order found" | Skipped approve & route | Call `approve_and_route_stock_transfer` |
| Stage stuck at "Reconciliation Pending" on list | `include_stage=1` uses quick inference | Use `get_stock_transfer_trace` for full stage + match |
| Three-way match Dispute | Qty/price variance exceeds tolerance | Adjust tolerances or fix documents; re-run match |
| GIT warehouse wrong | No `%GIT%` warehouse on company | Create GIT warehouse or pass `in_transit_warehouse` explicitly |
| `AttributeError: module 'erpnext.accounts.utils' has no attribute 'pre_submit_validation'` | **Hosted only** — Docker overlay missing `accounts/utils.py` | Redeploy with `Dockerfile` overlay (already applied); see [docs/railway-backend-deployment.md](../../docs/railway-backend-deployment.md) |
| `pymysql.err.OperationalError: Access denied for user 'railway'` | **Hosted only** — `common_site_config.json` has stale `db_user=railway` | Set `FORCE_RECREATE_SITE=1` env var and redeploy |
| "Company currencies of both the companies should match" | `System Settings.currency != company.default_currency` | Set `System Settings.currency = USD` via `frappe.client.set_value` |
| `FiscalYearError: Date ... is not in any active Fiscal Year` | No active Fiscal Year for the company | Create Fiscal Year covering today's date via `frappe.client.insert` |
| `NegativeStockError: N units needed in Warehouse X` | Source warehouse has 0 stock | Add Material Receipt stock entry to that warehouse |
| "Customer not allowed to transact with Company" | Internal Customer's `companies` child table missing the counterparty | Set `companies` to all 3 companies via `frappe.client.set_value` |
| Frappe embed shows setup wizard | `System Settings.setup_complete = 0` | Set `setup_complete = 1` and `frappe.desk.page.setup_wizard.setup_wizard.setup_complete` |
| Vercel `/app/{doctype}` returns "Page erpnext not found" | Frappe embed URL has `/erpnext/app/*` prefix | `vercel/lib/frappe-desk-proxy.ts` `strip_prefix` patch (deployed) |

## Source files (for agents editing code)

| Area | Path |
|------|------|
| STO API | `erpnext/erpnext/intercompany/stock_transfer_order.py` |
| Dashboard page | `erpnext/erpnext/intercompany/page/sto_dashboard/` |
| Trace page | `erpnext/erpnext/intercompany/page/sto_trace/` |
| PO list JS | `erpnext/erpnext/public/js/intercompany/purchase_order_sto_list.js` |
| Workspace | `erpnext/erpnext/intercompany/workspace/intercompany/` |
| Branding / theme | `erpnext/erpnext/hooks.py`, `opulentaggro-pierre.bundle.scss` |

## Additional resources

- Vercel frontend routes and deploy: [opulentaggro-vercel](../opulentaggro-vercel/SKILL.md)
- API method signatures and responses: [references/api-methods.md](references/api-methods.md)
- Desk URL patterns and query params: [references/desk-routes.md](references/desk-routes.md)
- MCP automation: [opulentaggro-sto-mcp](../opulentaggro-sto-mcp/SKILL.md)
- MCP + UI E2E: [opulentaggro-mcp-ui-e2e](../opulentaggro-mcp-ui-e2e/SKILL.md)
- Setup docs: `docs/erpnext-sto-mcp-setup.md`, `docs/erpnext-sto-test-setup.md`
