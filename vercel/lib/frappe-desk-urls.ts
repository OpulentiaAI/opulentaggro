/** Client-safe Frappe desk URL builders (no server-only imports). */

import { doctypeToSlug } from "@/lib/doctype";

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
