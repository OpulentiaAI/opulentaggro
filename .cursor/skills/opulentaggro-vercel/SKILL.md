---
name: opulentaggro-vercel
description: Navigates the OpulentAggro Vercel Next.js frontend — full desk shell at /app, workspaces, generic list/form views, STO dashboard/trace with actions, IC billing, and /api/sto / /api/ic / /api/mcp / /api/resource proxies. Use when deploying to Vercel, connecting remote ERPNext, or choosing Vercel UI vs ERPNext desk vs MCP.
---

# OpulentAggro Vercel Frontend

Next.js App Router app in `vercel/` — **full OpulentAggro desk UI** proxying Railway-hosted ERPNext. Python/Frappe/MariaDB remain on persistent host.

## Architecture

| Layer | Host |
|-------|------|
| UI (desk shell, lists, forms, STO/IC) | **Vercel** |
| ERPNext API (REST + whitelisted methods) | **Railway** |
| MCP agents | Vercel `/api/mcp` |

## When to use which interface

| Goal | Prefer |
|------|--------|
| Daily OpulentAggro operations (lists, STO, IC billing) | **Vercel desk** (`/app`) |
| Obscure doctypes, reports, print, advanced permissions | **ERPNext desk** on Railway |
| Agents, CI, automation | **MCP** (`/api/mcp`) or **REST proxies** |

## Route map

### Desk pages

| Vercel | ERPNext desk | Parity |
|--------|--------------|--------|
| `/app` | `/app` | Workspace home |
| `/app/intercompany` | Intercompany workspace | Cards + links |
| `/app/sto-dashboard` | `/app/sto-dashboard` | List + stage cards |
| `/app/sto-trace` | `/app/sto-trace` | Trace + workflow actions |
| `/app/intercompany/billing` | — | IC invoice pair UI |
| `/app/{doctype-slug}` | `/app/{slug}` | Generic list view |
| `/app/{doctype-slug}/{name}` | form route | Generic form view |
| `/login` | login | Session cookie auth |

### DocType slugs

`purchase-order`, `sales-order`, `delivery-note`, `purchase-receipt`, `sales-invoice`, `purchase-invoice`, `customer`, `supplier`, `item`, `company`, `warehouse`

Mapping: `vercel/lib/doctype.ts`, `vercel/lib/route-map.ts`

### Legacy redirects

| Old | New |
|-----|-----|
| `/sto-dashboard` | `/app/sto-dashboard` |
| `/sto-trace` | `/app/sto-trace` |
| `/intercompany` | `/app/intercompany` |
| `/desk/*` | `/app/*` |

## API proxies

| Vercel API | Purpose |
|------------|---------|
| `GET\|POST\|PUT\|DELETE /api/resource/[...path]` | Generic ERPNext resource CRUD |
| `GET\|POST /api/method/[...path]` | Whitelisted method proxy |
| `POST /api/auth/login` | User session login |
| `GET /api/sto` | `sto_list` |
| `POST /api/sto/:action` | STO workflow actions |
| `GET /api/ic/accounts` | `ic_list_accounts` |
| `POST /api/ic/:action` | IC billing actions |
| `GET\|POST\|DELETE /api/mcp` | All MCP tools |

## Environment (Vercel dashboard)

| Variable | Scope | Purpose |
|----------|-------|---------|
| `ERPNEXT_URL` | Server | Remote ERPNext HTTPS URL |
| `ERPNEXT_API_KEY` | Server | API token (service mode) |
| `ERPNEXT_API_SECRET` | Server | API secret |
| `ERPNEXT_REQUIRE_LOGIN` | Server | `true` to enforce login on `/app/*` |
| `MCP_AUTH_TOKEN` | Server | Bearer auth for `/api/mcp` |
| `NEXT_PUBLIC_ERPNEXT_URL` | Client | Link to Railway desk |
| `NEXT_PUBLIC_APP_NAME` | Client | Branding (default OpulentAggro) |

## Deploy

```bash
./scripts/sync-mcp-vendor.sh
cd vercel && vercel deploy --prod
```

Verify: `curl https://YOUR-PROJECT.vercel.app/api/health`

Production: https://vercel-indol-phi-69.vercel.app

## Parity gaps (not on Vercel)

- Frappe desk JS (form scripts, child tables inline edit, link fields)
- Reports, dashboards, print formats
- File manager / attachments UI
- Role permission manager, workflow builder
- Background workers, scheduler, email queue
- ~400+ doctypes without explicit list column config (generic fallback works)

## Related skills

- [opulentaggro-sto-navigation](../opulentaggro-sto-navigation/SKILL.md)
- [erpnext-sto-mcp](../erpnext-sto-mcp/SKILL.md)
- [mcp-db-alignment](../mcp-db-alignment/SKILL.md)

## Docs

- `docs/vercel-deployment-plan.md`
- `vercel/README.md`
