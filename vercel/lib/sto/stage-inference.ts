import { STO_STAGES, type StoOrderRow, type StoStage } from "@/lib/types/sto";

/** PO list row fields used for quick stage inference (matches ERPNext list + _infer_stage order). */
export type StoListStageRow = Pick<StoOrderRow, "stage" | "status"> & {
  docstatus?: number;
};

/**
 * Infer workflow stage from list row fields when the API omitted `stage`
 * (e.g. get_sto_dashboard_data without include_stage). Mirrors the early exits in
 * erpnext.intercompany.stock_transfer_order._infer_stage before linked-doc lookups.
 */
export function inferStoStageFromListRow(row: StoListStageRow): StoStage | string {
  if (row.stage && (STO_STAGES as readonly string[]).includes(row.stage)) {
    return row.stage;
  }

  const docstatus = row.docstatus ?? 0;
  if (docstatus === 0) return "Draft";
  if (docstatus === 2) return "Cancelled";
  if (row.status === "Completed") return "Completed";
  if (docstatus === 1) return "Pending Approval";
  return "Draft";
}

export function withInferredStoStage<T extends StoListStageRow>(row: T): T & { stage: string } {
  return { ...row, stage: inferStoStageFromListRow(row) };
}

/** Ensure every order has stage and recompute stage_counts when rows were missing stage. */
export function normalizeStoDashboardOrders(orders: StoOrderRow[]): {
  orders: StoOrderRow[];
  stage_counts: Record<string, number>;
} {
  const normalized = orders.map((row) => withInferredStoStage(row));
  const stage_counts: Record<string, number> = Object.fromEntries(
    STO_STAGES.map((s) => [s, 0])
  ) as Record<string, number>;
  for (const row of normalized) {
    const stage = row.stage ?? "Draft";
    stage_counts[stage] = (stage_counts[stage] ?? 0) + 1;
  }
  return { orders: normalized, stage_counts };
}
