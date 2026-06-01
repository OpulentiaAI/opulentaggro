/**
 * Desk navigation derived from ERPNext workspace_sidebar JSON (source of truth).
 */

import buyingSidebar from "@/data/workspace_sidebar/buying.json";
import sellingSidebar from "@/data/workspace_sidebar/selling.json";
import stockSidebar from "@/data/workspace_sidebar/stock.json";
import intercompanySidebar from "@/data/workspace_sidebar/intercompany.json";
import homeSidebar from "@/data/workspace_sidebar/home.json";
import invoicingSidebar from "@/data/workspace_sidebar/invoicing.json";
import assetsSidebar from "@/data/workspace_sidebar/assets.json";
import { doctypeToSlug } from "@/lib/doctype";

export type SidebarItem = {
  label: string;
  link_to?: string;
  link_type?: string;
  type: string;
  child?: number;
};

export type WorkspaceSidebarDoc = {
  name: string;
  title: string;
  module: string;
  header_icon?: string;
  items: SidebarItem[];
};

export const WORKSPACE_SIDEBARS: Record<string, WorkspaceSidebarDoc> = {
  home: homeSidebar as WorkspaceSidebarDoc,
  intercompany: intercompanySidebar as WorkspaceSidebarDoc,
  buying: buyingSidebar as WorkspaceSidebarDoc,
  selling: sellingSidebar as WorkspaceSidebarDoc,
  stock: stockSidebar as WorkspaceSidebarDoc,
  accounts: invoicingSidebar as WorkspaceSidebarDoc,
  assets: assetsSidebar as WorkspaceSidebarDoc,
};

export const WORKSPACE_SLUGS = new Set([
  "home",
  "intercompany",
  "buying",
  "selling",
  "stock",
  "accounts",
  "invoicing",
  "assets",
]);

export function sidebarLinkToHref(item: SidebarItem): string | null {
  if (item.type === "Section Break" || item.type === "Card Break") return null;
  if (!item.link_to) return null;

  switch (item.link_type) {
    case "DocType":
      return `/app/${doctypeToSlug(item.link_to)}`;
    case "Page":
      return `/app/${item.link_to}`;
    case "Workspace": {
      const slug = item.link_to.toLowerCase().replace(/\s+/g, "-");
      if (slug === "intercompany") return "/app/intercompany";
      if (slug === "home") return "/app";
      return `/app/${slug}`;
    }
    case "Report":
      return `/erpnext/app/query-report/${encodeURIComponent(item.link_to)}`;
    case "Dashboard": {
      const slug = item.link_to.toLowerCase().replace(/\s+/g, "-");
      return `/app/${slug}`;
    }
    default:
      return null;
  }
}

export function flattenSidebarLinks(
  sidebar: WorkspaceSidebarDoc,
  options?: { topLevelOnly?: boolean; maxLinks?: number }
): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];
  const max = options?.maxLinks ?? 40;

  for (const item of sidebar.items) {
    if (item.type === "Section Break") continue;
    if (options?.topLevelOnly && item.child === 1) continue;
    const href = sidebarLinkToHref(item);
    if (!href) continue;
    links.push({ label: item.label, href });
    if (links.length >= max) break;
  }

  return links;
}
