/** Desk sidebar workspaces — mirrors ERPNext workspace_sidebar JSON. */

import {
  WORKSPACE_SIDEBARS,
  flattenSidebarLinks,
} from "@/lib/workspace-sidebar";

export type NavLink = {
  href: string;
  label: string;
  description?: string;
};

export type Workspace = {
  id: string;
  label: string;
  icon?: string;
  links: NavLink[];
};

const IC_EXTRA: NavLink[] = [
  { href: "/app/intercompany", label: "Workspace" },
  { href: "/app/sto-dashboard", label: "STO Dashboard" },
  { href: "/app/sto-trace", label: "STO Trace" },
  { href: "/app/intercompany/billing", label: "IC Billing" },
  { href: "/app/intercompany/triangular", label: "Triangular Sales" },
  { href: "/app/reconciliation", label: "IC Reconciliation" },
];

function wsLinks(id: keyof typeof WORKSPACE_SIDEBARS, max = 24): NavLink[] {
  const sidebar = WORKSPACE_SIDEBARS[id];
  if (!sidebar) return [];
  return flattenSidebarLinks(sidebar, { topLevelOnly: true, maxLinks: max }).map(
    (l) => ({ href: l.href, label: l.label })
  );
}

export const DESK_WORKSPACES: Workspace[] = [
  {
    id: "home",
    label: "Home",
    links: [
      { href: "/app", label: "Desk Home", description: "All workspaces" },
      ...wsLinks("home", 6),
    ],
  },
  {
    id: "intercompany",
    label: "Intercompany",
    links: IC_EXTRA,
  },
  {
    id: "buying",
    label: "Buying",
    links: wsLinks("buying"),
  },
  {
    id: "selling",
    label: "Selling",
    links: wsLinks("selling"),
  },
  {
    id: "stock",
    label: "Stock",
    links: wsLinks("stock"),
  },
  {
    id: "accounts",
    label: "Accounts",
    links: wsLinks("accounts"),
  },
  {
    id: "assets",
    label: "Assets",
    links: wsLinks("assets", 12),
  },
];

export function findActiveWorkspace(pathname: string): string {
  for (const ws of DESK_WORKSPACES) {
    if (ws.links.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))) {
      return ws.id;
    }
  }
  if (pathname.startsWith("/app/sto-")) return "intercompany";
  if (pathname.startsWith("/app/intercompany")) return "intercompany";
  if (pathname.startsWith("/app/buying")) return "buying";
  if (pathname.startsWith("/app/selling")) return "selling";
  if (pathname.startsWith("/app/stock")) return "stock";
  if (pathname.startsWith("/app/invoicing") || pathname.startsWith("/app/accounts")) {
    return "accounts";
  }
  if (pathname.startsWith("/app/assets")) return "assets";
  if (pathname.startsWith("/app/")) return "home";
  return "home";
}
