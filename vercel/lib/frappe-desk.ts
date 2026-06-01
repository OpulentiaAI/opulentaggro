/** Frappe desk embed via same-origin /erpnext proxy (route handler + session forwarding). */

import { hasServerAuth } from "@/lib/auth/session";
import { getErpnextConfig } from "@/lib/erpnext/fetch-client";
import { isNoAuthModeEnabled } from "@/lib/erpnext/dev-auth";
import { doctypeToSlug } from "@/lib/doctype";

export function isFrappeDeskProxyEnabled(): boolean {
  if (process.env.FRAPPE_DESK_PROXY === "0") return false;
  if (!process.env.ERPNEXT_URL) return false;
  if (process.env.FRAPPE_DESK_PROXY === "1") return true;
  if (isNoAuthModeEnabled()) return true;
  if (hasServerAuth()) return true;
  return true;
}

export function frappeDeskUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/erpnext${normalized}`;
}

export function frappeListUrl(doctype: string): string {
  return frappeDeskUrl(`/app/${doctypeToSlug(doctype)}`);
}

export function frappeFormUrl(doctype: string, name: string): string {
  return frappeDeskUrl(`/app/${doctypeToSlug(doctype)}/${encodeURIComponent(name)}`);
}

export function frappeNewFormUrl(doctype: string): string {
  return frappeDeskUrl(`/app/${doctypeToSlug(doctype)}/new`);
}

export function frappePageUrl(page: string): string {
  return frappeDeskUrl(`/app/${page}`);
}

export function frappeWorkspaceUrl(workspaceSlug: string): string {
  const slug = workspaceSlug.toLowerCase().replace(/\s+/g, "-");
  return frappeDeskUrl(`/app/${slug}`);
}
