# Intercompany STO — Test & Database Setup

**Workspace:** `/Users/jeremyalston/Perfect/FW_  Intercompany Files/` (note **two spaces** after `FW_`)

Related: [erpnext-sto-mcp-setup.md](./erpnext-sto-mcp-setup.md)

## Quick start (visible local stack)

0. **Copy demo credentials** (one-time):

   ```bash
   cp config/demo-credentials.env.example config/demo-credentials.env
   # Edit passwords if needed; scripts require this file.
   ```

1. **Start infra + bench** (from workspace root; bench lives at `STO_BENCH_PATH` / `frappe-bench` symlink):

   ```bash
   ./scripts/start_all.sh
   ```

2. **Open the desk in a browser** (macOS):

   ```bash
   open http://localhost:8000
   open http://localhost:8000/app/sto-dashboard
   ```

   Login: **Administrator** / password from `config/demo-credentials.env` (`DEMO_ADMIN_PASSWORD`).

   After changing the demo password, sync the site once:

   ```bash
   ./scripts/set_demo_admin_password.sh
   ```

3. **Seed MCP-aligned master data** (includes desk pages):

   ```bash
   ./scripts/run_seed.sh
   ```

   This syncs `seed_mcp_alignment.py` into bench, installs STO desk pages (`sto-dashboard`, `sto-trace`, Intercompany workspace), and seeds NA/EU/APAC company pairs.

4. **Build and run MCP** (Cursor uses `.cursor/mcp.json`; stdio server):

   ```bash
   cd erpnext-mcp-server && npm run build
   ERPNEXT_NO_AUTH=1 ./scripts/run_mcp_server.sh
   ```

   If Homebrew `node` fails with `libsimdjson.30.dylib`, use NVM Node 20 (`MCP_NODE=~/.nvm/versions/node/v20.19.0/bin/node`) or put that Node first on `PATH`.

5. **Verify alterations** (same whitelisted methods the MCP tools call):

   ```bash
   ERPNEXT_NO_AUTH=1 python3 scripts/test_mcp_alterations.py
   ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py
   ```

   For mock + live: `PATH="$HOME/.nvm/versions/node/v20.19.0/bin:$PATH" ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py`

6. **Browser E2E** (MCP stdio create → verify in desk UI):

   ```bash
   # One-time: npx playwright install chromium (or agent-browser install)
   # If agent-browser fails on libsimdjson/1208 mismatch, the script symlinks Playwright 1200→1208
   ERPNEXT_NO_AUTH=1 ./scripts/test_mcp_browser_e2e.sh
   ```

   Manual browser checks: login with credentials from `config/demo-credentials.env` → `/app/sto-dashboard` (STO list + stage badges) → `/app/intercompany` workspace. After API or MCP calls, refresh the dashboard to see new PO rows.

---


## Local values (dev — copy from `config/demo-credentials.env`)

All secrets live in gitignored `config/demo-credentials.env`. Examples are committed as `config/demo-credentials.env.example`. Root `.env` holds optional non-secret overrides only; scripts load credentials via `scripts/load_env.sh`.

| Setting | Value |
|---------|-------|
| **Workspace** | `/Users/jeremyalston/Perfect/FW_  Intercompany Files/` (two spaces after `FW_`) |
| **Credentials file** | `config/demo-credentials.env` (required) |
| **MariaDB host** | `127.0.0.1` |
| **MariaDB port** | `3306` |
| **MariaDB database** | `frappe` |
| **MariaDB user** | `frappe` |
| **MariaDB password** | `frappe_dev` |
| **MariaDB root password** | `sto_root_dev` |
| **Redis cache** | `redis://127.0.0.1:6379` |
| **Redis queue** | `redis://127.0.0.1:6380` |
| **Redis socketio** | `redis://127.0.0.1:6379` (same as cache) |
| **Frappe site name** | `sto.local` |
| **Site URL** | `http://localhost:8000` (bench default) |
| **Optional host alias** | `http://sto.local:8000` — add `127.0.0.1 sto.local` to `/etc/hosts` |
| **Desk admin user** | `Administrator` (`DEMO_ADMIN_USER`) |
| **Desk admin password** | See `DEMO_ADMIN_PASSWORD` in `config/demo-credentials.env` |
| **ERPNEXT_URL** | `http://localhost:8000` |
| **ERPNEXT_API_KEY / SECRET** | In `config/demo-credentials.env`; generate on site if empty |

**Env file locations**

| File | Purpose |
|------|---------|
| `config/demo-credentials.env` | **All local secrets** — desk, DB, Redis, API keys, STO test overrides |
| `config/demo-credentials.env.example` | Tracked template (no real secrets) |
| `.env` | Optional non-secret overrides (`ERPNEXT_NO_AUTH`, etc.) |
| `docker/.env` | Deprecated — `start_infra.sh` loads demo-credentials instead |
| `erpnext-mcp-server/.env` | Optional MCP flags only; secrets from demo-credentials |
| `config/bench/common_site_config.json` | Template for `sites/common_site_config.json` |
| `config/bench/site_config.sto.local.json.template` | Per-site template after `bench new-site` |

**Quick start infra**

```bash
./scripts/start_infra.sh    # Homebrew Redis :6379 + local queue :6380 + Docker MariaDB when daemon runs
# Or: cd docker && docker compose --env-file .env up -d mariadb
```

### Service status (last checked: 2026-05-31)

| Service | Status | Notes |
|---------|--------|-------|
| Redis cache `:6379` | **Running** | Homebrew `redis` service |
| Redis queue `:6380` | **Running** | `scripts/start_infra.sh` or local `redis-server` |
| MariaDB `:3306` | **Running** | Homebrew MariaDB (Docker optional via `./scripts/start_infra.sh`) |
| Frappe bench / ERPNext | **Running** | Bench at `/Users/jeremyalston/Perfect/sto-frappe-bench` (symlink: workspace `frappe-bench/`) |
| Site `sto.local` | **Running** | `http://localhost:8000` — `./scripts/start_all.sh` |
| MCP server | **Built** | `./scripts/run_mcp_server.sh` — Cursor `.cursor/mcp.json` → `erpnext-sto` |
| STO API tests | **PASS** | `python3 scripts/test_sto_api.py` (loads demo-credentials) |
| MCP endpoint tests | **PASS** | `ERPNEXT_NO_AUTH=1 python3 scripts/test_all_mcp_endpoints.py` (17/17) |
| Browser E2E | **PASS** | `./scripts/test_mcp_browser_e2e.sh` — MCP stdio + agent-browser |

**Bench path note:** `bench init` inside the workspace folder fails because of spaces in `FW_  Intercompany Files`. Use `BENCH_DIR` from `config/demo-credentials.env`. ERPNext app is v15 from bench init (STO API compatible); workspace fork `erpnext/` is `17.0.0-dev` — use `sto-erpnext-fork` symlink when upgrading to develop bench.

**Daily commands:** `./scripts/start_all.sh` · `./scripts/stop_all.sh`

---

## 1. Database infrastructure (Docker)

MariaDB and Redis for a local Frappe bench. This does **not** install ERPNext by itself — you still need `bench init` + `bench new-site` on the host (or in a dev container).

### Start services

```bash
./scripts/start_infra.sh
# Or manually:
cd docker
cp ../config/demo-credentials.env.example ../config/demo-credentials.env   # if not done
docker compose up -d mariadb   # Redis :6379 often = Homebrew; see § Local values
docker compose ps
```

If port `6379` is already used (Homebrew Redis), start **MariaDB only** as above. Queue Redis on `6380` is started by `start_infra.sh` when not using Docker.

### Connection info (defaults)

| Service | Host | Port | User | Password | Database |
|---------|------|------|------|----------|----------|
| MariaDB | `127.0.0.1` | `3306` | `frappe` | `frappe_dev` | `frappe` |
| Redis (cache) | `127.0.0.1` | `6379` | — | — | — |
| Redis (queue) | `127.0.0.1` | `6380` | — | — | — |

Root password: `sto_root_dev` (override via `STO_MYSQL_ROOT_PASSWORD` in `docker/.env`).

### Stop / reset

```bash
cd docker
docker compose down          # keep data
docker compose down -v       # wipe MariaDB volume
```

---

## 2. Frappe bench + ERPNext site (host)

Prerequisites: Python 3.11+, Node 18+, yarn, bench CLI.

```bash
# Install bench (once)
pip install frappe-bench

# Create bench linked to Docker MariaDB/Redis
bench init frappe-bench --frappe-branch version-15
cd frappe-bench

bench get-app erpnext --branch version-15
bench get-app "/Users/jeremyalston/Perfect/FW_  Intercompany Files/erpnext" --overwrite

bench new-site sto.local \
  --db-root-password sto_root_dev \
  --admin-password "$(grep '^DEMO_ADMIN_PASSWORD=' config/demo-credentials.env | cut -d= -f2-)" \
  --mariadb-user-host-login-scope='%' \
  --db-host 127.0.0.1 \
  --db-port 3306

bench --site sto.local install-app erpnext
bench --site sto.local set-config redis_cache "redis://127.0.0.1:6379"
bench --site sto.local set-config redis_queue "redis://127.0.0.1:6380"
bench --site sto.local set-config redis_socketio "redis://127.0.0.1:6379"

# Mount seed script into bench apps path or copy scripts/ into a custom app
bench --site sto.local execute scripts.seed_sto_test_data.run  # after adding to PYTHONPATH

bench start
```

Site URL: `http://localhost:8000` (default bench port).

### API credentials

1. Desk → User → API Access → Generate Keys
2. Export:

```bash
export ERPNEXT_URL=http://localhost:8000
export ERPNEXT_API_KEY=your_key
export ERPNEXT_API_SECRET=your_secret
```

---

## 3. Seed master data

Script: `scripts/seed_sto_test_data.py`

Creates:

- Companies: **Opulent Fresh NA**, **Opulent Fresh EU** (USD)
- Internal supplier/customer pair for intercompany PO/SO
- Item `STO-TEST-ITEM-001`, Standard Selling price list
- Warehouses: Stores + **GIT In Transit** on sender company

Run (from bench, after wiring script into site Python path):

```bash
bench --site sto.local console
>>> from scripts.seed_sto_test_data import run
>>> run()
```

---

## 4. Running tests

### A. MCP STO tools (mock — no ERPNext required)

```bash
cd erpnext-mcp-server
npm install
npm run build
node tests/sto-tools.test.mjs
```

### B. STO API integration (live site)

```bash
export ERPNEXT_URL=http://localhost:8000
export ERPNEXT_API_KEY=...
export ERPNEXT_API_SECRET=...

python3 scripts/test_sto_api.py              # full workflow
python3 scripts/test_sto_api.py --list-only  # list endpoint only
```

### C. ERPNext unit tests (requires bench site)

```bash
cd frappe-bench
bench --site sto.local run-tests erpnext.intercompany.test_stock_transfer_order
```

### D. All local checks (no live site)

```bash
./scripts/run_sto_tests.sh
```

---

## 5. Test results (2026-05-31)

Environment at test time:

- **Docker daemon:** not running (`Cannot connect to the Docker daemon`) — MariaDB/Redis containers not started
- **Frappe bench:** not installed on host — live ERPNext API tests **SKIP**
- **MCP mock tests:** all **PASS** (see timings below)

### MCP tools (mock client) — measured response times

| MCP Tool | API Method | Status | ms |
|----------|------------|--------|-----|
| `sto_create` | `create_stock_transfer_order` | **PASS** | 0.5 |
| `sto_submit` | `submit_stock_transfer_order` | **PASS** | 0.3 |
| `sto_approve_and_route` | `approve_and_route_stock_transfer` | **PASS** | (in chain 0.5) |
| `sto_post_goods_in_transit` | `post_goods_in_transit` | **PASS** | (in chain) |
| `sto_create_ic_invoice` | `create_intercompany_invoice` | **PASS** | (in chain) |
| `sto_post_goods_receipt` | `post_stock_transfer_receipt` | **PASS** | (in chain) |
| `sto_get_trace` | `get_stock_transfer_trace` | **PASS** | (in chain) |
| `sto_three_way_match` | `run_stock_transfer_three_way_match` | **PASS** | (in chain) |
| `sto_list` | `list_stock_transfer_orders` | **PASS** | 0.1 |

Full workflow mock chain (all 9 tools): **PASS** in 0.5ms total handler time.

### ERPNext API (live)

| API Method | MCP Tool | Status | Response time |
|------------|----------|--------|---------------|
| All 9 methods | (see above) | **SKIP** | N/A — no site / credentials |

Re-run after stack is up:

```bash
export ERPNEXT_URL=http://localhost:8000 ERPNEXT_API_KEY=... ERPNEXT_API_SECRET=...
python3 scripts/test_sto_api.py
```

---

## 6. Performance / reactivity fixes

| Issue | Fix |
|-------|-----|
| `list_stock_transfer_orders` loaded full PO via `frappe.get_doc` per row (N+1) | Uses `_PoStageContext` with list fields only |
| List ran three-way match per row when all IC docs exist | `quick=True` on list returns **Reconciliation Pending** instead of running match |
| Unbounded list size | `limit` capped at 100 |
| Stage omitted by default on list | `include_stage=0` default — trace page uses `get_stock_transfer_trace` for full stage |

Desk UI pages (`sto-dashboard`, `sto-trace`, Intercompany workspace) are installed via `./scripts/install_sto_desk.sh` (called from `run_seed.sh`).

---

## 7. Environment variables

See **§ Local values** for concrete dev defaults. Full list:

| Variable | Purpose | Local default |
|----------|---------|---------------|
| `ERPNEXT_URL` | ERPNext base URL for API + MCP | `http://localhost:8000` |
| `ERPNEXT_API_KEY` | Token key | *(empty until generated on site)* |
| `ERPNEXT_API_SECRET` | Token secret | *(empty until generated on site)* |
| `STO_TEST_COMPANY` | Override receiving company in integration tests | `Opulent Fresh NA` |
| `STO_TEST_SUPPLIER` | Override internal supplier | `Internal Supplier Opulent Fresh EU` |
| `STO_TEST_ITEM` | Override item code | `STO-TEST-ITEM-001` |
| `STO_MYSQL_HOST` | MariaDB host | `127.0.0.1` |
| `STO_MYSQL_PORT` | MariaDB port | `3306` |
| `STO_MYSQL_DATABASE` | Database name | `frappe` |
| `STO_MYSQL_USER` | DB user | `frappe` |
| `STO_MYSQL_PASSWORD` | DB user password | `frappe_dev` |
| `STO_MYSQL_ROOT_PASSWORD` | Root password for `bench new-site` | `sto_root_dev` |
| `STO_REDIS_CACHE_URL` | Frappe cache | `redis://127.0.0.1:6379` |
| `STO_REDIS_QUEUE_URL` | Background jobs | `redis://127.0.0.1:6380` |
| `STO_REDIS_SOCKETIO_URL` | Socket.IO | `redis://127.0.0.1:6379` |
| `FRAPPE_SITE_NAME` | Site name | `sto.local` |
| `DEMO_ADMIN_USER` | Desk login user | `Administrator` |
| `DEMO_ADMIN_PASSWORD` | Desk login password | *(see demo-credentials.env)* |
| `FRAPPE_ADMIN_PASSWORD` | Alias for bench `new-site` / login | *(same as DEMO_ADMIN_PASSWORD)* |
| `ERPNEXT_DEV_USER` / `ERPNEXT_DEV_PASSWORD` | MCP no-auth session login | *(same as demo admin)* |

---

## 8. Resolved blockers (2026-05-31)

| Blocker | Resolution |
|---------|------------|
| Homebrew `node` / `libsimdjson.30.dylib` | NVM Node v22 on PATH; `run_mcp_server.sh` falls back to NVM |
| `bench execute scripts.seed_mcp_alignment.run` | Use `./scripts/run_seed.sh` (copies into `erpnext.intercompany.mcp_alignment_seed`) |
| Docker not running | Homebrew MariaDB on `:3306` works |
| STO desk pages 404 | `./scripts/install_sto_desk.sh` imports Page + Workspace records |
| agent-browser Playwright 1208 mismatch | Symlink `chromium_headless_shell-1200` → `-1208` (see E2E script) |

Remaining optional: generate API keys for non–no-auth MCP; Docker MariaDB if you prefer containers over Homebrew.

---

## 9. MCP server config (reminder)

```json
{
  "mcpServers": {
    "erpnext-sto": {
      "command": "node",
      "args": ["/Users/jeremyalston/Perfect/FW_  Intercompany Files/erpnext-mcp-server/build/index.js"],
      "env": {
        "ERPNEXT_URL": "http://localhost:8000",
        "ERPNEXT_API_KEY": "your-api-key",
        "ERPNEXT_API_SECRET": "your-api-secret"
      }
    }
  }
}
```
