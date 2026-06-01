import { FrappeDeskEmbed } from "@/components/desk/FrappeDeskEmbed";
import { FrappeEmbedMode } from "@/components/desk/FrappeEmbedMode";
import { frappeWorkspaceUrl, isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";
import Link from "next/link";
import { flattenSidebarLinks, WORKSPACE_SIDEBARS } from "@/lib/workspace-sidebar";

export function WorkspaceEmbedPage({
  workspaceId,
  title,
}: {
  workspaceId: keyof typeof WORKSPACE_SIDEBARS;
  title: string;
}) {
  const sidebar = WORKSPACE_SIDEBARS[workspaceId];
  const links = sidebar ? flattenSidebarLinks(sidebar, { maxLinks: 32 }) : [];

  if (isFrappeDeskProxyEnabled()) {
    const frappeSlug =
      workspaceId === "accounts" ? "invoicing" : workspaceId;
    return (
      <>
        <FrappeEmbedMode fullBleed />
        <FrappeDeskEmbed
          src={frappeWorkspaceUrl(frappeSlug === "home" ? "home" : frappeSlug)}
          title={`${title} workspace`}
        />
      </>
    );
  }

  return (
    <div className="frappe-workspace">
      <nav className="desk-breadcrumbs" aria-label="Breadcrumb">
        <span>Home</span>
        <span aria-hidden>/</span>
        <span>{title}</span>
      </nav>
      <div className="workspace-block-header">
        <p className="h4">
          <strong>{title}</strong>
        </p>
      </div>
      <div className="workspace-link-grid">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="workspace-link-tile">
            <strong>{l.label}</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
