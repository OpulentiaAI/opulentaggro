"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESK_WORKSPACES, findActiveWorkspace } from "@/lib/navigation";

export function DeskSidebar() {
  const pathname = usePathname();
  const activeWs = findActiveWorkspace(pathname);

  return (
    <aside className="desk-sidebar" aria-label="Workspaces">
      <nav className="desk-sidebar-nav">
        {DESK_WORKSPACES.map((ws) => (
          <div key={ws.id} className="desk-sidebar-section">
            <div
              className={`desk-sidebar-heading${activeWs === ws.id ? " active" : ""}`}
            >
              {ws.label}
            </div>
            <ul className="desk-sidebar-links">
              {ws.links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/app" && pathname.startsWith(`${link.href}/`));
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={isActive ? "active" : undefined}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
