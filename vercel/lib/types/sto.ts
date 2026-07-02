/** Shared STO types — aligned with erpnext-mcp-server sto_* tools and ERPNext API responses. */

export const STO_STAGES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Goods In Transit",
  "IC Invoiced",
  "Received",
  "Three Way Matched",
  "Dispute",
  "Completed",
  "Cancelled",
] as const;

export type StoStage = (typeof STO_STAGES)[number];

export const STO_STAGE_COLORS: Record<string, { bg: string; fg: string }> = {
  Draft: { bg: "#73737333", fg: "#737373" },
  "Pending Approval": { bg: "#ffca0033", fg: "#d5a910" },
  Approved: { bg: "#009fff33", fg: "#009fff" },
  "Goods In Transit": { bg: "#08c0ef33", fg: "#08c0ef" },
  "IC Invoiced": { bg: "#c635e433", fg: "#c635e4" },
  Received: { bg: "#0dbe4e33", fg: "#0dbe4e" },
  "Three Way Matched": { bg: "#07c48033", fg: "#07c480" },
  Dispute: { bg: "#ff2e3f33", fg: "#ff2e3f" },
  Completed: { bg: "#0dbe4e33", fg: "#0a0a0a" },
  Cancelled: { bg: "#73737333", fg: "#737373" },
};

export type StoListParams = {
  company?: string;
  status?: string;
  limit?: number;
  include_stage?: boolean;
};

export type StoOrderRow = {
  name: string;
  company?: string;
  supplier?: string;
  status?: string;
  docstatus?: number;
  stage?: string;
  grand_total?: number;
  transaction_date?: string;
};

export type StoListResponse = {
  orders?: StoOrderRow[];
  summary?: Record<string, number>;
  stage_counts?: Record<string, number>;
  stages?: string[];
  total?: number;
  brand?: string;
  error?: string;
};

export type StoTraceDocument = {
  doctype: string;
  name: string;
  status?: string;
  company?: string;
};

export type StoTraceDocumentsObject = {
  purchase_order?: Record<string, unknown> | null;
  sales_order?: Record<string, unknown> | null;
  delivery_notes?: Record<string, unknown>[];
  purchase_receipts?: Record<string, unknown>[];
  sales_invoices?: Record<string, unknown>[];
  purchase_invoices?: Record<string, unknown>[];
};

export type StoTraceResponse = {
  purchase_order?: string;
  stage?: string;
  stage_index?: number;
  stages?: string[];
  documents?: StoTraceDocument[] | StoTraceDocumentsObject;
  three_way_match?: {
    matched?: boolean;
    status?: string;
    message?: string;
    reason?: string;
    route?: string;
    comparison?: Record<string, unknown>;
    qty_variance?: number;
    price_variance?: number;
  };
  approval?: { status?: string; reason?: string; requestor?: string; approver?: string };
  dispute?: { status?: string; reason?: string; resolution?: string; parties?: string[] };
  booking_advice?: {
    delivery_note?: string;
    file?: string;
    sharepoint_archive_path?: string;
  } | null;
  clearing_status?: {
    status?: string;
    cleared?: boolean;
    ar_outstanding?: number;
    ap_outstanding?: number;
  } | null;
  brand?: string;
  error?: string;
};

/** MCP tool name → Vercel API action segment */
export const STO_ACTION_MAP = {
  sto_list: "list",
  sto_create: "create",
  sto_submit: "submit",
  sto_approve_and_route: "approve_and_route",
  sto_post_goods_in_transit: "post_goods_in_transit",
  sto_create_ic_invoice: "create_ic_invoice",
  sto_post_goods_receipt: "post_goods_receipt",
  sto_get_trace: "get_trace",
  sto_three_way_match: "three_way_match",
  sto_generate_booking_advice: "generate_booking_advice",
  sto_request_approval: "request_approval",
  sto_approve: "approve",
  sto_reject: "reject",
  sto_open_dispute: "open_dispute",
  sto_resolve_dispute: "resolve_dispute",
  sto_list_disputes: "list_disputes",
} as const;

export type StoApiAction = (typeof STO_ACTION_MAP)[keyof typeof STO_ACTION_MAP];
