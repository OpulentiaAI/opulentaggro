# Vercel Deployment Plan — OpulentAggro ERPNext + MCP Server

**Date:** 2026-06-01 (updated — hosted validation pass, prod URLs live)
**Workspace:** `erpnext/` (OpulentAggro fork), `erpnext-mcp-server/`, `vercel/` (gateway scaffold)
**Production:** https://vercel-indol-phi-69.vercel.app (Vercel), https://erpnext-production-512a.up.railway.app (Railway)

---

## Executive summary

| Component | Deploy to Vercel? | Recommended host |
|-----------|-------------------|------------------|
| **OpulentAggro ERPNext (full app)** | **No** | Frappe Cloud, Railway, Render, VPS, or local bench |
| **ERPNext MCP server (stdio)** | **No** (as-is) | Cursor/Claude Desktop local, or HTTP adapter on Vercel |
| **MCP HTTP gateway** | **Yes** | `vercel/` project — `/api/mcp` |
| **STO list / health proxy** | **Yes** | `vercel/` — `/api/sto`, `/api/health` |
| **Marketing / docs static site** | **Yes** | `vercel/public/` or separate docs site |
| **Next.js STO dashboard shell** | **Yes (full desk UI)** | `vercel/` — `/app/*` desk, lists, forms, STO/IC |

**Recommended architecture (Option A + C):**

```
┌─────────────────────┐     HTTPS API token      ┌──────────────────────────┐
│  Vercel (vercel/)   │ ───────────────────────► │  ERPNext (persistent)    │
│  /api/mcp           │                          │  Frappe Cloud / Railway  │
│  /api/sto           │                          │  MariaDB + Redis + workers│
│  /api/health        │                          │  OpulentAggro desk UI    │
└─────────────────────┘                          └──────────────────────────┘
         ▲
         │ MCP Streamable HTTP (Cursor, agents)
         │
   AI clients / MCP Inspector
```

---

## Reality check: what CAN vs CANNOT run on Vercel

### Cannot run on Vercel

1. **Frappe bench / ERPNext application**
   - Python WSGI app with long-lived processes
   - Requires **MariaDB/MySQL**, **Redis** (cache, queue, Socket.IO)
   - Background workers: `bench worker`, scheduler, email queue
   - Asset builds (`bench build`), migrations, file storage on disk
   - Vercel serverless: stateless, max ~300s (800s Pro), no persistent workers

2. **MCP stdio transport**
   - Cursor/Claude spawn a subprocess with stdin/stdout
   - Vercel has no persistent stdio — requires **HTTP/SSE or Streamable HTTP** adapter

3. **Localhost dev auth (`ERPNEXT_NO_AUTH=1`)**
   - Session cookie login only allowed for localhost
   - Vercel must use **API key + secret** against a **public HTTPS** ERPNext URL

### Can run on Vercel

1. **MCP Streamable HTTP gateway** (stateless mode)
   - One transport + server instance per request (MCP SDK `WebStandardStreamableHTTPServerTransport`)
   - Proxies tool calls to remote ERPNext via REST

2. **Health and STO proxy endpoints**
   - Thin serverless functions calling whitelisted ERPNext methods

3. **Static landing / documentation**
   - `vercel/public/index.html` and `docs/`

4. **Full Next.js desk shell** (implemented)
   - Desk UI at `/app/*` — workspaces, generic list/form views, STO trace actions, IC billing
   - Proxies all ERPNext REST via `/api/resource/*` and `/api/method/*`
   - Does not replace Frappe Python runtime, workers, or native desk JS

---

## Architecture options

### Option A — MCP on Vercel + ERPNext elsewhere (recommended)

| Layer | Host | Notes |
|-------|------|-------|
| ERPNext + OpulentAggro | Frappe Cloud / Railway / VPS | Primary system of record |
| MCP HTTP | Vercel `vercel/` | `/api/mcp` with Bearer token |
| Agents | Cursor, MCP Inspector, custom clients | Point URL at Vercel deployment |

**Pros:** Agents get a stable HTTPS MCP endpoint; ERPNext stays on a proper Frappe stack.  
**Cons:** Extra hop latency; MCP sessions are stateless on Vercel (no long-lived SSE across instances without Redis/KV).

### Option B — Full Next.js desk on Vercel (implemented)

Next.js App Router app in `vercel/app/` with Pierre theme and Frappe-like desk shell:

| Route | Purpose |
|-------|---------|
| `/` | Landing → links to desk |
| `/app` | Desk home (workspace shortcuts) |
| `/app/intercompany` | Intercompany workspace |
| `/app/sto-dashboard` | STO list + stage summary |
| `/app/sto-trace` | Document chain + workflow action buttons |
| `/app/intercompany/billing` | IC invoice pair creation |
| `/app/[doctype]` | Generic DocType list (REST proxy) |
| `/app/[doctype]/[name]` | Generic DocType form |
| `/login` | ERPNext session auth |

Pages fetch via `lib/erpnext/fetch-client.ts` and `lib/erpnext/resource.ts` (RSC + React.cache). Generic proxies at `/api/resource/*` and `/api/method/*`.

**Use when:** OpulentAggro is the primary user-facing UI; Railway hosts API only.

**Not replicated:** Full Frappe form UX, reports, print, file manager, permissions UI, background workers.

### Option C — Static marketing/docs on Vercel; app on Frappe Cloud

| Vercel | Persistent host |
|--------|-----------------|
| `docs/`, landing pages, MCP gateway | Full OpulentAggro ERPNext |

**Use when:** Public-facing site and agent tooling are separate from ERP operations.

---

## MCP server on Vercel — implementation

### Code layout (Next.js App Router)

```
vercel/
├── app/
│   ├── layout.tsx, page.tsx, globals.css   # Pierre theme
│   ├── sto-dashboard/page.tsx              # RSC STO list
│   ├── sto-trace/page.tsx                  # RSC trace + client search
│   ├── intercompany/page.tsx               # IC account pairs
│   └── api/
│       ├── health/route.ts
│       ├── mcp/route.ts                    # Streamable HTTP MCP (maxDuration 60)
│       ├── sto/route.ts                    # GET list (backward compat)
│       ├── sto/trace/route.ts              # GET trace
│       ├── sto/[action]/route.ts           # POST MCP-equivalent STO methods
│       ├── ic/accounts/route.ts            # GET IC pairs
│       └── ic/[action]/route.ts            # POST MCP-equivalent IC methods
├── components/                             # Server + client UI
├── lib/
│   ├── erpnext/fetch-client.ts             # Edge-compatible ERPNext client
│   ├── sto/handlers.ts                     # React.cache() STO queries
│   ├── ic/handlers.ts                      # React.cache() IC queries
│   ├── types/sto.ts, ic.ts, api.ts         # Shared with MCP tool shapes
│   ├── route-map.ts                        # Desk → Vercel route mapping
│   └── mcp-handler.ts
├── vendor/erpnext-mcp-server/              # Synced via scripts/sync-mcp-vendor.sh
├── next.config.ts
├── vercel.json
└── package.json
```

Refactor in `erpnext-mcp-server/`:
- `src/erpnext-client.ts` — ERPNext REST client
- `src/create-server.ts` — MCP server factory (shared by stdio + HTTP)
- `src/index.ts` — stdio entry (unchanged behavior for local Cursor)

### Transport

- **Protocol:** MCP Streamable HTTP (2025-11-25)
- **Mode:** Stateless (`sessionIdGenerator: undefined`) — suitable for serverless
- **SDK:** `@modelcontextprotocol/sdk` → `WebStandardStreamableHTTPServerTransport`

### Client configuration (Cursor / MCP Inspector)

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

(Exact Cursor remote MCP config field names may vary by version — use MCP Inspector or Streamable HTTP client for validation.)

### `vercel.json` highlights

- `framework: nextjs` — App Router build via `next build`
- CORS headers for browser-based MCP clients on `/api/mcp`
- MCP `maxDuration: 60` set in `app/api/mcp/route.ts` segment config

### Session / scaling caveats

| Mode | Vercel fit |
|------|------------|
| Stateless (current) | Good — new server per request |
| Stateful SSE sessions | Needs **Upstash Redis** or **Vercel KV** to share transport state across instances |
| Long SSE streams | Possible up to `maxDuration`; prefer stateless JSON responses for simple tools |

For production MCP with resumable SSE, deploy MCP to **Railway/Fly.io** (persistent Node process) instead of Vercel, or add Redis-backed session store.

---

## ERPNext on Vercel — honest assessment

**Full OpulentAggro ERPNext cannot run on Vercel.**

Minimum persistent stack:

| Service | Purpose |
|---------|---------|
| MariaDB 10.6+ | Frappe database |
| Redis | cache, queue, realtime |
| `bench serve` / gunicorn | web |
| `bench worker` | async jobs |
| `bench schedule` | cron |

### Recommended ERPNext hosting paths

1. **Frappe Cloud** — managed bench, easiest for ERPNext v15/v16
2. **Railway / Render** — Docker Compose with MariaDB + Redis + bench (see `docs/erpnext-sto-test-setup.md`)
3. **VPS** — existing `sto-frappe-bench` at `/Users/jeremyalston/Perfect/sto-frappe-bench`
4. **Hybrid:** keep dev on local bench; point Vercel MCP at a tunnel (ngrok) or staging URL for demos only

### Optional Vercel STO shell — now implemented

The Next.js app renders STO dashboard, trace, and IC billing views. Users performing DoA approval or stock postings should use the **hosted desk** at `NEXT_PUBLIC_ERPNEXT_URL/app/sto-dashboard` or MCP tools.

### Vercel React best practices applied

| Rule | Implementation |
|------|----------------|
| `server-cache-react` | `React.cache()` on `getStoList`, `getStoTrace`, `getIcAccounts` |
| `async-suspense-boundaries` | Suspense on dashboard, trace, intercompany pages |
| `async-parallel` | Health check uses single connectivity probe (no serial fan-out) |
| `server-serialization` | Server components pass minimal props; trace search is isolated client component |
| `bundle-barrel-imports` | Direct `@/components/*` and `@/lib/*` imports |
| `rendering-content-visibility` | STO table rows use `content-visibility: auto` |
| `bundle-dynamic-imports` | `optimizePackageImports` for erpnext-mcp-server in next.config |

---

## Environment variables (Vercel)

Set via `vercel env add` in `vercel/` (project `opulents-projects/vercel`). Map from Railway + ERPNext desk:

| Vercel variable | Source | Scope (2026-05-31) |
|-----------------|--------|---------------------|
| `ERPNEXT_URL` | Railway public domain, e.g. `https://erpnext-production-512a.up.railway.app` | Production, Preview, Development |
| `NEXT_PUBLIC_ERPNEXT_URL` | Same as `ERPNEXT_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_NAME` | Literal `OpulentAggro` | Production, Preview, Development |
| `ERPNEXT_API_KEY` | ERPNext desk → User → Administrator → API Access (on **Railway site**, not localhost) | Production, Preview, Development |
| `ERPNEXT_API_SECRET` | Same | Production, Preview, Development |
| `MCP_AUTH_TOKEN` | Optional; `openssl rand -base64 32` | Not set yet — `/api/mcp` open |

**Do not set on Vercel:**
- `ERPNEXT_NO_AUTH`, `ERPNEXT_DEV_PASSWORD` — localhost only
- MariaDB/Redis vars — belong on ERPNext host, not Vercel

### Create API keys on ERPNext

1. Log in as Administrator on hosted site  
2. User → Administrator → **API Access** → Generate Keys  
3. Copy key + secret into Vercel (mark as Sensitive)

---

## Deployment steps

### Prerequisites

- Vercel CLI authenticated (`vercel whoami`)
- Hosted ERPNext with OpulentAggro STO APIs installed
- API token with permission for STO + IC methods

Before each deploy after MCP server changes:

```bash
./scripts/sync-mcp-vendor.sh
cd vercel && vercel deploy
```

### Deploy production

```bash
vercel deploy --prod
```

### Verify

```bash
curl -s "https://YOUR-PROJECT.vercel.app/api/health" | jq .
curl -s "https://YOUR-PROJECT.vercel.app/api/sto" | jq .
# MCP: use MCP Inspector with Streamable HTTP URL
```

---

## Deployment status (2026-05-31)

| Item | Status |
|------|--------|
| Next.js App Router | Done (`vercel/app/`) |
| API proxies | Done — `/api/sto/*`, `/api/ic/*`, `/api/mcp`, `/api/health` |
| `vercel deploy --prod` | **Success** — https://vercel-indol-phi-69.vercel.app |
| Vercel env vars | **Set** for production, preview, development |
| `/api/health` | `configured: true`; `reachable: false` until Railway ERPNext finishes first boot |
| Railway backend | **Building** — MySQL live; erpnext Docker image; see [railway-backend-deployment.md](./railway-backend-deployment.md) |
| Production alias | https://vercel-indol-phi-69.vercel.app |

### Blockers

1. **Railway first deploy** — Docker build + site bootstrap (20–40 min). Until then `/api/sto` returns 503.
2. **API keys** — Vercel currently uses keys from local `sto.local`; regenerate on Railway site and update Vercel after boot.
3. **Local disk space** — keep using remote Vercel/Railway builds; `.railwayignore` required for `railway up`.
4. **MCP_AUTH_TOKEN** — optional hardening for `/api/mcp`.

---

## Next steps (non-Vercel)

1. **Deploy ERPNext to Railway** — `railway login` then `./scripts/deploy-railway.sh` (see [docs/railway-backend-deployment.md](./railway-backend-deployment.md))
2. **Generate API keys** on hosted site (`./scripts/generate-production-api-keys.sh`)
3. **Set Vercel env vars** and redeploy
4. **Test MCP tools** (`sto_create`, `sto_list`, …) against hosted ERPNext via `/api/mcp`
5. **Optional:** Add Upstash Redis for stateful MCP sessions if clients require long-lived SSE

---

## Files created / modified

| Path | Purpose |
|------|---------|
| `docs/vercel-deployment-plan.md` | This document |
| `vercel/` | Next.js frontend + MCP/STO/IC API gateway |
| `vercel/lib/types/` | Shared STO/IC types (MCP + API parity) |
| `vercel/lib/route-map.ts` | ERPNext desk → Vercel route mapping |
| `.cursor/skills/opulentaggro-vercel/` | Agent skill for Vercel routes and deploy |
| `erpnext-mcp-server/src/erpnext-client.ts` | Extracted REST client |
| `erpnext-mcp-server/src/create-server.ts` | Shared MCP server factory |
| `erpnext-mcp-server/src/index.ts` | Slim stdio entry |
| `erpnext-mcp-server/package.json` | Package exports for HTTP gateway |

---

## References

- [docs/erpnext-sto-mcp-setup.md](./erpnext-sto-mcp-setup.md)
- [docs/erpnext-sto-test-setup.md](./erpnext-sto-test-setup.md)
- MCP SDK: `WebStandardStreamableHTTPServerTransport` (stateless serverless pattern)
- Vercel Functions: `maxDuration`, env scoping, `--prod` promotion
