# agent-browser patterns for MCP E2E

Used by `test_mcp_endpoints_with_screenshots.sh` and `test_mcp_browser_e2e.sh`. Requires global `agent-browser` CLI and Playwright Chromium.

## One-time setup

```bash
npm install -g agent-browser
npx playwright install chromium
```

Playwright cache: `~/Library/Caches/ms-playwright`. agent-browser 0.13 expects build **1208**; if only **1200** is installed, E2E scripts symlink:

```bash
ln -sf ~/Library/Caches/ms-playwright/chromium_headless_shell-1200 \
       ~/Library/Caches/ms-playwright/chromium_headless_shell-1208
```

## Standard session (from orchestrator scripts)

```bash
export ERPNEXT_URL=http://localhost:8000
SITE_USER="${ERPNEXT_DEV_USER:-Administrator}"
# SITE_PASS from config/demo-credentials.env (never log it)

agent-browser set viewport 1440 900
agent-browser open "${ERPNEXT_URL}"
agent-browser wait 2000
```

### Login flow

Snapshot interactive elements, fill email/password textboxes, click Login:

```bash
SNAP=$(agent-browser snapshot -i 2>/dev/null || true)
if echo "$SNAP" | grep -q 'textbox "Email"'; then
  agent-browser fill @e2 "$SITE_USER"
  agent-browser fill @e3 "$SITE_PASS"
  agent-browser click @e5
  agent-browser wait 3000
fi
```

If login fails: `./scripts/set_demo_admin_password.sh` then retry.

## Navigation + wait patterns

### STO dashboard — verify PO visible

```bash
agent-browser open "${ERPNEXT_URL}/app/sto-dashboard"
agent-browser wait 5000
agent-browser wait --text "PUR-ORD-2026-00038" 8000 || {
  agent-browser reload
  agent-browser wait 4000
  agent-browser wait --text "PUR-ORD-2026-00038" 12000
}
COUNT=$(agent-browser get count "text=PUR-ORD-2026-00038" 2>/dev/null || echo 0)
```

Replace PO name with value from MCP response or `docs/mcp-stdio-results.json` → `po_name`.

### Form views (preferred over sto-trace in headless)

```bash
agent-browser open "${ERPNEXT_URL}/app/purchase-order/${PO}"
agent-browser wait 5000

agent-browser open "${ERPNEXT_URL}/app/delivery-note/${DN}"
agent-browser wait 4000

agent-browser open "${ERPNEXT_URL}/app/sales-invoice"
agent-browser wait 4000

agent-browser open "${ERPNEXT_URL}/app/purchase-receipt"
agent-browser wait 4000

agent-browser open "${ERPNEXT_URL}/app/intercompany"
agent-browser wait 3000
```

### IC invoice forms

```bash
agent-browser open "${ERPNEXT_URL}/app/sales-invoice/${SI}"
agent-browser wait 3000

agent-browser open "${ERPNEXT_URL}/app/purchase-invoice/${PI}"
agent-browser wait 3000
```

## Screenshots

Full-page capture into validation directory:

```bash
mkdir -p docs/screenshots/mcp-validation
agent-browser screenshot docs/screenshots/mcp-validation/02-sto-create.png --full
```

Naming convention: `{NN}-{tool-or-stage-slug}.png` — see [endpoint-checklist.md](endpoint-checklist.md).

Ad-hoc E2E screenshots go in `docs/screenshots/` (no `mcp-validation/` prefix):

```bash
agent-browser screenshot docs/screenshots/e2e-mcp-sto-create.png --full
```

## Cleanup

```bash
agent-browser close 2>/dev/null || true
```

## sto_create single-tool E2E (minimal)

After MCP stdio returns a PO name:

1. `agent-browser open` + login (above)
2. Open sto-dashboard, wait for PO text
3. Screenshot
4. Optionally open PO form to confirm fields

Reference implementation: `scripts/test_mcp_browser_e2e.sh` (inline Python MCP stdio for one `sto_create` call).

## Common failures

| Symptom | Action |
|---------|--------|
| Blank page after open | Increase `wait`; try `reload` |
| PO not on dashboard | MCP may have failed; check JSON report; refresh after longer wait |
| sto-trace empty | Use PO/DN/SI/PR form routes instead |
| Playwright binary missing | `npx playwright install chromium` |
| `@e2` refs stale after navigation | Re-run `agent-browser snapshot -i` |

## Desk routes quick reference

| Page | Route |
|------|-------|
| STO Dashboard | `/app/sto-dashboard` |
| STO Trace | `/app/sto-trace?purchase_order={PO}` |
| Intercompany | `/app/intercompany` |
| Purchase Order | `/app/purchase-order/{name}` |
| Delivery Note | `/app/delivery-note/{name}` |
| Sales Invoice | `/app/sales-invoice/{name}` |
| Purchase Receipt | `/app/purchase-receipt/{name}` |

See [opulentaggro-sto-navigation](../../opulentaggro-sto-navigation/SKILL.md) for stage semantics and UI pitfalls.
