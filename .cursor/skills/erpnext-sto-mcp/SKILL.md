---
name: erpnext-sto-mcp
description: Operates the erpnext-mcp-server MCP tools for OpulentAggro intercompany Stock Transfer Orders — 9 sto_* tools, 6 ic_* intercompany billing tools (AR/AP for multiple company pairs), 11 generic ERPNext tools, stdio or Vercel HTTP transport. Use when configuring MCP, calling STO or IC billing tools, ERPNext MCP, erpnext-mcp-server, Vercel /api/mcp, or automating intercompany workflows via agents.
---

# ERPNext STO MCP Server

MCP server at `erpnext-mcp-server/`. Shared factory in `create-server.ts` registers **26 tools**:

| Group | Count | Source |
|-------|------:|--------|
| `sto_*` | 9 | `src/sto-tools.ts` → `erpnext.intercompany.stock_transfer_order` |
| `ic_*` | 6 | `src/ic-billing-tools.ts` → `erpnext.intercompany.intercompany_billing` |
| Generic | 11 | `src/create-server.ts` → ERPNext REST / Frappe methods |

Keep tool definitions aligned with ERPNext APIs — see [mcp-db-alignment](../mcp-db-alignment/SKILL.md) and [tool-registry](../mcp-db-alignment/references/tool-registry.md).

## Setup (local stdio)

```bash
cd erpnext-mcp-server
cp ../config/demo-credentials.env.example ../config/demo-credentials.env   # edit passwords
npm install
npm run build          # outputs build/index.js
```

Generate API keys: Desk → User → API Access → Generate Keys.

**Never commit** `config/demo-credentials.env` or paste secrets into skills/docs.

### Demo credentials

Scripts load `config/demo-credentials.env` via `scripts/load_env.sh`:

```bash
source scripts/load_env.sh
# Sets ERPNEXT_URL, ERPNEXT_NO_AUTH, ERPNEXT_DEV_USER, ERPNEXT_DEV_PASSWORD, etc.
```

### Cursor MCP config (local stdio)

```json
{
  "mcpServers": {
    "erpnext-sto": {
      "command": "node",
      "args": ["<WORKSPACE>/erpnext-mcp-server/build/index.js"],
      "env": {
        "ERPNEXT_URL": "http://localhost:8000",
        "ERPNEXT_NO_AUTH": "1"
      }
    }
  }
}
```

Replace `<WORKSPACE>` with repo root (note **two spaces** after `FW_` in path).

Alternative with API token:

```json
"env": {
  "ERPNEXT_URL": "http://localhost:8000",
  "ERPNEXT_API_KEY": "<from-site>",
  "ERPNEXT_API_SECRET": "<from-site>"
}
```

Transport: **stdio** (`src/index.ts`). Server requires `ERPNEXT_URL`.

### Auth modes

| Mode | Env vars | When |
|------|----------|------|
| **API token** | `ERPNEXT_API_KEY` + `ERPNEXT_API_SECRET` | Production, shared dev, Vercel HTTP |
| **Dev session** | `ERPNEXT_NO_AUTH=1` or `MCP_NO_AUTH=1` + localhost `ERPNEXT_URL` | Local only — session login as `ERPNEXT_DEV_USER` (default Administrator) |
| **Demo file** | `config/demo-credentials.env` via `scripts/load_env.sh` | Local scripts and integration tests |

Dev session uses `ERPNEXT_DEV_PASSWORD` or `FRAPPE_ADMIN_PASSWORD` from demo credentials. **Never** set `ERPNEXT_NO_AUTH` on non-localhost URLs or Vercel.

Debug: `cd erpnext-mcp-server && npm run inspector` (with env vars set).

Verify: `./scripts/verify_mcp_alignment.sh` and `python3 scripts/test_all_mcp_endpoints.py` (see [mcp-db-alignment](../mcp-db-alignment/SKILL.md)).

## Vercel HTTP MCP (remote)

The `vercel/` project exposes the same 26 tools over **MCP Streamable HTTP** at `/api/mcp`. See [docs/vercel-deployment-plan.md](../../docs/vercel-deployment-plan.md).

```
https://YOUR-PROJECT.vercel.app/api/mcp
```

### Cursor / agent config (HTTP)

```json
{
  "mcpServers": {
    "erpnext-remote": {
      "url": "https://YOUR-PROJECT.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

(Field names may vary by MCP client version — validate with MCP Inspector.)

### Vercel env vars

| Variable | Purpose |
|----------|---------|
| `ERPNEXT_URL` | Public HTTPS ERPNext URL (not localhost) |
| `ERPNEXT_API_KEY` | API token key |
| `ERPNEXT_API_SECRET` | API token secret |
| `MCP_AUTH_TOKEN` | Bearer token protecting `/api/mcp` (recommended) |

Copy template from `vercel/.env.example`. **Do not** set `ERPNEXT_NO_AUTH` on Vercel.

Related endpoints: `/api/health` (connectivity), `/api/sto` (STO list proxy).

Deploy after MCP changes: `./scripts/sync-mcp-vendor.sh && cd vercel && vercel deploy`.

## When to use sto_* vs generic tools

| Task | Tool |
|------|------|
| Full STO lifecycle step | **`sto_*`** — validated args, correct API method, safe defaults |
| List/trace/match STOs | **`sto_list`**, **`sto_get_trace`**, **`sto_three_way_match`** |
| Standalone IC invoicing (AR/AP) | **`ic_*`** — multi company-pair billing without STO |
| List IC account pairs | **`ic_list_accounts`** |
| Read any DocType | `get_document`, `get_documents` |
| Ad-hoc whitelisted method | `call_method` — escape hatch only |
| Create/update non-STO docs | `create_document`, `update_document`, `submit_document` |
| Schema discovery | `get_doctypes`, `get_doctype_fields` |

**Prefer `sto_*` for intercompany workflow.** **Prefer `ic_*` for standalone AR/AP invoicing across company pairs.** Generic `call_method` bypasses validation and is error-prone for multi-step chains.

**Do not** use `create_document` on Purchase Order for STO — use `sto_create` (sets `is_internal_supplier`, validates supplier).

## 9-step STO workflow (agent checklist)

Human DoA required before step 2.

```
Task Progress:
- [ ] 1. sto_create — internal PO (Draft)
- [ ] 2. sto_submit — after DoA approval (Pending Approval)
- [ ] 3. sto_approve_and_route — SO on sender (Approved)
- [ ] 4. sto_post_goods_in_transit — DN + GIT (Goods In Transit)
- [ ] 5. sto_create_ic_invoice — SI + PI (IC Invoiced)
- [ ] 6. sto_post_goods_receipt — PR (Received)
- [ ] 7. sto_three_way_match — validate qty/price
- [ ] 8. sto_get_trace — audit chain + stage
- [ ] 9. sto_list — verify in STO index
```

After each step, check returned `stage` field. On error, read `isError` text and consult [opulentaggro-sto-navigation](../opulentaggro-sto-navigation/SKILL.md) pitfalls.

### Validated example (2026-05-31)

From [docs/mcp-endpoint-validation-report.md](../../docs/mcp-endpoint-validation-report.md) — 15/15 endpoints passed on `sto.local`:

```json
// 1. Create
{"company": "Opulent Fresh NA", "supplier": "Internal Supplier Opulent Fresh EU", "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 10, "rate": 50}]}

// 2–8. Chain (validated PO)
{"purchase_order": "PUR-ORD-2026-00038"}

// 7. Match
{"purchase_order": "PUR-ORD-2026-00038", "qty_tolerance_percent": 0, "price_tolerance_percent": 0}

// 9. List
{"limit": 20, "include_stage": true}
```

IC billing validated: `ACC-SINV-2026-00029`, `ACC-PINV-2026-00029`.

Re-run validation: `bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_endpoints_with_screenshots.sh'`

Dev seed data uses companies **Opulent Fresh NA** / **Opulent Fresh EU** and item **STO-TEST-ITEM-001** (`scripts/seed_sto_test_data.py`).

## STO tool quick reference

| MCP tool | API method |
|----------|------------|
| `sto_create` | `create_stock_transfer_order` |
| `sto_submit` | `submit_stock_transfer_order` |
| `sto_approve_and_route` | `approve_and_route_stock_transfer` |
| `sto_post_goods_in_transit` | `post_goods_in_transit` |
| `sto_create_ic_invoice` | `create_intercompany_invoice` |
| `sto_post_goods_receipt` | `post_stock_transfer_receipt` |
| `sto_get_trace` | `get_stock_transfer_trace` |
| `sto_three_way_match` | `run_stock_transfer_three_way_match` |
| `sto_list` | `list_stock_transfer_orders` |

Full input schemas: [references/sto-tools.md](references/sto-tools.md)

## Intercompany billing tools (`ic_*`)

Standalone Sales Invoice (AR) and Purchase Invoice (AP) for **multiple company pairs** — not tied to STO.

| MCP tool | API method |
|----------|------------|
| `ic_list_accounts` | `list_intercompany_accounts` |
| `ic_create_sales_invoice` | `create_intercompany_sales_invoice` |
| `ic_create_purchase_invoice` | `create_intercompany_purchase_invoice` |
| `ic_create_invoice_pair` | `create_intercompany_invoice_pair` |
| `ic_submit_invoice` | `submit_intercompany_invoice` |
| `ic_get_invoice_status` | `get_intercompany_invoice_status` |

Full schemas + multi-pair examples: [references/ic-billing-tools.md](references/ic-billing-tools.md)

## Generic MCP tools (11)

| Tool | Purpose |
|------|---------|
| `get_document` | Single doc by doctype + name |
| `get_documents` | Filtered list |
| `create_document` / `update_document` | CRUD |
| `submit_document` / `cancel_document` / `delete_document` | Docstatus changes |
| `call_method` | Any whitelisted Frappe method |
| `run_report` | Query reports |
| `get_doctypes` / `get_doctype_fields` | Discovery |

Generic tool schemas: [references/generic-tools.md](references/generic-tools.md)

## MCP resources

- `erpnext://DocTypes` — list DocTypes
- `erpnext://{doctype}/{name}` — fetch document JSON

Requires authentication (same env vars as tools).

## Troubleshooting

| Issue | Action |
|-------|--------|
| "Not authenticated with ERPNext" | Set `ERPNEXT_API_KEY` + `ERPNEXT_API_SECRET`, or `ERPNEXT_NO_AUTH=1` on localhost |
| "ERPNEXT_URL environment variable is required" | Add `ERPNEXT_URL` to MCP config |
| Tool not visible in Cursor | Rebuild (`npm run build`), restart Cursor, check MCP logs |
| Vercel `/api/mcp` 401 | Set `Authorization: Bearer <MCP_AUTH_TOKEN>` header |
| Vercel `/api/sto` 503 | Set `ERPNEXT_*` env vars to a live hosted ERPNext URL |
| Live API tests skip | Site not running or keys missing — see `docs/erpnext-sto-test-setup.md` |
| `sto_create` supplier error | Supplier must be internal — see navigation skill prerequisites |

## Source & tests

| File | Role |
|------|------|
| `erpnext-mcp-server/src/create-server.ts` | MCP server factory + generic tools |
| `erpnext-mcp-server/src/index.ts` | Stdio entry |
| `erpnext-mcp-server/src/sto-tools.ts` | STO tool definitions + handlers |
| `erpnext-mcp-server/src/ic-billing-tools.ts` | IC billing tool definitions + handlers |
| `erpnext-mcp-server/src/erpnext-client.ts` | REST client + auth |
| `vercel/lib/mcp-handler.ts` | HTTP transport handler |
| `erpnext-mcp-server/tests/sto-tools.test.mjs` | Mock 9-tool chain test |
| `erpnext-mcp-server/tests/ic-billing-tools.test.mjs` | Mock IC billing test |
| `scripts/test_sto_api.py` | Live STO integration test |
| `scripts/test_ic_billing_api.py` | Live IC billing integration test |

## Additional resources

- STO tool schemas + examples: [references/sto-tools.md](references/sto-tools.md)
- IC billing tool schemas: [references/ic-billing-tools.md](references/ic-billing-tools.md)
- Workflow patterns & tolerances: [references/workflows.md](references/workflows.md)
- Generic tool reference: [references/generic-tools.md](references/generic-tools.md)
- Tool registry (alignment SSOT): [mcp-db-alignment/references/tool-registry.md](../mcp-db-alignment/references/tool-registry.md)
- Desk/UI context: [opulentaggro-sto-navigation](../opulentaggro-sto-navigation/SKILL.md)
- Vercel deployment: [docs/vercel-deployment-plan.md](../../docs/vercel-deployment-plan.md)
- Endpoint validation: [docs/mcp-endpoint-validation-report.md](../../docs/mcp-endpoint-validation-report.md)
