# Hosted MCP Validation Report

**Date:** 2026-06-01  
**Backend:** https://erpnext-production-512a.up.railway.app (Railway)  
**Frontend:** https://vercel-indol-phi-69.vercel.app (Vercel)  
**MCP Proxy:** https://vercel-indol-phi-69.vercel.app/api/mcp (streamable-http)

## Result: **15/15 PASS — 100% pass rate**

All 15 core STO+IC tools pass against the live hosted ERPNext backend, and 5/5 read-only tools verified through the Vercel MCP proxy.

## Tools Tested

### STO (Stock Transfer Order) — 8 tools
| # | Tool | Status | Detail |
|---|------|--------|--------|
| 1 | `sto_list` | PASS | 4 rows |
| 2 | `sto_create` | PASS | PUR-ORD-2026-00005 |
| 3 | `sto_submit` | PASS | docstatus=1, stage=Pending Approval |
| 4 | `sto_approve_and_route` | PASS | SO SAL-ORD-2026-00003 created, stage=Approved |
| 5 | `sto_post_goods_in_transit` | PASS | DN MAT-DN-2026-00003 created |
| 6 | `sto_create_ic_invoice` | PASS | SI+PI pair created |
| 7 | `sto_post_goods_receipt` | PASS | PR created, stage=Received |
| 8 | `sto_get_trace` | PASS | Full document tree |
| 9 | `sto_three_way_match` | PASS | matched=true, within_tolerance=true |

### IC (Intercompany Billing) — 6 tools
| # | Tool | Status | Detail |
|---|------|--------|--------|
| 10 | `ic_list_accounts` | PASS | 8 pairs |
| 11 | `ic_create_sales_invoice` | PASS | ACC-SINV-2026-00006 |
| 12 | `ic_create_purchase_invoice` | PASS | ACC-PINV-2026-00006 |
| 13 | `ic_create_invoice_pair` | PASS | ACC-SINV-2026-00007/ACC-PINV-2026-00007 |
| 14 | `ic_submit_invoice` | PASS | SI docstatus=1 |
| 15 | `ic_get_invoice_status` | PASS | Status returned |

### Vercel MCP Proxy — 5 tools verified
| # | Tool | Status | Detail |
|---|------|--------|--------|
| 1 | `ic_list_accounts` | PASS | 8 pairs via SSE |
| 2 | `sto_list` | PASS | rows via SSE |
| 3 | `sto_get_trace` | PASS | trace via SSE |
| 4 | `sto_three_way_match` | PASS | matched=true via SSE |
| 5 | `ic_get_invoice_status` | PASS | status via SSE |

## Infrastructure

### Railway Backend
- **Service:** `opulentaggro-erpnext` / `erpnext`
- **Deployment:** d8ca9520-4f91-4869-ba1b-8899287c1050 (SUCCESS)
- **URL:** https://erpnext-production-512a.up.railway.app
- **Health:** `GET /api/method/ping` → `{"message":"pong"}` HTTP 200
- **Stack:** ERPNext v15.109.1, Frappe v15, MariaDB 10.11, Redis 7, gunicorn + nginx
- **API Key:** `5b218748d06d007:b9a99536f8deac3` (Administrator)

### Vercel Frontend
- **Project:** vercel-indol-phi-69
- **URL:** https://vercel-indol-phi-69.vercel.app
- **Production deploy:** https://vercel-1yinm5a5a-opulents-projects.vercel.app
- **Health:** `GET /api/health` → `{"components":{"erpnext":{"reachable":true,"error":null}}}`
- **MCP endpoint:** `POST /api/mcp` (streamable-http, Accept: application/json+text/event-stream)

## Key Fixes Applied

### 1. Docker Overlay for `accounts/utils.py`
The `hooks.py` file references `erpnext.accounts.utils.pre_submit_validation`, but the stock ERPNext v15 Docker image from GitHub does NOT include this function. Without it, **every** Sales/Purchase/Delivery/Receipt document submit fails.

**Fix:** Added to both root `Dockerfile` and `railway/Dockerfile`:
```dockerfile
COPY --chown=frappe:frappe erpnext/erpnext/accounts/utils.py \
    /home/frappe/frappe-bench/apps/erpnext/erpnext/accounts/utils.py
RUN grep -n "def pre_submit_validation" \
    /home/frappe/frappe-bench/apps/erpnext/erpnext/accounts/utils.py \
    || (echo "BUILD MARKER MISSING: pre_submit_validation not in accounts/utils.py" && exit 1)
```

**Verification:** Function confirmed present in container (HTTP 403 "not whitelisted" proves it exists, since non-whitelisted functions return this exact error message).

### 2. PORT=80 for nginx
Railway edge proxy routes to the configured PORT. nginx is configured to listen on port 80 (hardcoded in `railway/temp_nginx.conf`).

### 3. Currency Mismatch
ERPNext requires matching currencies for intercompany transactions. The System Settings default currency was INR; set to USD via `frappe.client.set_value`:
```json
{"currency": "USD", "country": "United States", "language": "en", "time_zone": "America/New_York"}
```

### 4. Fiscal Year 2026
No fiscal year existed. Created via `frappe.client.insert` with all 3 companies.

### 5. Internal Customer/Supplier Company Lists
ERPNext validates that the internal customer is allowed to transact with the company. Each internal customer/supplier must have ALL companies in their `companies` child table.

### 6. Stock Availability
APAC warehouse had 0 stock. Added 10 units of each test item via Material Receipt stock entries.

## Environment Variables (frozen)

### Railway erpnext service
| Var | Value |
|-----|-------|
| `DB_HOST` | `mariadb.railway.internal` |
| `DB_NAME` | `railway` |
| `DB_USER` | `frappe` |
| `DB_PASSWORD` | `OpulentAggroMariaDB2026` |
| `DB_ROOT_PASSWORD` | `OpulentAggroMariaDB2026` |
| `DB_PORT` | `3306` |
| `FRAPPE_SITE_NAME` | `erpnext-production-512a.up.railway.app` |
| `FRAPPE_ADMIN_PASSWORD` | `OpulentAggro-Demo-2026!` |
| `PORT` | `80` |
| `FORCE_RECREATE_SITE` | `0` (frozen) |
| `RECREATE_SITE_ON_DB_FAILURE` | `0` (frozen) |
| `DEVELOPER_MODE` | `0` |

### Vercel production
| Var | Value |
|-----|-------|
| `NEXT_PUBLIC_ERPNEXT_URL` | `https://erpnext-production-512a.up.railway.app` |
| `ERPNEXT_URL` | `https://erpnext-production-512a.up.railway.app` |
| `ERPNEXT_API_KEY` | `5b218748d06d007` |
| `ERPNEXT_API_SECRET` | `b9a99536f8deac3` |
| `NEXT_PUBLIC_DEMO_USER` | `Administrator` |
| `NEXT_PUBLIC_APP_NAME` | `OpulentAggro` |

## Seed Data (live)

### Companies
- `Opulent Fresh NA` (OFNA, USD)
- `Opulent Fresh EU` (OFEU, USD)
- `Opulent Fresh APAC` (OFAP, USD)

### Items
- `STO-TEST-ITEM-001` (rate 100)
- `STO-TEST-ITEM-002` (rate 200)

### Internal Suppliers
- `Internal Supplier Opulent Fresh APAC` → represents APAC
- `Internal Supplier Opulent Fresh NA` → represents NA
- `Internal Supplier Opulent Fresh EU` → represents EU

### Internal Customers
- `Internal Customer Opulent Fresh APAC` → represents APAC
- `Internal Customer Opulent Fresh NA` → represents NA
- `Internal Customer Opulent Fresh EU` → represents EU

### Fiscal Year
- `2026` (Jan 1 - Dec 31, all 3 companies)

### Stock
- `Stores - OFAP`: 10 units each of both test items (submitted `MAT-STE-2026-00001/2`)

## Browser Verification

Screenshots in `docs/screenshots/hosted-mcp-validation/`:
1. `01-vercel-desk.png` — Vercel desk with document navigation
2. `02-sto-dashboard.png` — STO Dashboard
3. `03-sto-trace.png` — STO Trace
4. `04-intercompany.png` — Intercompany page
5. `05-billing.png` — IC Billing page

## Test Artifacts

- `PUR-ORD-2026-00003` → SAL-ORD-2026-00001 → MAT-DN-2026-00001 → MAT-PRE-2026-00001 → ACC-SINV-2026-00001 + ACC-PINV-2026-00001 (Three Way Matched)
- `PUR-ORD-2026-00004` → SAL-ORD-2026-00002 → MAT-DN-2026-00002 → MAT-PRE-2026-00002 → ACC-SINV-2026-00003 + ACC-PINV-2026-00003 (Completed)
- `PUR-ORD-2026-00005` → SAL-ORD-2026-00003 → MAT-DN-2026-00003 → MAT-PRE-2026-00003 → ACC-SINV-2026-00006 + ACC-PINV-2026-00006 (Completed)
- Standalone IC invoices: ACC-SINV-2026-00007/ACC-PINV-2026-00007
