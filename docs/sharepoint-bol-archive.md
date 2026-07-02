# SharePoint BOL Archive — Tier 2 Stub

**Status:** Documented path only; no SharePoint Graph integration in OpulentAggro POC.

## Archive path convention

When `sto_generate_booking_advice` / `generate_booking_advice` runs, ERPNext attaches an HTML BOL to the Delivery Note and returns:

```
/sites/IC-Archive/STO/BOL/{purchase_order}.pdf
```

This mirrors the AgroFresh blueprint where booking advice PDFs are distributed via workflow into a SharePoint archive (see [pdf-executive-summaries.md](./pdf-executive-summaries.md) §1).

## Tier 2 integration (future)

1. Microsoft Graph `PUT /sites/{site-id}/drive/items/...` upload after BOL generation.
2. Store Graph `webUrl` on STO trace `booking_advice` metadata.
3. Workflow notification to Sender/Requestor with SharePoint link.

## OpulentAggro today

- **ERPNext:** HTML file attached to DN; metadata in trace `booking_advice`.
- **Vercel:** Download link on `/app/sto-trace` Booking Advice panel.
- **MCP:** `sto_generate_booking_advice`.
