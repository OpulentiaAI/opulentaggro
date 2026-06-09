# Railway Backend Deployment

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vercel CDN    │────▶│  erpnext service  │────▶│  MariaDB plugin │
│  Next.js 15     │     │  (gunicorn+nginx) │     │  MariaDB 10.11  │
│  /api/mcp proxy │     │  ERPNext v15.109  │     │  volume: 500MB  │
│  /app/* desk    │     │  port 80 (nginx)  │     │  port 3306      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────┐
                        │  Redis   │
                        │  (in-proc│
                        │  bundled)│
                        └──────────┘
```

## Services

| Service | Type | Notes |
|---------|------|-------|
| `erpnext` | Custom Dockerfile (root `Dockerfile`) | gunicorn on 127.0.0.1:8000, nginx on :80, supervisord runs all |
| `mariadb` | Railway MariaDB plugin | 500MB volume, private domain `mariadb.railway.internal` |

## Key Configuration

### Dockerfile (active — root)
The root `Dockerfile` builds ERPNext from source with the OpulentAggro fork and overlays the local `accounts/utils.py` (which contains `pre_submit_validation` — a hook referenced from `hooks.py` but not present in upstream ERPNext v15 from GitHub).

Critical overlay lines:
```dockerfile
COPY --chown=frappe:frappe erpnext/erpnext/hooks.py \
    /home/frappe/frappe-bench/apps/erpnext/erpnext/hooks.py
COPY --chown=frappe:frappe erpnext/erpnext/accounts/utils.py \
    /home/frappe/frappe-bench/apps/erpnext/erpnext/accounts/utils.py
RUN grep -n "def pre_submit_validation" \
    /home/frappe/frappe-bench/apps/erpnext/erpnext/accounts/utils.py \
    || (echo "BUILD MARKER MISSING" && exit 1)
```

The `RUN grep` step is a build-time check that fails the build if the function is missing.

### Entrypoint (`railway/entrypoint.sh`)
1. Resolve DB credentials from `DB_*` / `MYSQL*` / `MARIADB*` env vars
2. Start bundled Redis on 127.0.0.1:6379
3. Wait for MariaDB (90 retries × 2s)
4. Write `common_site_config.json` with `db_name`, `db_host`, `redis_*`
5. If `FORCE_RECREATE_SITE=1`: drop stale DB + site dir, create fresh
6. If site doesn't exist: `bench new-site` + `install_fixtures` + `enable-scheduler`
7. If site exists and DB unreachable: if `RECREATE_SITE_ON_DB_FAILURE=1`, recreate
8. If site exists and DB OK: `bench migrate`
9. Ensure Administrator password matches `FRAPPE_ADMIN_PASSWORD`
10. Run MCP alignment seed + STO test seed
11. Print Administrator API key
12. Render nginx config (templated with `$PORT` from env, default 80)
13. Start supervisord (manages gunicorn workers + scheduler + redis)

### railway.json (root — active)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "healthcheckTimeout": 1800,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 1,
    "numReplicas": 1
  }
}
```

**`healthcheckTimeout: 1800` (30 min)** is required because the first deploy takes 3-5 minutes for DocType migrations.

**`restartPolicyType: "ON_FAILURE"`** with 1 retry handles transient Docker push failures without infinite restart loops.

## Environment Variables

### Required
| Var | Value | Purpose |
|-----|-------|---------|
| `DB_HOST` | `mariadb.railway.internal` | MariaDB private domain |
| `DB_NAME` | `railway` | Database name (from Railway plugin) |
| `DB_USER` | `frappe` | DB user (must match `MARIADB_USER`) |
| `DB_PASSWORD` | `OpulentAggroMariaDB2026` | DB password |
| `DB_ROOT_PASSWORD` | `OpulentAggroMariaDB2026` | MariaDB root password |
| `FRAPPE_SITE_NAME` | `erpnext-production-512a.up.railway.app` | Site hostname |
| `FRAPPE_ADMIN_PASSWORD` | `OpulentAggro-Demo-2026!` | Administrator password |
| `PORT` | `80` | nginx port (Railway edge routes here) |

### Bootstrap (set to 0 after first successful deploy)
| Var | Default | Purpose |
|-----|---------|---------|
| `FORCE_RECREATE_SITE` | `0` | If 1, drops site dir + DB before create |
| `RECREATE_SITE_ON_DB_FAILURE` | `1` | If 1, recreates site when DB ping fails |

### Optional
| Var | Default | Purpose |
|-----|---------|---------|
| `DEVELOPER_MODE` | `0` | Frappe developer mode |
| `MARIADB_USER` | `frappe` | MariaDB image creates this user |
| `MARIADB_PASSWORD` | `OpulentAggroMariaDB2026` | MariaDB image sets this password |
| `MARIADB_DATABASE` | `railway` | MariaDB image creates this database |

**Note:** The `MARIADB_*` vars are used by the MariaDB Docker image to initialize the user/DB. The `DB_*` vars are used by the Frappe entrypoint to connect. They must agree.

## Volumes

| Service | Mount | Size | Purpose |
|---------|-------|------|---------|
| `mariadb` | `/var/lib/mysql` | 500MB | MariaDB data directory |
| `erpnext` | `/var/log/nginx`, `/var/lib/nginx` | ephemeral | nginx logs and temp files |

## Volumes are NOT used for the Frappe site
The site directory (`/home/frappe/frappe-bench/sites/<site>`) lives on the container filesystem. On redeploy, the site is recreated from the entrypoint. This is intentional: it guarantees a clean, reproducible state.

For production with persistent data, add a Railway volume mounted to `/home/frappe/frappe-bench/sites` and set `RECREATE_SITE_ON_DB_FAILURE=0` after first deploy.

## Seed Data

The entrypoint runs two seeds after site creation:

1. `scripts/seed_mcp_alignment.py` → `erpnext/intercompany/mcp_alignment_seed.py`
   - Aligns DocType fields, custom fields, and workspace shortcuts for MCP tools

2. `scripts/seed_sto_test_data.py` → `erpnext/intercompany/sto_test_seed.py`
   - Creates test companies, items, warehouses, and IC party pairs

If seeds fail, the entrypoint logs "seed failed or partial" and continues — the site is still usable.

## API Authentication

The entrypoint generates an Administrator API key/secret after site creation. This is printed to the deployment logs:

```
[INFO]  api_key="..." api_secret="..."
```

To regenerate:
```bash
railway ssh --service erpnext
bench --site $SITE execute frappe.core.doctype.user.user.generate_keys --kwargs '{"user":"Administrator"}'
```

## Common Operations

### Trigger a redeploy
```bash
railway up --service erpnext --detach
```

### Force a fresh site
```bash
railway variables --service erpnext --set "FORCE_RECREATE_SITE=1" --skip-deploys
railway up --service erpnext --detach
# After first successful deploy, freeze:
railway variables --service erpnext --set "FORCE_RECREATE_SITE=0" --set "RECREATE_SITE_ON_DB_FAILURE=0" --skip-deploys
```

### Check health
```bash
curl -s https://erpnext-production-512a.up.railway.app/api/method/ping
# {"message":"pong"}
```

### View logs
```bash
railway logs --service erpnext --lines 500
```

### Connect to MariaDB
```bash
railway connect mariadb
mysql -u root -p
```

## Troubleshooting

### "Unknown database 'railway'"
The MariaDB volume was initialized but the database was dropped (e.g., by `FORCE_RECREATE_SITE`). The `bench new-site` command should recreate it. If not, manually:
```bash
railway ssh --service erpnext
mysql -h mariadb.railway.internal -uroot -p$DB_ROOT_PASSWORD -e "CREATE DATABASE railway; GRANT ALL ON railway.* TO 'frappe'@'%'; FLUSH PRIVILEGES;"
bench --site $SITE reinstall --yes
```

### "Access denied for user 'railway'"
The `common_site_config.json` was written with a stale `db_user`. The site was created with the wrong user. Fix: set `FORCE_RECREATE_SITE=1` and redeploy.

### "pre_submit_validation not in accounts/utils.py"
The Dockerfile overlay wasn't applied. Check the build logs for the `RUN grep` marker. If missing, the COPY line failed — verify `erpnext/erpnext/accounts/utils.py` exists in the repo.

### NegativeStockError
The source warehouse has 0 stock. Add a Material Receipt stock entry:
```bash
bench --site $SITE execute erpnext.stock.doctype.stock_entry.stock_entry_utils.make_stock_entry \
  --kwargs '{"company":"Opulent Fresh APAC","item_code":"STO-TEST-ITEM-001","to_warehouse":"Stores - OFAP","qty":10,"rate":100,"purpose":"Material Receipt"}'
```

On every Railway boot, `hosted_prereqs.py` (from `scripts/ensure_hosted_prereqs.py`) idempotently sets `setup_complete=1`, ensures Fiscal Year 2026, and tops up `Stores - OFAP` stock when below 50 units.

### setup_complete / embed wizard
Fresh sites call `frappe.client.set_value` for `System Settings.setup_complete` during `create_site`, and `hosted_prereqs.py` re-applies it on every boot.

### API token 401 — "Encryption key is invalid"
Frappe encrypts `User.api_secret` with `encryption_key` in `sites/<site>/site_config.json`. If `attach_existing_site` rebuilds the site directory without preserving that key, token auth fails while session login still works.

**Prevention (entrypoint):** `read_preserved_encryption_key` reads the key from the existing `site_config.json`, `private/.encryption_key` backup, or `FRAPPE_ENCRYPTION_KEY` env before rewriting config. `persist_encryption_key_backup` writes the key back to the volume after attach.

**Recovery after a bad deploy:**
```bash
railway ssh --service erpnext
bench --site $SITE execute frappe.core.doctype.user.user.generate_keys --args '["Administrator"]'
# Copy api_key/api_secret from logs or print_admin_api_keys.py output
```
Sync new values to Vercel: `ERPNEXT_API_KEY` and `ERPNEXT_API_SECRET` (production scope), then redeploy Vercel.

Optional: set `FRAPPE_ENCRYPTION_KEY` in Railway if you mount a persistent sites volume and need a stable key across full volume loss.

### FiscalYearError
No active Fiscal Year for the company date. Create one:
```bash
bench --site $SITE execute frappe.client.insert --kwargs '{"doc":{"doctype":"Fiscal Year","year":"2026","year_start_date":"2026-01-01","year_end_date":"2026-12-31","companies":[{"company":"Opulent Fresh NA"},{"company":"Opulent Fresh EU"},{"company":"Opulent Fresh APAC"}]}}'
```
