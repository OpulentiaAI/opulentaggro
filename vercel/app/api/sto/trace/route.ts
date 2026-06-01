import { NextRequest, NextResponse } from "next/server";
import { getStoTrace } from "@/lib/sto/handlers";

export const runtime = "nodejs";

/** GET /api/sto/trace?purchase_order=PO-00001 */
export async function GET(request: NextRequest) {
  const purchaseOrder = request.nextUrl.searchParams.get("purchase_order")?.trim();
  if (!purchaseOrder) {
    return NextResponse.json({ error: "purchase_order query param is required" }, { status: 400 });
  }

  const data = await getStoTrace(purchaseOrder);
  if (data.error) {
    return NextResponse.json(data, { status: 503 });
  }

  return NextResponse.json(data);
}
