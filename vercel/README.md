# OpulentAggro Vercel Frontend

Full OpulentAggro desk UI on Vercel (Next.js App Router). ERPNext backend (Python/Frappe/MariaDB/Redis) runs on Railway — **not** on Vercel.

## Architecture

| Layer | Host | Role |
|-------|------|------|
| **UI (this app)** | Vercel | Desk shell, workspaces, list/form views, STO/IC workflows |
| **API backend** | Railway | ERPNext REST + whitelisted methods |
| **Agents** | Vercel `/api/mcp` | MCP Streamable HTTP gateway |

## Desk routes (`/app/*`)

| Page | Path | ERPNext equivalent |
|------|------|-------------------|
| Landing | `/` | — |
| Desk home | `/app` | `/app` (workspaces) |
| Intercompany workspace | `/app/intercompany` | Intercompany workspace |
| STO Dashboard | `/app/sto-dashboard` | `/app/sto-dashboard` |
| STO Trace | `/app/sto-trace?purchase_order=PO-XXXX` | `/app/sto-trace` |
| IC Billing | `/app/intercompany/billing` | IC invoice pair creation |
| DocType list | `/app/{slug}` | `/app/{slug}` |
| DocType form | `/app/{slug}/{name}` | `/app/{slug}/{name}` |
| Sign in | `/login` | ERPNext login |

**DocType slugs:** `purchase-order`, `sales-order`, `delivery-note`, `purchase-receipt`, `sales-invoice`, `purchase-invoice`, `customer`, `supplier`, `item`, `company`, `warehouse`

Legacy paths (`/sto-dashboard`, `/sto-trace`, `/intercompany`) redirect to `/app/*`.

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Connectivity check |
| `GET\|POST\|DELETE /api/mcp` | MCP tools |
| `GET\|POST\|PUT\|DELETE /api/resource/[...path]` | ERPNext resource proxy |
| `GET\|POST /api/method/[...path]` | Whitelisted method proxy |
| `POST /api/auth/login` | Session login |
| `GET\|POST /api/auth/logout` | Session status / logout |
| `GET /api/sto`, `POST /api/sto/:action` | STO workflow |
| `GET /api/ic/accounts`, `POST /api/ic/:action` | IC billing |

## Environment

Copy `.env.example` → `.env.local`. On Vercel (Production + Preview):

- `ERPNEXT_URL`, `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET` (server-only)
- `NEXT_PUBLIC_ERPNEXT_URL`, `NEXT_PUBLIC_APP_NAME` (client)
- `MCP_AUTH_TOKEN` (optional, protects `/api/mcp`)
- `ERPNEXT_REQUIRE_LOGIN=true` (optional, enforce user login for `/app/*`)

Local MCP endpoint: `VERCEL_MCP_URL=http://localhost:3000/api/mcp` (see `.env.example`).

## Develop

```bash
cd vercel
npm install
npm run dev
```

Open http://localhost:3000/app

## Deploy

```bash
./scripts/sync-mcp-vendor.sh   # after MCP server changes
cd vercel && vercel deploy --prod
```

Verify: `curl https://YOUR-PROJECT.vercel.app/api/health`

## What's full vs backend-only

**On Vercel (UI):** Workspace navigation, generic list/form views for key doctypes, STO dashboard/trace with workflow actions, IC billing form, search, Pierre theme, auth.

**On Railway only:** Frappe desk JS, all doctypes/reports, print formats, permissions UI, file uploads, background jobs, Socket.IO realtime, setup wizard, custom scripts.

See `docs/vercel-deployment-plan.md` and `.cursor/skills/opulentaggro-vercel/SKILL.md`.
