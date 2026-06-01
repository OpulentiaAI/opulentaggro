# Hosted MCP Validation Report

**Run timestamp:** 2026-06-01T14:28:45Z (re-run with full seeds)
**Backend:** https://erpnext-production-512a.up.railway.app (Railway)
**Frontend:** https://vercel-indol-phi-69.vercel.app (Vercel)
**MCP Proxy:** https://vercel-indol-phi-69.vercel.app/api/mcp (streamable-http)

## Result: **ALL PASS — 100% on all three test suites**

| Suite | Result | Notes |
|-------|--------|-------|
| `test_hosted_mcp_e2e.py` (direct REST) | **15/15 PASS** | Full STO chain to Completed |
| `test_all_mcp_endpoints.py` (live + mock) | **17/17 PASS** | PO PUR-ORD-2026-00022, invoice pair ACC-SINV/PINV-2026-00043 |
| `verify_mcp_alignment.sh` | **PASS** | MCP tools, types, Python syntax all aligned |
| Vercel MCP proxy (initialize + 5 read tools) | **6/6 PASS** | SSE stream works |
| **MCP action visible in UI** | **YES** | `PUR-ORD-2026-00023` Draft $4,400.00 on /app/sto-dashboard |

## Phase 1: Health

| Check | Status | Detail |
|-------|--------|--------|
| `GET /api/method/ping` | PASS | `{"message":"pong"}` |
| `GET /api/health` | PASS | `reachable: true, deskBootHealthy: true, error: null` |
| Auth | PASS | `frappe.auth.get_logged_user` → `Administrator` |
| API key valid | PASS | `5b218748d06d007:b9a99536f8deac3` (from Railway logs) |

## Phase 2: MCP Test Matrix

### Direct transport (test_hosted_mcp_e2e.py)
```
✓ sto_create: PASS PUR-ORD-2026-00020
✓ sto_submit: PASS docstatus=1, stage=Pending Approval
✓ sto_approve_and_route: PASS SO SAL-ORD-2026-00014, stage=Approved
✓ sto_post_goods_in_transit: PASS DN MAT-DN-2026-00007
✓ sto_create_ic_invoice: PASS SI+PI pair created
✓ sto_post_goods_receipt: PASS PR created, stage=Received
✓ sto_get_trace: PASS full document tree
✓ sto_three_way_match: PASS matched=true, within_tolerance=true
✓ sto_list: PASS 5 rows
✓ ic_list_accounts: PASS 8 pairs
✓ ic_create_sales_invoice: PASS ACC-SINV-2026-00036
✓ ic_create_purchase_invoice: PASS ACC-PINV-2026-00036
✓ ic_create_invoice_pair: PASS ACC-SINV-2026-00037/ACC-PINV-2026-00037
✓ ic_submit_invoice: PASS SI docstatus=1
✓ ic_get_invoice_status: PASS status returned
```

### Vercel MCP proxy (streamable-http, Accept: application/json+text/event-stream)
```
✓ initialize: PASS (protocolVersion 2024-11-05)
✓ ic_list_accounts: PASS 8 pairs
✓ sto_list: PASS rows
✓ sto_get_trace: PASS trace
✓ sto_three_way_match: PASS matched=true
✓ ic_get_invoice_status: PASS status
✓ sto_create (marked qty=88, rate=50): PASS PUR-ORD-2026-00023
```

### Alignment (verify_mcp_alignment.sh)
```
✓ Registry vs sto-tools.ts
✓ Registry vs ic-billing-tools.ts
✓ Python test script syntax
✓ MCP alignment checks passed
```

## Phase 3: MCP Action → UI Verification (CRITICAL)

**Test:** Create a uniquely-marked PO via Vercel MCP proxy, verify it appears in the Vercel desk UI after browser refresh.

| Field | Value |
|-------|-------|
| PO name | **PUR-ORD-2026-00023** |
| Transport | Vercel MCP proxy (`POST /api/mcp`, tool `sto_create`) |
| Unique marker | qty=88, rate=50 → amount $4,400.00 |
| Stage | Draft |
| Created at | 2026-06-01T14:28 UTC |
| Visible after refresh | **YES** |
| Screenshot | `docs/screenshots/hosted-mcp-validation/08-mcp-action-in-ui.png` |

**UI verification (snapshot from /app/sto-dashboard):**
```
row "PUR-ORD-2026-00023 Draft Opulent Fresh NA Internal Supplier Opulent Fresh APAC 5/31/2026 $4,400.00 Draft":
  cell "PUR-ORD-2026-00023" → link /app/purchase-order/PUR-ORD-2026-00023
  cell "Draft"
  cell "$4,400.00"
  cell "Draft"
```

**Stage badge counters on dashboard:**
- 6 Draft
- 9 Pending Approval
- 0 Goods In Transit
- 8 Completed

Stage badges correctly infer Completed from SO+DN+PR+SI+PI, not Unknown.

## Fixes Applied This Run

### 1. Stock re-seeding for GIT/GR tools
Previous run failed `sto_post_goods_in_transit` with `NegativeStockError` because the APAC warehouse had only 1 unit of `STO-TEST-ITEM-001` left from prior tests.

**Fix:** Created `MAT-STE-2026-00003` (+50 units of item-001) and `MAT-STE-2026-00004` (+50 units of item-002) as Material Receipt entries to `Stores - OFAP`. Both submitted, docstatus=1.

**Result:** Full STO chain now passes including transit and receipt stages.

### 2. Browser snapshot timeout
agent-browser `wait --url` pattern occasionally times out on Next.js client-side route transitions. Switched to `agent-browser open` + `agent-browser wait 3000` for deterministic timing.

## Prior Fixes Confirmed Working

| Fix | Source | Verified by |
|-----|--------|-------------|
| Docker overlay for `accounts/utils.py` | `Dockerfile` | `pre_submit_validation` present in container (403 = not whitelisted, function exists) |
| PORT=80 for nginx | `railway/temp_nginx.conf` | Railway edge routes to nginx successfully |
| Currency = USD | `frappe.client.set_value` System Settings | PO currency is USD, intercompany validation passes |
| Fiscal Year 2026 | `frappe.client.insert` | All 3 companies have active fiscal year |
| Internal customer/supplier `companies` | `frappe.client.set_value` | Intercompany invoice creation allowed |
| `setup_complete = 1` | `frappe.client.set_value` | Frappe desk embeds load (no setup wizard blocking) |
| Vercel MCP `sto_create` items encoding | `json-args.ts` | `sto_create` via MCP proxy returns `PUR-ORD-2026-00023` |
| Vercel MCP API token auth | `auth.ts` | MCP proxy passes auth to backend |
| Frappe embed `strip_prefix` | `frappe-desk-proxy.ts` | `/app/purchase-order` loads correctly |
| Stage badges | `stage-inference.ts` + `include_stage=1` | Completed rows show "Completed" not "Unknown" |

## Environment Variables (frozen)

### Railway erpnext service
| Var | Value |
|-----|-------|
| `DB_HOST` | `mariadb.railway.internal` |
| `DB_NAME` | `railway` |
| `DB_USER` | `frappe` |
| `DB_PASSWORD` | `OpulentAggroMariaDB2026` |
| `DB_ROOT_PASSWORD` | `OpulentAggroMariaDB2026` |
| `FRAPPE_SITE_NAME` | `erpnext-production-512a.up.railway.app` |
| `FRAPPE_ADMIN_PASSWORD` | `OpulentAggro-Demo-2026!` |
| `PORT` | `80` |
| `FORCE_RECREATE_SITE` | `0` |
| `RECREATE_SITE_ON_DB_FAILURE` | `0` |
| `DEVELOPER_MODE` | `0` |

### Vercel production
| Var | Value |
|-----|-------|
| `ERPNEXT_URL` | `https://erpnext-production-512a.up.railway.app` |
| `ERPNEXT_API_KEY` | `5b218748d06d007` |
| `ERPNEXT_API_SECRET` | `b9a99536f8deac3` |
| `NEXT_PUBLIC_ERPNEXT_URL` | `https://erpnext-production-512a.up.railway.app` |
| `NEXT_PUBLIC_DEMO_USER` | `Administrator` |
| `NEXT_PUBLIC_APP_NAME` | `OpulentAggro` |

## Seed Data (live on Railway)

| Entity | Count | Names |
|--------|-------|-------|
| Companies | 3 | Opulent Fresh NA (USD), EU (USD), APAC (USD) |
| Items | 2 | STO-TEST-ITEM-001 (rate 100), STO-TEST-ITEM-002 (rate 200) |
| Warehouses | 18 | Stores, Finished Goods, GIT, WIP, etc. per company |
| Internal Suppliers | 3 | "Internal Supplier Opulent Fresh {NA,EU,APAC}" |
| Internal Customers | 3 | "Internal Customer Opulent Fresh {NA,EU,APAC}" |
| Fiscal Year | 1 | 2026 (Jan 1 - Dec 31, all 3 companies) |
| Stock | 4 bins | APAC: item-001=51, item-002=60; NA: item-001=9 |
| Material Receipts | 4 | MAT-STE-2026-00001/2/3/4 (all submitted) |

## Test Artifacts (this run)

- `PUR-ORD-2026-00020` → SAL-ORD-2026-00014 → MAT-DN-2026-00007 → PR → ACC-SINV-2026-00036 + ACC-PINV-2026-00036 (Three Way Matched)
- `PUR-ORD-2026-00022` → SAL-ORD-2026-00015 → MAT-DN-2026-00008 → PR → ACC-SINV-2026-00042 + ACC-PINV-2026-00042 (Completed)
- `PUR-ORD-2026-00023` → Draft (marked qty=88, $4,400.00) — **visible in UI**
- Standalone IC: ACC-SINV-2026-00037/ACC-PINV-2026-00037

## Screenshots

| File | Captures |
|------|----------|
| `01-sto-dashboard-baseline.png` | STO dashboard before MCP action |
| `05-ic-billing.png` | /app/intercompany/billing (Sales Invoice embed) |
| `06-purchase-order-embed.png` | /app/purchase-order (PO list, no "Page erpnext not found") |
| `08-mcp-action-in-ui.png` | PUR-ORD-2026-00023 Draft $4,400.00 visible after MCP proxy create |
| `09-sto-dashboard-pre-mcp.png` | STO dashboard baseline |
| `10-sto-trace.png` | /app/sto-trace |

## Remaining Gaps

None for the 15 core STO+IC tools. All pass on the live hosted stack with full browser UI verification.

Optional future work:
- Add a stock-on-hand check to the entrypoint that auto-seeds `Stores - OFAP` with N units of test items if a flag like `SEED_DEMO_STOCK=1` is set. This would let fresh deploys run the full STO chain immediately without manual API calls.
- Persist the `setup_complete=1` flag in the entrypoint so Frappe embeds work on first boot.
- Add a webhook from Vercel to Railway on API key rotation (currently requires manual sync).
