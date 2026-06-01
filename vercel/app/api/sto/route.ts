import { NextRequest, NextResponse } from "next/server";
import { getStoList } from "@/lib/sto/handlers";

export const runtime = "nodejs";

/** GET /api/sto — backward-compatible STO list proxy */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Number(searchParams.get("limit") ?? 20);
  const includeStage = searchParams.get("include_stage") === "1" || searchParams.get("include_stage") === "true";

  const data = await getStoList({
    company: searchParams.get("company") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: Number.isFinite(limit) ? limit : 20,
    include_stage: includeStage,
  });

  if (data.error) {
    return NextResponse.json(data, { status: 503 });
  }

  return NextResponse.json(data);
}
