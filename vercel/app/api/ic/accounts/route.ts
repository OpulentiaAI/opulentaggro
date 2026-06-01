import { NextRequest, NextResponse } from "next/server";
import { getIcAccounts } from "@/lib/ic/handlers";

export const runtime = "nodejs";

/** GET /api/ic/accounts — IC company pairs list */
export async function GET(request: NextRequest) {
  const company = request.nextUrl.searchParams.get("company") ?? undefined;
  const data = await getIcAccounts(company);

  if (data.error) {
    return NextResponse.json(data, { status: 503 });
  }

  return NextResponse.json(data);
}
