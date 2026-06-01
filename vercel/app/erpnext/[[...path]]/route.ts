import { proxyFrappeDeskRequest } from "@/lib/frappe-desk-proxy";
import { isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function handle(request: Request, context: RouteContext): Promise<Response> {
  if (!isFrappeDeskProxyEnabled()) {
    return new Response("Frappe desk proxy is disabled", { status: 404 });
  }
  const { path = [] } = await context.params;
  return proxyFrappeDeskRequest(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
