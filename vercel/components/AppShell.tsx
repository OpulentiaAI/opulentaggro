import Link from "next/link";
import { getErpnextDeskUrl } from "@/lib/route-map";

const NAV_ITEMS = [
  { href: "/sto-dashboard", label: "STO Dashboard" },
  { href: "/sto-trace", label: "STO Trace" },
  { href: "/intercompany", label: "Intercompany" },
] as const;

export function AppShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath?: string;
}) {
  const erpnextUrl = getErpnextDeskUrl("/app/sto-dashboard");
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "OpulentAggro";

  return (
    <div className="app-shell">
      <header className="app-nav">
        <Link href="/" className="app-nav-brand">
          {appName}
        </Link>
        <nav className="app-nav-links" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={currentPath === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          {erpnextUrl ? (
            <a href={erpnextUrl} target="_blank" rel="noopener noreferrer">
              ERPNext Desk ↗
            </a>
          ) : null}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
