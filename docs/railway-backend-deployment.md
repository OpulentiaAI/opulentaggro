# Railway Backend Deployment — OpulentAggro ERPNext

**Date:** 2026-05-31  
**Architecture:** ERPNext v15 + OpulentAggro intercompany STO module on Railway; Vercel frontend proxies to this host.

---

## Executive summary

| Component | Host | Status |
|-----------|------|--------|
| ERPNext + OpulentAggro STO | **Railway** (Docker) | Scaffold ready — CLI deploy pending `railway login` |
| MariaDB | Railway **MySQL** service (`mysql:9.4`) | `railway add --database mysql` |
| Redis | **Bundled** in `erpnext` container (free tier) | Separate Redis plugin blocked at 2-service limit; see [Database provisioning](#database-provisioning) |
| Vercel frontend | `opulents-projects/vercel` | Remote build deploy (see [Vercel section](#vercel-frontend-connection)) |

**Honest complexity note:** Frappe/ERPNext is a multi-process Python stack (web, workers, scheduler, Redis, MariaDB). Railway can run it, but first deploy typically takes **20–40 minutes** (Docker build + site creation + asset build). Use a **persistent volume** on `/home/frappe/frappe-bench/sites` for production data.

---

## Architecture

```
┌──────────────────────── Railway Project ────────────────────────┐
│  MySQL plugin          Redis plugin         erpnext service      │
│  (MariaDB 10.6)        (cache + queue)      (Dockerfile)         │
│       │                      │                    │              │
│       └────────── DB/Redis URLs via env ──────────┘              │
│                              │                                   │
│                    https://*.up.railway.app                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS + API key
                               ▼
┌──────────────────────── Vercel (vercel/) ────────────────────────┐
│  /api/health  /api/sto/*  /api/ic/*  /api/mcp                     │
│  /sto-dashboard  /sto-trace  /intercompany                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Files in this repo

| Path | Purpose |
|------|---------|
| `railway/Dockerfile` | ERPNext v15 + OpulentAggro intercompany overlay |
| `railway/entrypoint.sh` | Site bootstrap, migrate, seed, supervisor |
| `railway/supervisord.conf` | gunicorn + workers + scheduler |
| `railway/docker-compose.railway.yml` | Local validation compose |
| `railway/railway.toml` | Railway config-as-code |
| `railway/.env.example` | Env var template (no secrets) |
| `scripts/deploy-railway.sh` | One-command deploy helper |
| `scripts/generate-production-api-keys.sh` | Post-deploy API key generation |

---

## Prerequisites

1. [Railway account](https://railway.com)
2. Railway CLI: `npm i -g @railway/cli` or `brew install railway`
3. Authenticate: `railway login` then `railway whoami`
4. ~4 GB RAM recommended for ERPNext service (Railway Pro for reliable builds)

---

## Deploy steps

### 1. Create Railway project

```bash
cd "/Users/jeremyalston/Perfect/FW_  Intercompany Files"
railway init          # new project: opulentaggro-erpnext
```

### 2. Database provisioning

**Project:** `opulentaggro-erpnext` (Jeremy Alston's Projects)

| Service | Plugin / image | Role |
|---------|----------------|------|
| **MySQL** | `mysql:9.4` | MariaDB-compatible DB for Frappe (`mysql.railway.internal`) |
| **erpnext** | `railway/Dockerfile` | ERPNext v15 + OpulentAggro overlay + **bundled redis-server** |

```bash
railway link                    # select opulentaggro-erpnext
railway add --database mysql    # MariaDB-compatible (once per project)
railway service link erpnext
```

**Free tier note:** Railway Hobby allows limited services per project. A third service (standalone Redis) returns `Free plan resource provision limit exceeded`. This repo runs **Redis inside the erpnext container** (`supervisord` + `redis-server` on `127.0.0.1:6379`). Pro/Team can add `railway add --database redis` and set `REDIS_*` from `${{Redis.REDIS_URL}}` instead.

Wire MariaDB into `erpnext` via CLI (or dashboard → Variables → RAW):

```bash
railway variables --service erpnext \
  --set 'DB_HOST=${{MariaDB.RAILWAY_PRIVATE_DOMAIN}}' \
  --set 'DB_PORT=3306' \
  --set 'DB_NAME=${{MariaDB.MARIADB_DATABASE}}' \
  --set 'DB_USER=${{MariaDB.MARIADB_USER}}' \
  --set 'DB_PASSWORD=${{MariaDB.MARIADB_PASSWORD}}' \
  --set 'DB_ROOT_PASSWORD=${{MariaDB.MARIADB_ROOT_PASSWORD}}' \
  --set 'RECREATE_SITE_ON_DB_FAILURE=1' \
  --set 'REDIS_CACHE_URL=redis://127.0.0.1:6379' \
  --set 'REDIS_QUEUE_URL=redis://127.0.0.1:6379' \
  --set 'REDIS_SOCKETIO_URL=redis://127.0.0.1:6379'
```

Or use MySQL plugin references (`${{MySQL.MYSQLHOST}}`, `${{MySQL.MYSQL_URL}}`, etc.) — the entrypoint resolves `MYSQL*`, `MARIADB_*`, `DB_*`, and `MYSQL_URL`.

Config-as-code: root `railway.toml` / `railway.json` set `builder = "DOCKERFILE"` and `dockerfilePath = "railway/Dockerfile"`. Without these, Railway defaults to **Railpack** and the ERPNext image will not build.

Upload size: add root `.railwayignore` (excludes `vercel/`, most of `erpnext/erpnext/**`, keeps intercompany overlay only).

### 3. Configure environment variables

Copy `railway/.env.example` values into Railway service variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `FRAPPE_SITE_NAME` | Yes | e.g. `opulentaggro-production.up.railway.app` |
| `FRAPPE_ADMIN_PASSWORD` | Yes | Strong password for Administrator |
| `SITE_HOST` | Yes | Public Railway domain (**hostname only**, no `https://`) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Yes | From MariaDB/MySQL plugin (`${{MariaDB.*}}` or `${{MySQL.*}}`) |
| `DB_ROOT_PASSWORD` | Yes | MariaDB root (`MARIADB_ROOT_PASSWORD`) |
| `RECREATE_SITE_ON_DB_FAILURE` | No | `1` on **first boot** — recreate site when volume DB user is stale; set `0` after stable boot |
| `FORCE_RECREATE_SITE` | No | `0` (default). `1` wipes site dir on every boot (destructive) |
| `REDIS_CACHE_URL`, `REDIS_QUEUE_URL`, `REDIS_SOCKETIO_URL` | Yes | From Redis plugin (`REDIS_URL`) |
| `DEVELOPER_MODE` | No | `0` for production |
| `RUN_MCP_SEED` | No | `1` to seed MCP-aligned master data |
| `RUN_STO_TEST_SEED` | No | `1` to seed STO test fixtures |
| `WORKERS` | No | gunicorn workers (default `2`) |

### 4. Add persistent volume (required for production)

Without a volume, every redeploy starts with an empty container filesystem. The entrypoint sees no site directory, runs `bench new-site` again (~5 min), and you lose in-container site state. Worse: if a volume **partially** persists (old `site_config.json` pointing at a dropped or renamed MariaDB database) while MariaDB was reprovisioned, `RECREATE_SITE_ON_DB_FAILURE=1` triggers a drop/recreate loop on every boot until credentials align.

**Mount path (exact):**

```
/home/frappe/frappe-bench/sites
```

This directory holds `common_site_config.json`, per-site folders, `site_config.json`, and assets metadata — everything Frappe needs to reconnect to MariaDB without recreating the site.

#### Railway dashboard — step by step

1. Open [Railway dashboard](https://railway.com) → project **opulentaggro-erpnext**
2. Click the **erpnext** service (Dockerfile deploy, not MariaDB)
3. Go to **Settings** → scroll to **Volumes**
4. Click **Add Volume**
5. **Mount path:** `/home/frappe/frappe-bench/sites`
6. **Size:** start with 1 GB (increase if asset storage grows)
7. Save — Railway remounts on the **next** deploy/restart (no data migration needed on first attach)
8. Confirm in deploy logs: `[entrypoint] Site … already exists — verifying DB connectivity` (not `Creating new site`)

**Stale site / DB mismatch loop (symptoms):**

| Symptom | Cause |
|---------|-------|
| Every boot runs `Creating new site` despite volume | Volume not mounted, or mount path typo |
| Boot loops: drop site → new-site → fail → repeat | `site_config.json` references DB user/database MariaDB no longer has |
| `(1045) Access denied` from IPv6 host | Stale DB user in volume; use `RECREATE_SITE_ON_DB_FAILURE=1` **once**, then set `0` |

After the first successful boot with a healthy volume, disable auto-recreate (see [After first successful boot](#after-first-successful-boot)).

### 5. Deploy

```bash
./scripts/deploy-railway.sh
# or manually:
railway up --detach
```

**Build context:** repository root. Dockerfile path: `railway/Dockerfile`.

First boot sequence (entrypoint):

1. Wait for MySQL + Redis
2. `bench new-site` (if no site dir)
3. `bench install-app erpnext`
4. `bench migrate`
5. Optional MCP/STO seeds
6. Start gunicorn + workers via supervisor

### 6. Generate public domain

Railway → erpnext service → **Settings → Networking → Generate Domain**

Update `SITE_HOST` and `FRAPPE_SITE_NAME` to match, then redeploy.

### 7. Generate API keys

```bash
./scripts/generate-production-api-keys.sh
```

Or in ERPNext desk: **User → Administrator → API Access → Generate Keys**

Copy key + secret to Vercel (see below). **Do not commit secrets.**

---

## After first successful boot

Once deploy logs show **all** of the following, the site is stable:

- `[entrypoint] Site … already exists — verifying DB connectivity` (or migrate completed without recreate)
- `[entrypoint] Running migrate` or migrate skipped with live DB
- `[entrypoint] Starting nginx on port …` and supervisord running
- `curl …/api/method/ping` returns `{"message":"pong"}`

**Then** disable destructive bootstrap flags in Railway (not before — first boot may need recreate to fix stale volume):

```bash
railway variables --service erpnext \
  --set 'RECREATE_SITE_ON_DB_FAILURE=0' \
  --set 'FORCE_RECREATE_SITE=0'
```

No redeploy is strictly required for env-only changes, but restart the service once so the next boot uses the new values:

```bash
# Optional: trigger restart without rebuilding (dashboard → Restart, or redeploy same image)
railway redeploy --service erpnext
```

> **Do not** run the variable commands above until ping succeeds. With `RECREATE_SITE_ON_DB_FAILURE=1`, a transient MariaDB blip can drop and recreate the entire site.

Update `railway/.env.example` locally to match (`RECREATE_SITE_ON_DB_FAILURE=0`, `FORCE_RECREATE_SITE=0`) for documentation parity.

---

## Post-stable checklist (steps 5–7)

Complete these **after** ping returns pong and recreate flags are `0`:

### 5. Verify Railway ping

```bash
curl -s "https://erpnext-production-512a.up.railway.app/api/method/ping"
# Expected: {"message":"pong"}
```

### 6. Sync Vercel API keys and redeploy frontend

Copy Administrator API key + secret from Railway logs (`[entrypoint] Running Print Administrator API keys`) or `./scripts/generate-production-api-keys.sh`, then:

```bash
cd vercel
vercel env add ERPNEXT_URL production          # https://erpnext-production-512a.up.railway.app
vercel env add ERPNEXT_API_KEY production
vercel env add ERPNEXT_API_SECRET production
vercel env add NEXT_PUBLIC_ERPNEXT_URL production
vercel deploy --prod
```

Verify: `curl -s "https://vercel-indol-phi-69.vercel.app/api/health"`

### 7. Run MCP endpoint validation against production

```bash
cd "/Users/jeremyalston/Perfect/FW_  Intercompany Files"
# Set ERPNEXT_URL / API keys in config/demo-credentials.env or env
python scripts/test_all_mcp_endpoints.py --base-url "https://erpnext-production-512a.up.railway.app"
```

Or via Vercel proxy: `--base-url "https://vercel-indol-phi-69.vercel.app"` with MCP auth token if configured.

---

## Verify Railway backend

```bash
# Replace with your Railway domain
curl -s "https://YOUR-SITE.up.railway.app/api/method/ping"
curl -s "https://YOUR-SITE.up.railway.app/api/method/erpnext.intercompany.stock_transfer_order.list_stock_transfer_orders" \
  -H "Authorization: token KEY:SECRET"
```

Desk UI: `https://YOUR-SITE.up.railway.app/app/sto-dashboard`

---

## Vercel frontend connection

After Railway is live, set Vercel env vars (`opulents-projects/vercel`):

```bash
cd vercel
vercel env add ERPNEXT_URL production
vercel env add ERPNEXT_API_KEY production
vercel env add ERPNEXT_API_SECRET production
vercel env add NEXT_PUBLIC_ERPNEXT_URL production
vercel env add NEXT_PUBLIC_APP_NAME production   # OpulentAggro
vercel env add MCP_AUTH_TOKEN production           # optional
vercel deploy --prod
```

| Variable | Scope | Purpose |
|----------|-------|---------|
| `ERPNEXT_URL` | Server | Railway HTTPS URL |
| `ERPNEXT_API_KEY` | Server | API token |
| `ERPNEXT_API_SECRET` | Server | API secret |
| `NEXT_PUBLIC_ERPNEXT_URL` | Client | Desk link in nav |
| `NEXT_PUBLIC_APP_NAME` | Client | Branding |
| `MCP_AUTH_TOKEN` | Server | Bearer auth for `/api/mcp` |

Verify:

```bash
vercel curl "/api/health" --deployment production
curl -s "https://vercel-indol-phi-69.vercel.app/api/health"  # production alias
```

---

## Local validation (optional)

Test the Docker image locally before Railway:

```bash
cp railway/.env.example railway/.env
# Edit FRAPPE_ADMIN_PASSWORD

docker compose -f railway/docker-compose.railway.yml up --build
# First boot: 10–20 min. Then:
open http://localhost:8000/app/sto-dashboard
```

---

## Post-deploy seed

If seeds were skipped (`RUN_MCP_SEED=0`):

```bash
railway run bench --site "$FRAPPE_SITE_NAME" execute erpnext.intercompany.mcp_alignment_seed.run
```

Local equivalent: `./scripts/run_seed.sh`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `(1045) Access denied for user '_…'` from IPv6 host | Stale site volume: set `RECREATE_SITE_ON_DB_FAILURE=1` or `FORCE_RECREATE_SITE=1`; entrypoint recreates site with `--mariadb-user-host-login-scope='%'` |
| `NameError: name 'erpnext' is not defined` on STO seed | Fixed: `sto_test_seed.py` imports `mcp_alignment_seed` directly; ensure `erpnext/erpnext/intercompany/__init__.py` is in the image |
| `SyntaxError: invalid decimal literal` on `bench set-config host_name` | Fixed: entrypoint skips `host_name` (bench `literal_eval` rejects URLs); `use_dns_multitenant=0` is sufficient |
| Seed / API-key print fails on `database.log` PermissionError | Fixed: entrypoint creates `/home/frappe/logs` with `frappe:frappe` ownership before Python seed runner |
| `invalid port in "${PORT:-80}"` (nginx) | Fixed: nginx template uses `$PORT`; entrypoint exports `PORT=${PORT:-80}` before `envsubst` |
| `db_name=railway_` truncated in logs | Fixed: entrypoint prefers `MYSQLDATABASE` / `MARIADB_DATABASE` over `MYSQL_URL` path alias |
| `duplicate default server for 0.0.0.0:80` | Fixed in Dockerfile (removes `/etc/nginx/sites-enabled/default`) |
| Build timeout on Railway | Upgrade plan; build locally and push image to GHCR |
| Site recreated on redeploy | Add volume on `sites/` |
| 502 during first boot | Wait for asset build (check logs); healthcheck start-period is 300s |
| STO APIs 403 | Generate API keys; check user permissions |
| Vercel `/api/sto` 503 | Set `ERPNEXT_*` env vars; redeploy Vercel |
| Vercel preview 401 | Disable Deployment Protection or use `vercel curl` |

---

## Production URLs (update after deploy)

| Service | URL | Status |
|---------|-----|--------|
| Railway ERPNext | https://erpnext-production-512a.up.railway.app | **Live** after deploy `beeb3bf7` — ping `{"message":"pong"}`; later redeploys recreate site (~5 min) |
| Vercel production | [https://vercel-indol-phi-69.vercel.app](https://vercel-indol-phi-69.vercel.app) | **Live** (2026-05-31) |
| Vercel project alias | [https://vercel-opulents-projects.vercel.app](https://vercel-opulents-projects.vercel.app) | Production |

---

## Deployment status (2026-05-31)

| Item | Status |
|------|--------|
| Railway project | **opulentaggro-erpnext** linked |
| MariaDB service | **Provisioned** — `mariadb.railway.internal:3306` |
| Redis | **Bundled** in erpnext (no separate Redis service on free tier) |
| erpnext public URL | https://erpnext-production-512a.up.railway.app |
| Current deploy | **DEPLOYING** — `eb9c4ee0-6a43-4825-aac1-a9874bf602b5`; `bench new-site` DocType install ~98% (no nginx yet) |
| Prior successful ping | Yes — earlier deploy returned `{"message":"pong"}`; this redeploy recreates site |
| Entrypoint fixes (in repo, pending next deploy) | nginx `$PORT` envsubst; full `db_name` from plugin vars; `host_name` skipped; Python seed runner; `/home/frappe/logs` mkdir |
| Vercel production | https://vercel-indol-phi-69.vercel.app |
| Vercel env vars | **Updated** — sync new API keys after this deploy completes |
| Post-stable actions | Set `RECREATE_SITE_ON_DB_FAILURE=0`, `FORCE_RECREATE_SITE=0`; then steps 5–7 checklist |

---

## References

- [docs/vercel-deployment-plan.md](./vercel-deployment-plan.md)
- [docs/erpnext-sto-test-setup.md](./erpnext-sto-test-setup.md)
- [docs/erpnext-sto-mcp-setup.md](./erpnext-sto-mcp-setup.md)
- [Frappe Docker](https://github.com/frappe/frappe_docker)
- [Railway Docs](https://docs.railway.com)
