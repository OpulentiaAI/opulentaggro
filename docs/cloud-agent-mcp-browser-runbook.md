# Cloud Agent Runbook — MCP + Browser Validation (OpulentAggro)

**Purpose:** Single self-contained instruction set for a cloud agent with computer/browser use to validate all MCP tools against the hosted OpulentAggro stack (Railway ERPNext + Vercel frontend/MCP proxy) and confirm results in the browser UI.

**Workspace:** `/Users/jeremyalston/Perfect/FW_  Intercompany Files` (symlink: `/Users/jeremyalston/Perfect/sto-intercompany`)

**Never commit real API secrets.** Use placeholders below; retrieve live keys from Railway deploy logs or `./scripts/generate-production-api-keys.sh`.

---

## 1. Architecture overview

```
┌─────────────────────┐     HTTPS      ┌──────────────────────────────┐
│  Vercel (Next.js)   │───────────────▶│  Railway ERPNext (Frappe v15) │
│  Desk shell /app/*  │   API token    │  gunicorn + nginx :80         │
│  /api/mcp (MCP SSE) │◀──────────────▶│  MariaDB + Redis (bundled)    │
│  /api/health        │                │  OpulentAggro fork + STO/IC   │
└─────────────────────┘                └──────────────────────────────┘

Optional local dev:
  bench ERPNext  → http://localhost:8000
  Vercel dev     → http://localhost:3000
```

| Layer | Role |
|-------|------|
| **Railway** | Authoritative ERPNext backend — documents, whitelisted STO/IC APIs, seed data |
| **Vercel** | Next.js desk shell, Frappe embed proxy, `/api/sto` / `/api/ic` REST proxies, **MCP Streamable HTTP** at `/api/mcp` |
| **Local (optional)** | Full-stack dev: `bench` on `:8000`, `vercel dev` on `:3000`, `ERPNEXT_NO_AUTH=1` for localhost only |

**MCP server:** `erpnext-mcp-server/` — **26 tools** total (9 `sto_*` + 6 `ic_*` + 11 generic). Core E2E validation focuses on **15 tools** (STO + IC billing).

---

## 2. All URLs

### Production (hosted stack)

| Resource | URL |
|----------|-----|
| Railway ERPNext | `https://erpnext-production-512a.up.railway.app` |
| Railway ping | `https://erpnext-production-512a.up.railway.app/api/method/ping` |
| Vercel app (desk) | `https://vercel-indol-phi-69.vercel.app` |
| Vercel login | `https://vercel-indol-phi-69.vercel.app/login` |
| Vercel health | `https://vercel-indol-phi-69.vercel.app/api/health` |
| Vercel MCP proxy | `https://vercel-indol-phi-69.vercel.app/api/mcp` |
| Vercel STO proxy | `https://vercel-indol-phi-69.vercel.app/api/sto` |
| Vercel IC proxy | `https://vercel-indol-phi-69.vercel.app/api/ic` |

### Key UI routes (Vercel desk)

| Page | Path |
|------|------|
| Home / workspaces | `/app` |
| STO Dashboard | `/app/sto-dashboard` |
| STO Trace | `/app/sto-trace?purchase_order={PO}` |
| Intercompany workspace | `/app/intercompany` |
| IC Billing | `/app/intercompany/billing` |
| Purchase Order list | `/app/purchase-order` |
| Purchase Order form | `/app/purchase-order/{name}` |
| Delivery Note | `/app/delivery-note/{name}` |
| Sales Invoice list | `/app/sales-invoice` |
| Purchase Invoice list | `/app/purchase-invoice` |
| Purchase Receipt list | `/app/purchase-receipt` |

### Local (optional)

| Resource | URL |
|----------|-----|
| Local ERPNext | `http://localhost:8000` |
| Local Vercel | `http://localhost:3000` |
| Local MCP | `http://localhost:3000/api/mcp` |

---

## 3. Credentials table

| Variable | Purpose | Example / source |
|----------|---------|------------------|
| `DEMO_ADMIN_USER` | Desk login username (Railway + Vercel) | `Administrator` |
| `DEMO_ADMIN_PASSWORD` | Desk login password | `OpulentAggro-Demo-2026!` (demo admin; set via `FRAPPE_ADMIN_PASSWORD` on Railway) |
| `ERPNEXT_URL` | Backend base URL | `https://erpnext-production-512a.up.railway.app` |
| `ERPNEXT_API_KEY` | API token key for MCP/REST | **Get from Railway deploy logs:** `railway logs --service erpnext --lines 200 \| grep ERPNEXT_API_KEY=` or `./scripts/generate-production-api-keys.sh` |
| `ERPNEXT_API_SECRET` | API token secret | Same as above — **rotates on site recreate** |
| `ERPNEXT_SERVICE_USER` | Vercel desk proxy service session (server-only) | `Administrator` — set in Vercel env |
| `ERPNEXT_SERVICE_PASSWORD` | Vercel desk proxy password (server-only) | Same as `DEMO_ADMIN_PASSWORD` — **never** expose in `NEXT_PUBLIC_*` |
| `ERPNEXT_AUTH_MODE` | Vercel auth strategy | `service_session` (desk proxy) or default API token for `/api/mcp` |
| `MCP_AUTH_TOKEN` | Optional Bearer protecting `/api/mcp` | Set in Vercel if enabled; omit header if open |
| `VERCEL_URL` | Vercel app base (browser + health) | `https://vercel-indol-phi-69.vercel.app` |
| `VERCEL_MCP_URL` | Full MCP endpoint | `$VERCEL_URL/api/mcp` |
| `STO_TEST_COMPANY` | Receiving company for STO tests | `Opulent Fresh NA` |
| `STO_TEST_SUPPLIER` | Internal supplier (sending entity) | `Internal Supplier Opulent Fresh APAC` (hosted) or `Internal Supplier Opulent Fresh EU` (local seed default) |
| `STO_TEST_ITEM` | Test item code | `STO-TEST-ITEM-001` |
| `IC_TEST_FROM_COMPANY` | IC billing seller | `Opulent Fresh APAC` (hosted) or `Opulent Fresh EU` (local) |
| `IC_TEST_TO_COMPANY` | IC billing buyer | `Opulent Fresh NA` |
| `ERPNEXT_NO_AUTH` | Localhost session login bypass | `1` — **localhost only**; never set on Railway/Vercel |

### Railway login vs Vercel login

| Context | URL | Username | Password |
|---------|-----|----------|----------|
| **Vercel desk UI** (primary browser validation) | `$VERCEL_URL/login` | `Administrator` | `OpulentAggro-Demo-2026!` |
| **Railway ERPNext desk** (direct Frappe, optional) | `$ERPNEXT_URL/login` | `Administrator` | `OpulentAggro-Demo-2026!` |

Browser validation should use **Vercel login** — that proves the full embed proxy + MCP → UI path.

---

## 4. Prerequisites checklist

Run these before MCP or browser tests. All must pass.

```
- [ ] Railway ping returns pong
- [ ] Vercel /api/health reachable with deskBootHealthy: true
- [ ] ERPNext setup_complete = 1 (no setup wizard blocking embeds)
- [ ] Seed data present (companies, items, internal parties, fiscal year)
- [ ] Stock on hand in sender warehouse (for full 15/15 GIT/GR chain)
- [ ] API keys valid (frappe.auth.get_logged_user → Administrator)
```

### Quick checks

```bash
# Railway ping
curl -sf "$ERPNEXT_URL/api/method/ping"
# Expected: {"message":"pong"}

# Vercel health
curl -sf "$VERCEL_URL/api/health" | jq .
# Expected: reachable: true, deskBootHealthy: true, error: null

# Auth probe (replace placeholders)
curl -sf -H "Authorization: token $ERPNEXT_API_KEY:$ERPNEXT_API_SECRET" \
  "$ERPNEXT_URL/api/method/frappe.auth.get_logged_user"
# Expected: {"message":"Administrator"}

# setup_complete (via REST)
curl -sf -H "Authorization: token $ERPNEXT_API_KEY:$ERPNEXT_API_SECRET" \
  "$ERPNEXT_URL/api/resource/System%20Settings/System%20Settings?fields=%5B%22setup_complete%22%5D"
# Expected: setup_complete: 1
```

### Seed data expectations (Railway)

| Entity | Expected |
|--------|----------|
| Companies | Opulent Fresh NA, EU, APAC (USD) |
| Items | `STO-TEST-ITEM-001`, `STO-TEST-ITEM-002` |
| Internal suppliers | `Internal Supplier Opulent Fresh {NA,EU,APAC}` |
| Fiscal year | 2026 active for all companies |
| Stock (full chain) | APAC `Stores - OFAP`: item-001 ≥ 50 units (Material Receipt if depleted) |

If GIT/GR steps fail with `NegativeStockError`, re-seed stock before continuing (see §8 Troubleshooting).

---

## 5. MCP tools reference

### 5.1 Core 15 tools (E2E validation)

These are exercised by `scripts/test_hosted_mcp_e2e.py` in dependency order.

#### STO tools (9)

| Tool | Required params | Example arguments |
|------|-----------------|-------------------|
| `sto_create` | `company`, `supplier`, `items[]` | See below |
| `sto_submit` | `purchase_order` | `{"purchase_order":"PUR-ORD-2026-000XX"}` |
| `sto_approve_and_route` | `purchase_order` | `{"purchase_order":"PUR-ORD-2026-000XX","submit":true}` |
| `sto_post_goods_in_transit` | `purchase_order` | `{"purchase_order":"PUR-ORD-2026-000XX","submit":true}` |
| `sto_create_ic_invoice` | `purchase_order` | `{"purchase_order":"PUR-ORD-2026-000XX","submit":true}` |
| `sto_post_goods_receipt` | `purchase_order` | `{"purchase_order":"PUR-ORD-2026-000XX","submit":true}` |
| `sto_get_trace` | `purchase_order` | `{"purchase_order":"PUR-ORD-2026-000XX"}` |
| `sto_three_way_match` | `purchase_order` | `{"purchase_order":"PUR-ORD-2026-000XX"}` |
| `sto_list` | _(optional)_ `limit`, `company` | `{"limit":20,"include_stage":true}` |

**`sto_create` example (MCP — items as JSON array, NOT double-encoded string):**

```json
{
  "company": "Opulent Fresh NA",
  "supplier": "Internal Supplier Opulent Fresh APAC",
  "items": [
    {"item_code": "STO-TEST-ITEM-001", "qty": 88, "rate": 50}
  ],
  "submit": false
}
```

Browser marker test: **qty=88, rate=50 → $4,400.00** on dashboard.

#### IC billing tools (6)

| Tool | Required params | Example arguments |
|------|-----------------|-------------------|
| `ic_list_accounts` | _(none)_ | `{}` |
| `ic_create_sales_invoice` | `from_company`, `to_company`, `items[]` | See below |
| `ic_create_purchase_invoice` | `from_company`, `to_company`, `items[]` | See below |
| `ic_create_invoice_pair` | `from_company`, `to_company`, `items[]` | See below |
| `ic_submit_invoice` | `sales_invoice` and/or `purchase_invoice` | `{"sales_invoice":"ACC-SINV-2026-000XX"}` |
| `ic_get_invoice_status` | `sales_invoice` and/or `purchase_invoice` | `{"sales_invoice":"...","purchase_invoice":"..."}` |

**IC create example:**

```json
{
  "from_company": "Opulent Fresh APAC",
  "to_company": "Opulent Fresh NA",
  "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 1, "rate": 50}],
  "submit": false
}
```

### 5.2 Generic tools (11 — optional smoke)

| Tool | Required params |
|------|-----------------|
| `get_doctypes` | _(none)_ |
| `get_doctype_fields` | `doctype` |
| `get_documents` | `doctype` |
| `get_document` | `doctype`, `name` |
| `create_document` | `doctype`, `doc` |
| `update_document` | `doctype`, `name`, `doc` |
| `submit_document` | `doctype`, `name` |
| `cancel_document` | `doctype`, `name` |
| `delete_document` | `doctype`, `name` |
| `call_method` | `method`, `args` |
| `run_report` | `report_name` |

Full schemas: `.cursor/skills/erpnext-sto-mcp/references/generic-tools.md`

### 5.3 Vercel MCP SSE — example JSON-RPC

**Required header:** `Accept: application/json, text/event-stream`

Optional auth: `Authorization: Bearer $MCP_AUTH_TOKEN`

#### Step 1 — initialize

```bash
curl -sS -X POST "$VERCEL_MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "cloud-agent", "version": "1.0"}
    }
  }'
```

#### Step 2 — notifications/initialized

```bash
curl -sS -X POST "$VERCEL_MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
# Empty body or 202 is OK
```

#### Step 3 — tools/call (sto_list)

```bash
curl -sS -X POST "$VERCEL_MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "sto_list",
      "arguments": {"limit": 5}
    }
  }'
```

#### Step 4 — tools/call (sto_create with marker qty=88)

```bash
curl -sS -X POST "$VERCEL_MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "sto_create",
      "arguments": {
        "company": "Opulent Fresh NA",
        "supplier": "Internal Supplier Opulent Fresh APAC",
        "items": [{"item_code": "STO-TEST-ITEM-001", "qty": 88, "rate": 50}],
        "submit": false
      }
    }
  }'
```

**Critical:** Pass `items` as a **JSON array** in `arguments`. Do NOT JSON-stringify `items` for MCP (direct REST API uses `json.dumps(items)` — different transport).

Parse SSE response: look for `data: {"jsonrpc":"2.0",...}` lines; `result.content[0].text` contains JSON with `purchase_order`.

---

## 6. Step-by-step agent workflow

### Phase A — Health

```bash
cd "/Users/jeremyalston/Perfect/FW_  Intercompany Files"  # or sto-intercompany symlink

# 1. Railway ERPNext
curl -sf "$ERPNEXT_URL/api/method/ping"

# 2. Vercel connectivity + desk boot
curl -sf "$VERCEL_URL/api/health" | jq '.components.erpnext'

# 3. API token auth
curl -sf -H "Authorization: token $ERPNEXT_API_KEY:$ERPNEXT_API_SECRET" \
  "$ERPNEXT_URL/api/method/frappe.auth.get_logged_user"
```

**Stop if any check fails** — fix credentials or wait for Railway deploy (first boot can take 3–5 min).

---

### Phase B — Direct API (15 core tools)

Uses the same whitelisted methods as MCP, via Railway REST (no MCP transport).

```bash
# Load env (optional if already exported)
source scripts/load_env.sh 2>/dev/null || true

# Full 15-tool chain — direct Railway REST
python3 scripts/test_hosted_mcp_e2e.py --direct-only \
  --report docs/hosted-mcp-results.json

# Alternative: live + mock (17 rows)
python3 scripts/test_all_mcp_endpoints.py \
  --report docs/hosted-mcp-results-all.json
```

**Chain order (automatic in script):**

1. `ic_list_accounts`
2. `sto_list`
3. `sto_create` → captures `po_name`
4. `sto_submit`
5. `sto_approve_and_route`
6. `sto_post_goods_in_transit` ← requires stock in sender warehouse
7. `sto_create_ic_invoice`
8. `sto_post_goods_receipt`
9. `sto_get_trace`
10. `sto_three_way_match`
11. `ic_create_sales_invoice`
12. `ic_create_purchase_invoice`
13. `ic_create_invoice_pair`
14. `ic_get_invoice_status`
15. `ic_submit_invoice`

**Expected:** `15/15 PASS` in report. If GIT/GR fail → see §8 (stock prereqs) — may get **13/15** until stock re-seeded.

---

### Phase C — Vercel MCP proxy

```bash
# Full hosted E2E (direct + Vercel MCP)
python3 scripts/test_hosted_mcp_e2e.py --report docs/hosted-mcp-results.json

# MCP-only
python3 scripts/test_hosted_mcp_e2e.py --mcp-only --report docs/hosted-mcp-results.json
```

Manual curl sequence: **initialize → notifications/initialized → tools/call** (see §5.3).

Minimum MCP smoke after full script:

- `initialize` PASS
- `sto_list` PASS
- `sto_create` with qty=88 PASS → note `purchase_order` name for browser phase

---

### Phase D — Browser validation (computer use)

**Goal:** Prove MCP-created documents appear in the Vercel desk UI.

#### D.1 — Open and login

1. Navigate to `https://vercel-indol-phi-69.vercel.app/login`
2. Username: `Administrator`
3. Password: `OpulentAggro-Demo-2026!`
4. Confirm redirect to `/app` or workspace

#### D.2 — Baseline STO dashboard

1. Navigate to `/app/sto-dashboard`
2. Wait for table to load (3–5 s)
3. Note existing PO count and stage badges (Draft, Pending Approval, etc.)
4. **Screenshot:** `docs/screenshots/hosted-mcp-validation/01-sto-dashboard-baseline.png`

#### D.3 — Create PO via MCP (if not done in Phase C)

Run `sto_create` via Vercel MCP with **qty=88, rate=50**. Record returned `purchase_order` (e.g. `PUR-ORD-2026-00023`).

#### D.4 — Verify PO on dashboard

1. Refresh `/app/sto-dashboard` (or re-open)
2. Search/wait for the new PO name
3. Confirm row shows: **Draft**, **$4,400.00**, companies NA ← APAC
4. **Screenshot:** `docs/screenshots/hosted-mcp-validation/08-mcp-action-in-ui.png`

#### D.5 — Embed and related pages

| Step | URL | Screenshot file |
|------|-----|-----------------|
| Purchase Order list embed | `/app/purchase-order` | `06-purchase-order-embed.png` |
| PO form (from MCP) | `/app/purchase-order/{PO}` | _(optional)_ |
| Intercompany billing | `/app/intercompany/billing` | `05-ic-billing.png` |
| STO Trace | `/app/sto-trace` | `10-sto-trace.png` |

**Pass criteria for embeds:** No "Page erpnext not found" or setup wizard overlay.

#### D.6 — agent-browser commands (if CLI available)

```bash
export VERCEL_URL=https://vercel-indol-phi-69.vercel.app
mkdir -p docs/screenshots/hosted-mcp-validation

agent-browser set viewport 1440 900
agent-browser open "$VERCEL_URL/login"
agent-browser wait 2000

# Fill login — re-run snapshot -i if refs stale
agent-browser snapshot -i
agent-browser fill @e2 "Administrator"
agent-browser fill @e3 "OpulentAggro-Demo-2026!"
agent-browser click @e5
agent-browser wait 3000

# Baseline dashboard
agent-browser open "$VERCEL_URL/app/sto-dashboard"
agent-browser wait 5000
agent-browser screenshot docs/screenshots/hosted-mcp-validation/01-sto-dashboard-baseline.png --full

# After MCP sto_create — wait for PO (replace PO name)
PO="PUR-ORD-2026-00023"
agent-browser reload
agent-browser wait 4000
agent-browser wait --text "$PO" 12000 || true
agent-browser screenshot docs/screenshots/hosted-mcp-validation/08-mcp-action-in-ui.png --full

# Embeds
agent-browser open "$VERCEL_URL/app/purchase-order"
agent-browser wait 4000
agent-browser screenshot docs/screenshots/hosted-mcp-validation/06-purchase-order-embed.png --full

agent-browser open "$VERCEL_URL/app/intercompany/billing"
agent-browser wait 4000
agent-browser screenshot docs/screenshots/hosted-mcp-validation/05-ic-billing.png --full

agent-browser close
```

**Headless tip:** `/app/sto-trace?purchase_order={PO}` async loader is unreliable. Prefer PO form and list views for trace proof.

---

### Phase E — Alignment gate

```bash
./scripts/verify_mcp_alignment.sh
```

Builds MCP server, runs mock tests, verifies tool registry parity. Run after any tool definition changes.

**Optional wrapper (health + E2E + browser checklist):**

```bash
./scripts/cloud_agent_validate.sh
```

---

## 7. Expected pass criteria

| Gate | Pass |
|------|------|
| Railway ping | `{"message":"pong"}` |
| Vercel health | `reachable: true`, `deskBootHealthy: true` |
| Direct API (`test_hosted_mcp_e2e.py --direct-only`) | **15/15 PASS** (or **13/15** if stock not seeded — GIT/GR blocked) |
| Vercel MCP `sto_create` | PASS with `purchase_order` in response |
| Vercel MCP full chain | 15/15 when stock seeded |
| UI after MCP action | New PO visible on `/app/sto-dashboard` with qty=88 marker ($4,400.00) |
| Embeds | PO list + IC billing load without setup wizard / "Page erpnext not found" |
| Alignment | `verify_mcp_alignment.sh` exits 0 |
| Screenshots | At least baseline + post-MCP dashboard captured under `docs/screenshots/hosted-mcp-validation/` |

### GIT/GR prerequisites (13/15 vs 15/15)

Steps **6** (`sto_post_goods_in_transit`) and **8** (`sto_post_goods_receipt`) require stock in the **sender** warehouse (`Stores - OFAP` for APAC→NA flow).

If only 13/15 pass:
- Document which tools failed
- Re-seed Material Receipt (+50 units) on Railway
- Re-run Phase B

---

## 8. Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| HTTP 401 / "Invalid API Key" | Stale `ERPNEXT_API_KEY` after site recreate | `railway logs --service erpnext --lines 200 \| grep api_key` or `./scripts/generate-production-api-keys.sh`; sync to Vercel env |
| `setup_complete` false / setup wizard in embed | Frappe not finalized | Set `setup_complete=1` on System Settings (Railway SSH or API) |
| `NegativeStockError` on GIT | Sender warehouse empty | Material Receipt to `Stores - OFAP` for `STO-TEST-ITEM-001` (+50 qty) |
| "Page erpnext not found" in embed | Frappe desk proxy `strip_prefix` not deployed | Redeploy Vercel; check `vercel/lib/frappe-desk-proxy.ts` |
| `deskBootHealthy: false` | Schema migrate incomplete or proxy auth failed | Check Vercel logs; run `bench migrate` on Railway; verify `ERPNEXT_SERVICE_*` |
| Vercel MCP `sto_create` 500 | `items` double-encoded as string | Pass `items` as JSON **array** in MCP arguments (see §5.3) |
| Vercel MCP 401 | `MCP_AUTH_TOKEN` required | Add `Authorization: Bearer $MCP_AUTH_TOKEN` header |
| PO not on dashboard after MCP | Cache / slow index | Wait 5–10 s, hard refresh; confirm PO exists via REST `get_document` |
| `FiscalYearError` | Missing fiscal year | Create FY 2026 for all companies (see `docs/railway-backend-deployment.md`) |
| Intercompany invoice blocked | Internal customer/supplier `companies` field | Verify seed pairs via `ic_list_accounts` |

---

## 9. Copy-paste env block for agent

```bash
# === OpulentAggro hosted validation env ===
# Replace API key placeholders from Railway deploy logs:
#   railway logs --service erpnext --lines 200 | grep ERPNEXT_API_KEY=

export ERPNEXT_URL="https://erpnext-production-512a.up.railway.app"
export ERPNEXT_API_KEY="<from-railway-logs>"
export ERPNEXT_API_SECRET="<from-railway-logs>"

export VERCEL_URL="https://vercel-indol-phi-69.vercel.app"
export VERCEL_MCP_URL="${VERCEL_URL}/api/mcp"

# Optional — only if Vercel MCP is Bearer-protected
# export MCP_AUTH_TOKEN="<from-vercel-env>"

# Desk login (browser)
export DEMO_ADMIN_USER="Administrator"
export DEMO_ADMIN_PASSWORD="OpulentAggro-Demo-2026!"

# Test data (hosted defaults)
export STO_TEST_COMPANY="Opulent Fresh NA"
export STO_TEST_SUPPLIER="Internal Supplier Opulent Fresh APAC"
export STO_TEST_ITEM="STO-TEST-ITEM-001"
export IC_TEST_FROM_COMPANY="Opulent Fresh APAC"
export IC_TEST_TO_COMPANY="Opulent Fresh NA"

# Local dev only — DO NOT set on hosted runs
# export ERPNEXT_NO_AUTH=1
```

---

## 10. Related docs and scripts

| Resource | Path |
|----------|------|
| Latest hosted report | `docs/hosted-mcp-validation-report.md` |
| JSON results | `docs/hosted-mcp-results.json` |
| Railway deployment | `docs/railway-backend-deployment.md` |
| MCP E2E skill | `.cursor/skills/mcp-e2e-testing/SKILL.md` |
| MCP server skill | `.cursor/skills/erpnext-sto-mcp/SKILL.md` |
| Tool registry (26 tools) | `.cursor/skills/mcp-db-alignment/references/tool-registry.md` |
| Hosted E2E script | `scripts/test_hosted_mcp_e2e.py` |
| All endpoints script | `scripts/test_all_mcp_endpoints.py` |
| Alignment gate | `scripts/verify_mcp_alignment.sh` |
| Cloud agent wrapper | `scripts/cloud_agent_validate.sh` |
| API key generator | `scripts/generate-production-api-keys.sh` |

---

## Agent execution summary (TL;DR)

1. Export env (§9) with API keys from Railway logs
2. Phase A health curls — all green
3. `python3 scripts/test_hosted_mcp_e2e.py --report docs/hosted-mcp-results.json` — target 15/15
4. MCP `sto_create` qty=88 via `/api/mcp` — note PO name
5. Browser: login Vercel → sto-dashboard → confirm PO → screenshots
6. `./scripts/verify_mcp_alignment.sh`
7. Report: pass counts, PO name, screenshot paths, any 13/15 stock caveats

**Do not paste real `ERPNEXT_API_KEY` / `ERPNEXT_API_SECRET` into commits, screenshots, or chat logs.**
