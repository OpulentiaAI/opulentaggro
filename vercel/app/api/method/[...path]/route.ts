import { NextRequest, NextResponse } from "next/server";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";
import { getErpnextAuthHeaders } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyMethod(request, context, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyMethod(request, context, "POST");
}

async function proxyMethod(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "POST"
): Promise<NextResponse> {
  const config = getErpnextConfig();
  if (!config) {
    return NextResponse.json({ error: "ERPNext not configured" }, { status: 503 });
  }

  const { path } = await context.params;
  const methodPath = path.map(encodeURIComponent).join(".");
  const url = new URL(`${config.baseUrl}/api/method/${methodPath}`);

  const headers = await getErpnextAuthHeaders(config);
  const init: RequestInit = { method, headers, cache: "no-store" };

  if (method === "GET") {
    request.nextUrl.searchParams.forEach((value: string, key: string) => {
      url.searchParams.set(key, value);
    });
  } else {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const response = await fetch(url, init);
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Proxy error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
