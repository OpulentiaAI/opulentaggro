import { NextRequest, NextResponse } from "next/server";
import { invokeStoAction } from "@/lib/sto/handlers";

export const runtime = "nodejs";

const VALID_ACTIONS = new Set([
  "list",
  "create",
  "submit",
  "approve_and_route",
  "post_goods_in_transit",
  "create_ic_invoice",
  "post_goods_receipt",
  "get_trace",
  "three_way_match",
]);

type RouteContext = { params: Promise<{ action: string }> };

/** POST /api/sto/:action — MCP-equivalent STO method proxy */
export async function POST(request: NextRequest, context: RouteContext) {
  const { action } = await context.params;

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: `Unknown STO action: ${action}` }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = await invokeStoAction(action, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
