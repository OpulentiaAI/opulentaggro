import { cache } from "react";
import { callErpnextMethod } from "@/lib/erpnext/fetch-client";
import {
  inferStoStageFromListRow,
  normalizeStoDashboardOrders,
  withInferredStoStage,
} from "@/lib/sto/stage-inference";
import type {
  StoListParams,
  StoListResponse,
  StoOrderRow,
  StoTraceResponse,
} from "@/lib/types/sto";

const STO_PREFIX = "erpnext.intercompany.stock_transfer_order";

function normalizeStoListPayload(
  data: StoListResponse | StoOrderRow[] | null | undefined
): StoListResponse {
  if (!data) return { orders: [], summary: {} };
  if (Array.isArray(data)) {
    const orders = data.map((row) => withInferredStoStage(row));
    const summary: Record<string, number> = {};
    for (const row of orders) {
      const stage = row.stage ?? inferStoStageFromListRow(row);
      summary[stage] = (summary[stage] ?? 0) + 1;
    }
    return { orders, summary };
  }

  const rawOrders = data.orders ?? [];
  const needsInference = rawOrders.some((row) => !row.stage);
  const dashboardNorm = needsInference ? normalizeStoDashboardOrders(rawOrders) : null;
  const orders = dashboardNorm?.orders ?? rawOrders.map((row) => (row.stage ? row : withInferredStoStage(row)));
  const stageCounts =
    dashboardNorm?.stage_counts ?? data.stage_counts ?? data.summary ?? {};

  return {
    orders,
    summary: stageCounts,
    stage_counts: stageCounts,
    total: (data as { total?: number }).total,
    stages: (data as { stages?: string[] }).stages,
  };
}

/** server-cache-react: per-request deduplication for RSC fetches */
export const getStoList = cache(async (params: StoListParams = {}): Promise<StoListResponse> => {
  if (params.include_stage) {
    const dash = await callErpnextMethod<StoListResponse & { stage_counts?: Record<string, number> }>(
      "erpnext.intercompany.page.sto_dashboard.sto_dashboard.get_sto_dashboard_data",
      {
        company: params.company,
        stage: params.status,
        limit: params.limit ?? 50,
      }
    );
    if (dash.ok) return normalizeStoListPayload(dash.data);
  }

  const result = await callErpnextMethod<StoListResponse | StoOrderRow[]>(
    `${STO_PREFIX}.list_stock_transfer_orders`,
    {
      company: params.company,
      status: params.status,
      limit: params.limit ?? 20,
      include_stage: params.include_stage ? 1 : 0,
    }
  );
  if (!result.ok) return { error: result.error };
  return normalizeStoListPayload(result.data);
});

export const getStoTrace = cache(
  async (purchaseOrder: string): Promise<StoTraceResponse> => {
    const pageResult = await callErpnextMethod<StoTraceResponse>(
      "erpnext.intercompany.page.sto_trace.sto_trace.get_sto_trace_page_data",
      { purchase_order: purchaseOrder }
    );
    if (pageResult.ok) return pageResult.data;

    const result = await callErpnextMethod<StoTraceResponse>(
      `${STO_PREFIX}.get_stock_transfer_trace`,
      { purchase_order: purchaseOrder }
    );
    if (!result.ok) return { error: result.error };
    return result.data;
  }
);

export async function invokeStoAction(
  action: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status: number }> {
  const methodMap: Record<string, { method: string; transform?: (b: Record<string, unknown>) => Record<string, unknown> }> = {
    list: {
      method: "list_stock_transfer_orders",
      transform: (b) => ({
        company: b.company,
        status: b.status,
        limit: b.limit ?? 20,
        include_stage: b.include_stage ? 1 : 0,
      }),
    },
    create: {
      method: "create_stock_transfer_order",
      transform: (b) => ({
        company: b.company,
        supplier: b.supplier,
        items: typeof b.items === "string" ? b.items : JSON.stringify(b.items),
        transaction_date: b.transaction_date,
        schedule_date: b.schedule_date,
        submit: b.submit ? 1 : 0,
      }),
    },
    submit: { method: "submit_stock_transfer_order" },
    approve_and_route: {
      method: "approve_and_route_stock_transfer",
      transform: (b) => ({
        purchase_order: b.purchase_order,
        delivery_date: b.delivery_date,
        submit: b.submit === false ? 0 : 1,
      }),
    },
    post_goods_in_transit: {
      method: "post_goods_in_transit",
      transform: (b) => ({
        purchase_order: b.purchase_order,
        in_transit_warehouse: b.in_transit_warehouse,
        submit: b.submit === false ? 0 : 1,
      }),
    },
    create_ic_invoice: {
      method: "create_intercompany_invoice",
      transform: (b) => ({
        purchase_order: b.purchase_order,
        submit: b.submit === false ? 0 : 1,
      }),
    },
    post_goods_receipt: {
      method: "post_stock_transfer_receipt",
      transform: (b) => ({
        purchase_order: b.purchase_order,
        delivery_note: b.delivery_note,
        submit: b.submit === false ? 0 : 1,
      }),
    },
    get_trace: { method: "get_stock_transfer_trace" },
    three_way_match: {
      method: "run_stock_transfer_three_way_match",
      transform: (b) => ({
        purchase_order: b.purchase_order,
        qty_tolerance_percent: b.qty_tolerance_percent ?? 0,
        price_tolerance_percent: b.price_tolerance_percent ?? 0,
      }),
    },
    generate_booking_advice: { method: "generate_booking_advice" },
    request_approval: { method: "request_sto_approval" },
    approve: { method: "approve_sto" },
    reject: { method: "reject_sto" },
    open_dispute: { method: "open_sto_dispute" },
    resolve_dispute: { method: "resolve_sto_dispute" },
    list_disputes: {
      method: "list_sto_disputes",
      transform: (b) => ({
        company: b.company,
        limit: b.limit ?? 20,
      }),
    },
  };

  const mapping = methodMap[action];
  if (!mapping) {
    return { ok: false, error: `Unknown STO action: ${action}`, status: 404 };
  }

  const args = mapping.transform ? mapping.transform(body) : body;
  const result = await callErpnextMethod(`${STO_PREFIX}.${mapping.method}`, args);
  if (!result.ok) return { ok: false, error: result.error, status: result.status ?? 502 };
  return { ok: true, data: result.data };
}
