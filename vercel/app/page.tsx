import Link from "next/link";

export default function HomePage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "OpulentAggro";

  return (
    <div className="landing-page">
      <header className="landing-hero">
        <p className="eyebrow">{appName}</p>
        <h1>Intercompany ERP on Vercel</h1>
        <p className="muted landing-lead">
          Full OpulentAggro desk UI on Vercel — STO workflows, document lists, forms, and IC
          billing. Python/Frappe/MariaDB backend runs on Railway.
        </p>
        <div className="landing-actions">
          <Link href="/app" className="btn btn-primary">
            Open Desk
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
        </div>
      </header>

      <div className="hero-grid">
        <section className="card">
          <h2>STO Dashboard</h2>
          <p className="muted">Intercompany PO list with workflow stages.</p>
          <Link href="/app/sto-dashboard" className="btn btn-primary">
            Open
          </Link>
        </section>
        <section className="card">
          <h2>Document Lists</h2>
          <p className="muted">PO, SO, DN, PR, SI, PI and masters.</p>
          <Link href="/app/purchase-order" className="btn btn-primary">
            Browse
          </Link>
        </section>
        <section className="card">
          <h2>IC Billing</h2>
          <p className="muted">Create AR/AP invoice pairs.</p>
          <Link href="/app/intercompany/billing" className="btn btn-primary">
            Billing
          </Link>
        </section>
        <section className="card">
          <h2>API Gateway</h2>
          <p className="muted">
            MCP at <code>/api/mcp</code>, proxies at <code>/api/sto/*</code>.
          </p>
          <Link href="/api/health" className="btn btn-ghost">
            Health
          </Link>
        </section>
      </div>
    </div>
  );
}
