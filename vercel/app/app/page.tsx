import Link from "next/link";
import { DESK_WORKSPACES } from "@/lib/navigation";

export const metadata = {
  title: "Home",
};

export default function DeskHomePage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "OpulentAggro";

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">{appName}</p>
        <h1>Desk Home</h1>
        <p className="muted">
          Full OpulentAggro UI on Vercel — ERPNext API backend on Railway. Browse workspaces,
          documents, and intercompany STO workflows.
        </p>
      </header>

      <div className="workspace-grid">
        {DESK_WORKSPACES.filter((ws) => ws.id !== "home").map((ws) => (
          <section key={ws.id} className="card workspace-card">
            <h2>{ws.label}</h2>
            <ul className="workspace-links">
              {ws.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                  {link.description ? (
                    <span className="muted"> — {link.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Modules</h2>
        <div className="workspace-link-grid">
          <Link href="/app/intercompany" className="workspace-link-tile">
            <strong>Intercompany</strong>
            <span>STO workflow</span>
          </Link>
          <Link href="/app/buying" className="workspace-link-tile">
            <strong>Buying</strong>
          </Link>
          <Link href="/app/selling" className="workspace-link-tile">
            <strong>Selling</strong>
          </Link>
          <Link href="/app/stock" className="workspace-link-tile">
            <strong>Stock</strong>
          </Link>
          <Link href="/app/accounts" className="workspace-link-tile">
            <strong>Accounts</strong>
          </Link>
          <Link href="/app/assets" className="workspace-link-tile">
            <strong>Assets</strong>
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Quick Links</h2>
        <div className="hero-grid">
          <Link href="/app/sto-dashboard" className="btn btn-primary">
            STO Dashboard
          </Link>
          <Link href="/app/sto-trace" className="btn btn-primary">
            STO Trace
          </Link>
          <Link href="/app/intercompany/billing" className="btn btn-ghost">
            IC Billing
          </Link>
          <Link href="/api/health" className="btn btn-ghost">
            API Health
          </Link>
        </div>
      </div>
    </>
  );
}
