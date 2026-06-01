---
name: mcp-db-alignment
description: Keeps erpnext-mcp-server MCP tools, ERPNext whitelisted APIs, seed data, and tests aligned. Use when adding sto_* or ic_* tools, changing intercompany APIs, updating seed scripts, or verifying MCP/DB parity.
---

# MCP ↔ DB alignment

## When to load

- Adding or renaming an MCP tool (`sto_*`, `ic_*`)
- Changing `erpnext/erpnext/intercompany/*.py` whitelisted methods
- Updating `scripts/seed_mcp_alignment.py` or integration tests
- CI / local verification before merge

## Source of truth

| Layer | Path |
|-------|------|
| MCP tools | `erpnext-mcp-server/src/sto-tools.ts`, `ic-billing-tools.ts`, `create-server.ts` (generic) |
| ERPNext API | `erpnext/erpnext/intercompany/stock_transfer_order.py`, `intercompany_billing.py` |
| Tool registry | [references/tool-registry.md](references/tool-registry.md) |
| Seed data | `scripts/seed_mcp_alignment.py` |
| Mock tests | `erpnext-mcp-server/tests/*.test.mjs` |
| Live tests | `scripts/test_all_mcp_endpoints.py` |

## Checklist — new MCP tool

1. Add whitelisted method on ERPNext with matching parameter names.
2. Add tool definition + handler in `sto-tools.ts` or `ic-billing-tools.ts`.
3. Add row to [tool-registry.md](references/tool-registry.md) (tool → method → DB prereqs).
4. Extend `seed_mcp_alignment.py` if new master data is required.
5. Add mock test case in `tests/sto-tools.test.mjs` or `ic-billing-tools.test.mjs`.
6. Extend `scripts/test_all_mcp_endpoints.py` live path if applicable.
7. Run `./scripts/verify_mcp_alignment.sh`.
8. Update [erpnext-sto-mcp](../erpnext-sto-mcp/SKILL.md) if user-facing tool docs change (26 tools: 9 + 6 + 11).

## Local auth (dev only)

- `ERPNEXT_NO_AUTH=1` or `MCP_NO_AUTH=1` with `ERPNEXT_URL` on **localhost** only.
- MCP logs in via `ERPNEXT_DEV_USER` / `ERPNEXT_DEV_PASSWORD` from `config/demo-credentials.env` (aliases: `DEMO_ADMIN_*`, `FRAPPE_ADMIN_PASSWORD`).
- Production: always `ERPNEXT_API_KEY` + `ERPNEXT_API_SECRET`.

## Seed

```bash
bench --site sto.local execute scripts.seed_mcp_alignment.run
```

Idempotent; safe to re-run after schema changes.

## Verify

```bash
./scripts/verify_mcp_alignment.sh
ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py
```

## Hosted alignment (Railway production)

The Railway-hosted ERPNext is the **live alignment target**. Same registry, same tool names, same whitelisted methods — only the transport changes.

```bash
export ERPNEXT_URL=https://erpnext-production-512a.up.railway.app
export ERPNEXT_API_KEY=5b218748d06d007
export ERPNEXT_API_SECRET=b9a99536f8deac3
export STO_TEST_COMPANY='Opulent Fresh NA'
export STO_TEST_SUPPLIER='Internal Supplier Opulent Fresh APAC'
export STO_TEST_ITEM='STO-TEST-ITEM-001'
export IC_TEST_FROM_COMPANY='Opulent Fresh APAC'
export IC_TEST_TO_COMPANY='Opulent Fresh NA'

# Live alignment gate
./scripts/verify_mcp_alignment.sh
python3 scripts/test_all_mcp_endpoints.py
python3 scripts/test_hosted_mcp_e2e.py --report docs/hosted-mcp-results.json
```

**Hosted seed data (Railway, 2026-06-01):**

| Entity | Count | Names |
|--------|-------|-------|
| Companies | 3 | Opulent Fresh NA (OFNA, USD), EU (OFEU, USD), APAC (OFAP, USD) |
| Items | 2 | STO-TEST-ITEM-001 ($100), STO-TEST-ITEM-002 ($200) |
| Warehouses | 18 | Stores, Finished Goods, GIT, WIP per company (auto-created) |
| Internal Suppliers | 3 | `Internal Supplier Opulent Fresh {NA,EU,APAC}` |
| Internal Customers | 3 | `Internal Customer Opulent Fresh {NA,EU,APAC}` |
| Fiscal Year | 1 | 2026 (Jan 1 - Dec 31, all 3 companies) |
| Material Receipts | 4 | MAT-STE-2026-00001/2/3/4 (all submitted) — 51+60 units in Stores - OFAP |

**Re-seeding stock** (if `sto_post_goods_in_transit` fails with `NegativeStockError`):

```bash
python3 - <<'EOF'
import json, urllib.request
KEY, SEC = "5b218748d06d007", "b9a99536f8deac3"
BASE = "https://erpnext-production-512a.up.railway.app"
def call(m, d=None):
    r = urllib.request.Request(f"{BASE}/api/method/{m}", method="POST")
    r.add_header("Authorization", f"token {KEY}:{SEC}")
    r.add_header("Content-Type", "application/json")
    try: return json.loads(urllib.request.urlopen(r, json.dumps(d).encode(), timeout=30).read())
    except urllib.error.HTTPError as e: return json.loads(e.read())
for item, rate in [("STO-TEST-ITEM-001", 100), ("STO-TEST-ITEM-002", 200)]:
    b = call("frappe.client.insert", {"doc": {"doctype":"Stock Entry","stock_entry_type":"Material Receipt","company":"Opulent Fresh APAC","items":[{"item_code":item,"qty":50,"basic_rate":rate,"t_warehouse":"Stores - OFAP"}]}})
    n = b.get("message",{}).get("name")
    if n:
        g = call("frappe.client.get", {"doctype":"Stock Entry","name":n})
        s = call("frappe.client.submit", {"doc":g.get("message")})
        print(f"{item} +50: {n} ds={s.get('message',{}).get('docstatus')}")
EOF
```

**Hosted prerequisites that are NOT auto-seeded:**

1. `System Settings.currency = USD` (ERPNext rejects intercompany transactions when currencies differ)
2. `System Settings.setup_complete = 1` (Frappe desk embeds hang on the setup wizard otherwise)
3. `Fiscal Year 2026` (no active FY → `FiscalYearError` on stock entries)
4. Internal customer `companies` child table must include **all** counterparty companies (NA + EU + APAC)

**Latest hosted alignment result (2026-06-01):** 17/17 live endpoints PASS, `verify_mcp_alignment.sh` PASS. See [docs/hosted-mcp-validation-report.md](../../docs/hosted-mcp-validation-report.md).
