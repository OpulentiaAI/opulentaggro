import { NextRequest, NextResponse } from "next/server";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";
import { getErpnextAuthHeaders } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyResource(
  request: NextRequest,
  path: string[],
  method: string
): Promise<NextResponse> {
  const config = getErpnextConfig();
  if (!config) {
    return NextResponse.json({ error: "ERPNext not configured" }, { status: 503 });
  }

  const resourcePath = path.map(encodeURIComponent).join("/");
  const url = new URL(`${config.baseUrl}/api/resource/${resourcePath}`);
  request.nextUrl.searchParams.forEach((value: string, key: string) => {
    url.searchParams.set(key, value);
  });

  const headers = await getErpnextAuthHeaders(config);
  const init: RequestInit = { method, headers, cache: "no-store" };

  if (method !== "GET" && method !== "HEAD") {
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

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyResource(request, path, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyResource(request, path, "POST");
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyResource(request, path, "PUT");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyResource(request, path, "DELETE");
}
