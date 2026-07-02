import { NextRequest, NextResponse } from "next/server";
import { invokeIcAction } from "@/lib/ic/handlers";

export const runtime = "nodejs";

const VALID_ACTIONS = new Set([
  "list_accounts",
  "create_sales_invoice",
  "create_purchase_invoice",
  "create_invoice_pair",
  "submit_invoice",
  "get_invoice_status",
  "match_and_clear",
  "get_clearing_status",
  "list_pending_clearing",
  "get_reconciliation_summary",
  "triangular_sale",
  "list_triangular_sales",
  "create_accrual",
  "list_accruals",
]);

type RouteContext = { params: Promise<{ action: string }> };

/** POST /api/ic/:action — MCP-equivalent IC billing method proxy */
export async function POST(request: NextRequest, context: RouteContext) {
  const { action } = await context.params;

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: `Unknown IC action: ${action}` }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = await invokeIcAction(action, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
