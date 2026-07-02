/**
 * ERPNext desk route → Vercel App Router mapping.
 * Railway hosts Frappe/Python/DB; Vercel is the full OpulentAggro UI shell.
 */

export const DESK_TO_VERCEL_ROUTES = [
  {
    desk: "/app",
    vercel: "/app",
    description: "Desk home — workspace shortcuts",
    parity: "workspace navigation",
  },
  {
    desk: "/app/intercompany",
    vercel: "/app/intercompany",
    description: "Intercompany workspace",
    parity: "workspace cards + links",
  },
  {
    desk: "/app/sto-dashboard",
    vercel: "/app/sto-dashboard",
    description: "STO list with stage summary cards",
    parity: "list + filters; actions via trace or API",
  },
  {
    desk: "/app/sto-trace",
    vercel: "/app/sto-trace",
    description: "Document chain timeline and three-way match",
    parity: "full trace + workflow action buttons",
  },
  {
    desk: "/app/purchase-order",
    vercel: "/app/purchase-order",
    description: "Purchase Order list",
    parity: "generic list/form via REST proxy",
  },
  {
    desk: "/app/purchase-order/PO-XXXX",
    vercel: "/app/purchase-order/PO-XXXX",
    description: "Purchase Order form",
    parity: "read + limited edit; full Frappe form UX not replicated",
  },
  {
    desk: "/app/sales-order",
    vercel: "/app/sales-order",
    description: "Sales Order list",
    parity: "generic list/form",
  },
  {
    desk: "/app/delivery-note",
    vercel: "/app/delivery-note",
    description: "Delivery Note list",
    parity: "generic list/form",
  },
  {
    desk: "/app/purchase-receipt",
    vercel: "/app/purchase-receipt",
    description: "Purchase Receipt list",
    parity: "generic list/form",
  },
  {
    desk: "/app/sales-invoice",
    vercel: "/app/sales-invoice",
    description: "Sales Invoice list",
    parity: "generic list/form",
  },
  {
    desk: "/app/purchase-invoice",
    vercel: "/app/purchase-invoice",
    description: "Purchase Invoice list",
    parity: "generic list/form",
  },
  {
    desk: "/app/customer",
    vercel: "/app/customer",
    description: "Customer master list",
    parity: "generic list/form",
  },
  {
    desk: "/app/supplier",
    vercel: "/app/supplier",
    description: "Supplier master list",
    parity: "generic list/form",
  },
  {
    desk: "/app/item",
    vercel: "/app/item",
    description: "Item master list",
    parity: "generic list/form",
  },
  {
    desk: "/app/company",
    vercel: "/app/company",
    description: "Company master list",
    parity: "generic list/form",
  },
] as const;

/** Legacy routes — redirect to /app/* */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/sto-dashboard": "/app/sto-dashboard",
  "/sto-trace": "/app/sto-trace",
  "/intercompany": "/app/intercompany",
};

export const MCP_TO_API_ROUTES = {
  sto_list: { method: "GET", path: "/api/sto", alt: "POST /api/sto/list" },
  sto_create: { method: "POST", path: "/api/sto/create" },
  sto_submit: { method: "POST", path: "/api/sto/submit" },
  sto_approve_and_route: { method: "POST", path: "/api/sto/approve_and_route" },
  sto_post_goods_in_transit: { method: "POST", path: "/api/sto/post_goods_in_transit" },
  sto_create_ic_invoice: { method: "POST", path: "/api/sto/create_ic_invoice" },
  sto_post_goods_receipt: { method: "POST", path: "/api/sto/post_goods_receipt" },
  sto_get_trace: { method: "POST", path: "/api/sto/get_trace", alt: "GET /api/sto/trace?purchase_order=" },
  sto_three_way_match: { method: "POST", path: "/api/sto/three_way_match" },
  sto_generate_booking_advice: { method: "POST", path: "/api/sto/generate_booking_advice" },
  sto_request_approval: { method: "POST", path: "/api/sto/request_approval" },
  sto_approve: { method: "POST", path: "/api/sto/approve" },
  sto_reject: { method: "POST", path: "/api/sto/reject" },
  sto_open_dispute: { method: "POST", path: "/api/sto/open_dispute" },
  sto_resolve_dispute: { method: "POST", path: "/api/sto/resolve_dispute" },
  sto_list_disputes: { method: "POST", path: "/api/sto/list_disputes" },
  ic_list_accounts: { method: "POST", path: "/api/ic/list_accounts", alt: "GET /api/ic/accounts" },
  ic_create_sales_invoice: { method: "POST", path: "/api/ic/create_sales_invoice" },
  ic_create_purchase_invoice: { method: "POST", path: "/api/ic/create_purchase_invoice" },
  ic_create_invoice_pair: { method: "POST", path: "/api/ic/create_invoice_pair" },
  ic_submit_invoice: { method: "POST", path: "/api/ic/submit_invoice" },
  ic_get_invoice_status: { method: "POST", path: "/api/ic/get_invoice_status" },
  ic_match_and_clear: { method: "POST", path: "/api/ic/match_and_clear" },
  ic_get_clearing_status: { method: "POST", path: "/api/ic/get_clearing_status" },
  ic_list_pending_clearing: { method: "POST", path: "/api/ic/list_pending_clearing" },
  ic_get_reconciliation_summary: { method: "POST", path: "/api/ic/get_reconciliation_summary" },
  ic_triangular_sale: { method: "POST", path: "/api/ic/triangular_sale" },
  ic_list_triangular_sales: { method: "POST", path: "/api/ic/list_triangular_sales" },
  ic_create_accrual: { method: "POST", path: "/api/ic/create_accrual" },
  ic_list_accruals: { method: "POST", path: "/api/ic/list_accruals" },
} as const;

export function getErpnextDeskUrl(path = ""): string | null {
  const base = process.env.NEXT_PUBLIC_ERPNEXT_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
