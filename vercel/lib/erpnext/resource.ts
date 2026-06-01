import { cache } from "react";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";
import { getErpnextAuthHeaders } from "@/lib/auth/session";
import type { ApiResult } from "@/lib/types/api";
import { apiError, apiSuccess } from "@/lib/types/api";

export type ResourceListParams = {
  fields?: string[];
  filters?: unknown[][];
  orFilters?: unknown[][];
  orderBy?: string;
  limit?: number;
  limitStart?: number;
};

export type ResourceListResponse<T = Record<string, unknown>> = {
  data: T[];
};

function buildQuery(params?: ResourceListParams): string {
  const search = new URLSearchParams();
  if (params?.fields?.length) {
    search.set("fields", JSON.stringify(params.fields));
  }
  if (params?.filters?.length) {
    search.set("filters", JSON.stringify(params.filters));
  }
  if (params?.orFilters?.length) {
    search.set("or_filters", JSON.stringify(params.orFilters));
  }
  if (params?.orderBy) {
    search.set("order_by", params.orderBy);
  }
  if (params?.limit != null) {
    search.set("limit_page_length", String(params.limit));
  }
  if (params?.limitStart != null) {
    search.set("limit_start", String(params.limitStart));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchResourceList<T = Record<string, unknown>>(
  doctype: string,
  params?: ResourceListParams
): Promise<ApiResult<ResourceListResponse<T>>> {
  const config = getErpnextConfig();
  if (!config) {
    return apiError("ERPNext not configured", 503);
  }

  const encoded = encodeURIComponent(doctype);
  const url = `${config.baseUrl}/api/resource/${encoded}${buildQuery(params)}`;

  try {
    const headers = await getErpnextAuthHeaders(config);
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) {
      const text = await response.text();
      return apiError(`ERPNext ${response.status}: ${text.slice(0, 300)}`, response.status);
    }
    const payload = await response.json();
    return apiSuccess({ data: (payload.data ?? []) as T[] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Resource fetch failed";
    return apiError(message, 502);
  }
}

export async function fetchResourceDoc<T = Record<string, unknown>>(
  doctype: string,
  name: string
): Promise<ApiResult<T>> {
  const config = getErpnextConfig();
  if (!config) {
    return apiError("ERPNext not configured", 503);
  }

  const url = `${config.baseUrl}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;

  try {
    const headers = await getErpnextAuthHeaders(config);
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) {
      const text = await response.text();
      return apiError(`ERPNext ${response.status}: ${text.slice(0, 300)}`, response.status);
    }
    const payload = await response.json();
    return apiSuccess((payload.data ?? payload) as T);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Resource fetch failed";
    return apiError(message, 502);
  }
}

export async function createResourceDoc(
  doctype: string,
  data: Record<string, unknown>
): Promise<ApiResult<Record<string, unknown>>> {
  const config = getErpnextConfig();
  if (!config) return apiError("ERPNext not configured", 503);

  const url = `${config.baseUrl}/api/resource/${encodeURIComponent(doctype)}`;
  try {
    const headers = await getErpnextAuthHeaders(config);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text();
      return apiError(`ERPNext ${response.status}: ${text.slice(0, 300)}`, response.status);
    }
    const payload = await response.json();
    return apiSuccess((payload.data ?? payload) as Record<string, unknown>);
  } catch (error: unknown) {
    return apiError(error instanceof Error ? error.message : "Create failed", 502);
  }
}

export async function updateResourceDoc(
  doctype: string,
  name: string,
  data: Record<string, unknown>
): Promise<ApiResult<Record<string, unknown>>> {
  const config = getErpnextConfig();
  if (!config) return apiError("ERPNext not configured", 503);

  const url = `${config.baseUrl}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
  try {
    const headers = await getErpnextAuthHeaders(config);
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text();
      return apiError(`ERPNext ${response.status}: ${text.slice(0, 300)}`, response.status);
    }
    const payload = await response.json();
    return apiSuccess((payload.data ?? payload) as Record<string, unknown>);
  } catch (error: unknown) {
    return apiError(error instanceof Error ? error.message : "Update failed", 502);
  }
}

/** server-cache-react: dedupe list reads within a request */
export const getResourceList = cache(fetchResourceList);
export const getResourceDoc = cache(fetchResourceDoc);
