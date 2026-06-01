import type { ApiResult } from "@/lib/types/api";
import { apiError, apiSuccess } from "@/lib/types/api";
import { getDevSessionSid, isNoAuthModeEnabled } from "@/lib/erpnext/dev-auth";
import { getServiceSessionSid, isServiceSessionConfigured } from "@/lib/erpnext/service-session";

export type ErpnextConfig = {
  baseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  authMode: "api_token" | "dev_session" | "service_session";
};

function preferServiceSessionAuth(): boolean {
  const mode = process.env.ERPNEXT_AUTH_MODE?.toLowerCase();
  if (mode === "service_session" || mode === "service") return true;
  if (mode === "api_token" || mode === "token") return false;
  return isServiceSessionConfigured();
}

export function getErpnextConfig(): ErpnextConfig | null {
  const baseUrl = process.env.ERPNEXT_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;

  if (preferServiceSessionAuth() && isServiceSessionConfigured()) {
    return { baseUrl, authMode: "service_session" };
  }

  const apiKey = process.env.ERPNEXT_API_KEY;
  const apiSecret = process.env.ERPNEXT_API_SECRET;
  if (apiKey && apiSecret) {
    return { baseUrl, apiKey, apiSecret, authMode: "api_token" };
  }

  if (isServiceSessionConfigured()) {
    return { baseUrl, authMode: "service_session" };
  }

  if (isNoAuthModeEnabled()) {
    return { baseUrl, authMode: "dev_session" };
  }

  return null;
}

export async function erpnextAuthHeaders(
  config: ErpnextConfig
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (config.authMode === "dev_session") {
    const sid = await getDevSessionSid(config.baseUrl);
    headers.Cookie = `sid=${sid}`;
    return headers;
  }

  if (config.authMode === "service_session") {
    const sid = await getServiceSessionSid(config.baseUrl);
    if (sid) {
      headers.Cookie = `sid=${sid}`;
      return headers;
    }
  }

  if (config.apiKey && config.apiSecret) {
    headers.Authorization = `token ${config.apiKey}:${config.apiSecret}`;
  }

  return headers;
}

/**
 * Native fetch ERPNext client — edge-compatible, no axios dependency.
 * Used by App Router server components and Route Handlers.
 */
export async function callErpnextMethod<T = unknown>(
  method: string,
  args?: Record<string, unknown>,
  httpMethod: "GET" | "POST" = "POST"
): Promise<ApiResult<T>> {
  const config = getErpnextConfig();
  if (!config) {
    return apiError(
      "ERPNEXT_URL plus ERPNEXT_API_KEY/SECRET or ERPNEXT_NO_AUTH=1 (localhost) must be configured",
      503
    );
  }

  const encodedMethod = method.split(".").map(encodeURIComponent).join(".");
  const url = new URL(`/api/method/${encodedMethod}`, config.baseUrl);

  try {
    const response = await fetch(
      httpMethod === "GET" ? `${url}?${new URLSearchParams(flattenArgs(args))}` : url,
      {
        method: httpMethod,
        headers: await erpnextAuthHeaders(config),
        body: httpMethod === "POST" ? JSON.stringify(args ?? {}) : undefined,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return apiError(`ERPNext returned ${response.status}: ${text.slice(0, 300)}`, response.status);
    }

    const payload = await response.json();
    return apiSuccess((payload.message ?? payload) as T);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown ERPNext error";
    return apiError(message, 502);
  }
}

function flattenArgs(args?: Record<string, unknown>): Record<string, string> {
  if (!args) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return out;
}

export async function checkErpnextConnectivity(): Promise<{
  configured: boolean;
  reachable: boolean;
  authMode: string;
  error: string | null;
}> {
  const config = getErpnextConfig();
  if (!config) {
    return {
      configured: Boolean(process.env.ERPNEXT_URL),
      reachable: false,
      authMode: "none",
      error: process.env.ERPNEXT_URL
        ? "Set ERPNEXT_API_KEY/SECRET or ERPNEXT_NO_AUTH=1 for localhost dev"
        : "ERPNEXT_URL is not configured",
    };
  }

  const result = await callErpnextMethod(
    "erpnext.intercompany.stock_transfer_order.list_stock_transfer_orders",
    { limit: 1 }
  );

  return {
    configured: true,
    reachable: result.ok,
    authMode: config.authMode,
    error: result.ok ? null : result.error,
  };
}
