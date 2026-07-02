# Intercompany STO — ERPNext + MCP Setup

## Repos (cloned in this workspace)

| Repo | Path |
|------|------|
| OpulentAggro (ERPNext fork) | `erpnext/` |
| ERPNext MCP Server | `erpnext-mcp-server/` |
| Vercel frontend | `vercel/` |

## Hosted stack (production)

| Interface | URL |
|-----------|-----|
| Vercel desk | https://vercel-indol-phi-69.vercel.app |
| Vercel MCP proxy | https://vercel-indol-phi-69.vercel.app/api/mcp |
| Railway ERPNext | https://erpnext-production-512a.up.railway.app |
| API key/secret | `5b218748d06d007:b9a99536f8deac3` (from `railway logs --service erpnext --lines 200 \| grep api_key`) |

For hosted validation results (15/15 PASS, MCP action visible in UI), see [docs/hosted-mcp-validation-report.md](hosted-mcp-validation-report.md).

## Desk UI — Stock Transfer Orders

After installing the app and running migrate/build (see below), access STO pages from the ERPNext desk:

| Page | Route / URL | Description |
|------|-------------|-------------|
| **Intercompany** workspace | `/app/intercompany` | Sidebar workspace with STO shortcuts and related documents |
| **STO Dashboard** | `/app/sto-dashboard` | List all internal POs as STOs with stage summary cards, filters, and **New STO** dialog |
| **STO Trace** | `/app/sto-trace?purchase_order=PO-XXXX` | Document chain timeline, three-way match panel, and stage-appropriate action buttons |

On the hosted Vercel desk, all three pages are available at `https://vercel-indol-phi-69.vercel.app/app/{path}`.

### STO workflow stages (UI)

Draft → Pending Approval → Approved → Goods In Transit → IC Invoiced → Received → Three Way Matched → Completed (or **Dispute**)

Stage badges use Pierre-theme accent colors (blue `#009fff`, green `#0dbe4e`, red `#ff2e3f`, etc.). Verified on Vercel with `stage-inference.ts` + `include_stage=1` in `sto_dashboard.py` — Completed rows show "Completed" not "Unknown".

### Purchase Order list

The Purchase Order list includes **STO Dashboard** (menu) and **View STO Trace** (bulk action) shortcuts.

## OpulentAggro branding

Applied via `erpnext/hooks.py` and assets:

- App title: **OpulentAggro** (desk app picker, apps screen)
- Logo: `/assets/erpnext/images/opulentaggro-logo.svg`
- Publisher: Opulent AI
- Accent color: `#009fff` (Pierre blue)
- Website/login favicon and splash image use OpulentAggro logo
- Boot metadata: `bootinfo.opulentaggro` with brand and theme keys

## Pierre theme (desk)

Adapted from [pierrecomputer/theme](https://github.com/pierrecomputer/theme) (VS Code marketplace: `pierrecomputer.pierre-theme`).

CSS bundle: `erpnext/public/scss/opulentaggro-pierre.bundle.scss` → built as `opulentaggro-pierre.bundle.css`

Key mappings:

| Pierre (VS Code) | OpulentAggro desk variable |
|------------------|----------------------------|
| `#009fff` accent | `--primary`, buttons, links |
| `#0a0a0a` / `#fafafa` | Dark/light backgrounds |
| `#171717` / `#f5f5f5` | Sidebar, navbar |
| `#1d1d1d` / `#e5e5e5` | Borders, controls |

The theme loads automatically on every desk page via `app_include_css` in hooks. Respects Frappe light/dark mode (`data-theme` attribute).

To disable: remove `opulentaggro-pierre.bundle.css` from `app_include_css` in `hooks.py` and rebuild assets.

## STO workflow mapping (AgroFresh SAP → ERPNext)

| SAP step | ERPNext document | MCP tool |
|----------|------------------|----------|
| Create & code STO | Internal Purchase Order | `sto_create` |
| DoA approve & post | Submit PO | `sto_submit` |
| Route to Sender | Intercompany Sales Order | `sto_approve_and_route` |
| Goods in transit (643) | Delivery Note → GIT warehouse | `sto_post_goods_in_transit` |
| Auto IC invoice | Sales Invoice + Purchase Invoice | `sto_create_ic_invoice` |
| Goods receipt | Intercompany Purchase Receipt | `sto_post_goods_receipt` |
| Trace chain | — | `sto_get_trace` |
| Three-way match | PO / PR / PI comparison | `sto_three_way_match` |
| List STOs | — | `sto_list` |
| Booking advice / BOL | HTML file on DN | `sto_generate_booking_advice` |
| Request DoA approval | Workflow-lite | `sto_request_approval` |
| Approve STO | Submit after DoA | `sto_approve` |
| Reject STO | Workflow-lite | `sto_reject` |
| Open dispute | Workflow-lite | `sto_open_dispute` |
| Resolve dispute | Workflow-lite | `sto_resolve_dispute` |
| List disputes | — | `sto_list_disputes` |

### Intercompany billing (standalone AR/AP)

| Action | MCP tool |
|--------|----------|
| List company pairs | `ic_list_accounts` |
| Sales Invoice (AR) | `ic_create_sales_invoice` |
| Purchase Invoice (AP) | `ic_create_purchase_invoice` |
| Linked SI + PI | `ic_create_invoice_pair` |
| Submit invoices | `ic_submit_invoice` |
| Trace posting status | `ic_get_invoice_status` |

### IC extended (treasury, triangular, accrual)

| Step | MCP tool |
|------|----------|
| Match & clear AR/AP | `ic_match_and_clear` |
| Clearing status | `ic_get_clearing_status` |
| Pending clearing list | `ic_list_pending_clearing` |
| Central reconciliation | `ic_get_reconciliation_summary` |
| Triangular sale | `ic_triangular_sale` |
| List triangular sales | `ic_list_triangular_sales` |
| Accrual allocation | `ic_create_accrual` |
| List accruals | `ic_list_accruals` |

**Total MCP tools:** 41 (16 `sto_*` + 14 `ic_*` + 11 generic). See [opulentaggro-flow-coverage.mdx](opulentaggro-flow-coverage.mdx).

## ERPNext API methods

Whitelisted under `erpnext.intercompany.stock_transfer_order`:

- `create_stock_transfer_order`
- `submit_stock_transfer_order`
- `approve_and_route_stock_transfer`
- `post_goods_in_transit`
- `create_intercompany_invoice`
- `post_stock_transfer_receipt`
- `get_stock_transfer_trace`
- `run_stock_transfer_three_way_match`
- `list_stock_transfer_orders`

Whitelisted under `erpnext.intercompany.intercompany_billing` (standalone AR/AP, multiple company pairs):

- `list_intercompany_accounts`
- `create_intercompany_sales_invoice`
- `create_intercompany_purchase_invoice`
- `create_intercompany_invoice_pair`
- `submit_intercompany_invoice`
- `get_intercompany_invoice_status`

## ERPNext prerequisites

1. **Inter Company** enabled in Selling/Buying settings
2. **Internal Customer** on sending company (represents receiving company)
3. **Internal Supplier** on receiving company (represents sending company)
4. Warehouses: sending, receiving, and optional GIT (goods-in-transit)
5. Shared **currency** across both companies
6. **Price list** with both buying and selling checked (or internal transfer at arms-length price setting)

Install the modified ERPNext app on your Frappe bench site:

```bash
cd /path/to/frappe-bench
bench get-app /path/to/FW_\ Intercompany\ Files/erpnext --overwrite
bench --site your-site install-app erpnext
bench --site your-site migrate
bench build --app erpnext
bench restart
```

Then open **Intercompany** workspace or navigate to `/app/sto-dashboard`.

## MCP server setup

```bash
cd erpnext-mcp-server
npm install
npm run build
```

Cursor / Claude Desktop config:

```json
{
  "mcpServers": {
    "erpnext-sto": {
      "command": "node",
      "args": ["/Users/jeremyalston/Perfect/FW_  Intercompany Files/erpnext-mcp-server/build/index.js"],
      "env": {
        "ERPNEXT_URL": "http://localhost:8000",
        "ERPNEXT_API_KEY": "",
        "ERPNEXT_API_SECRET": ""
      }
    }
  }
}
```

Debug with MCP Inspector:

```bash
cd erpnext-mcp-server
ERPNEXT_URL=... ERPNEXT_API_KEY=... ERPNEXT_API_SECRET=... npm run inspector
```

### Local dev without API keys (never production)

When `ERPNEXT_URL` is `http://localhost:8000` or `127.0.0.1`, set `ERPNEXT_NO_AUTH=1` in root `.env` or Cursor MCP `env`. The server logs in via Frappe session (`ERPNEXT_DEV_USER` / `ERPNEXT_DEV_PASSWORD` from `config/demo-credentials.env`). Do not use on remote hosts.

```json
"env": {
  "ERPNEXT_URL": "http://localhost:8000",
  "ERPNEXT_NO_AUTH": "1",
  "ERPNEXT_DEV_PASSWORD": "<from config/demo-credentials.env>"
}
```

See [erpnext-sto-test-setup.md](./erpnext-sto-test-setup.md) for database setup, seed data, and automated tests.

## Agent skills

Cursor agents should load project skills from `.cursor/skills/` before working on STO:

| Skill | Path |
|-------|------|
| MCP ↔ DB alignment | `.cursor/skills/mcp-db-alignment/SKILL.md` |
| Desk navigation & API | `.cursor/skills/opulentaggro-sto-navigation/SKILL.md` |
| MCP tools & workflows | `.cursor/skills/erpnext-sto-mcp/SKILL.md` |

See also root [AGENTS.md](../AGENTS.md).

## Example agent flow

1. `sto_create` — company, internal supplier, items
2. `sto_submit` — after human DoA approval
3. `sto_approve_and_route` — notify sender side
4. `sto_post_goods_in_transit` — sender confirms shipment
5. `sto_create_ic_invoice` — IC AR/AP documents
6. `sto_post_goods_receipt` — requestor GR
7. `sto_three_way_match` — validate qty/price tolerances
8. `sto_get_trace` — audit / observability

### Standalone IC billing (multi-pair)

1. `ic_list_accounts` — verify pair master data
2. `ic_create_invoice_pair` — linked AR + AP (or separate `ic_create_sales_invoice` / `ic_create_purchase_invoice`)
3. `ic_get_invoice_status` — confirm AR/AP posted
4. `ic_submit_invoice` — submit drafts if needed

## Blockers / user input needed

- **Start Docker Desktop**, then `./scripts/start_infra.sh` (MariaDB; Redis cache/queue documented in [erpnext-sto-test-setup.md](./erpnext-sto-test-setup.md))
- Copy `erpnext-mcp-server/.env.example` → `.env` and set API key/secret after site setup
- ERPNext site URL and API key/secret for a configured multi-company instance
- Internal customer/supplier master data per company pair
- Warehouse names (especially GIT / in-transit)
- MIRO tolerance percentages for production (`qty_tolerance_percent`, `price_tolerance_percent`)
- Workflow/DoA integration is **human-governed** — agents submit only after approval
