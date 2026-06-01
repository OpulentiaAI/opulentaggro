import Link from "next/link";

export const metadata = {
  title: "Intercompany",
};

const STO_LINKS = [
  { href: "/app/sto-dashboard", label: "STO Dashboard", desc: "Summary grid and internal PO list" },
  { href: "/app/sto-trace", label: "STO Trace", desc: "Document chain and workflow actions" },
  { href: "/app/purchase-order", label: "Internal Purchase Orders", desc: "Purchase Order list" },
];

const DOC_LINKS = [
  { href: "/app/sales-order", label: "Sales Order" },
  { href: "/app/delivery-note", label: "Delivery Note" },
  { href: "/app/purchase-receipt", label: "Purchase Receipt" },
  { href: "/app/sales-invoice", label: "Sales Invoice" },
  { href: "/app/purchase-invoice", label: "Purchase Invoice" },
];

const MASTER_LINKS = [
  { href: "/app/supplier", label: "Supplier" },
  { href: "/app/customer", label: "Customer" },
  { href: "/app/warehouse", label: "Warehouse" },
];

const BILLING = { href: "/app/intercompany/billing", label: "IC Billing", desc: "Create AR/AP invoice pairs" };

export default function IntercompanyWorkspacePage() {
  return (
    <div className="frappe-workspace">
      <nav className="desk-breadcrumbs" aria-label="Breadcrumb">
        <span>Home</span>
        <span aria-hidden>/</span>
        <span>Intercompany</span>
      </nav>

      <div className="workspace-block-header">
        <p className="h4">
          <strong>OpulentAggro Intercompany</strong>
        </p>
      </div>
      <p className="workspace-block-paragraph muted">
        Manage stock transfer orders across companies — from internal PO through goods in transit,
        IC invoicing, receipt, and three-way match.
      </p>

      <div className="workspace-block-header">
        <h2>Stock Transfer Orders</h2>
      </div>
      <div className="workspace-link-grid">
        {STO_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="workspace-link-tile">
            <strong>{l.label}</strong>
            {l.desc ? <span>{l.desc}</span> : null}
          </Link>
        ))}
        <Link href={BILLING.href} className="workspace-link-tile">
          <strong>{BILLING.label}</strong>
          <span>{BILLING.desc}</span>
        </Link>
      </div>

      <div className="workspace-block-header" style={{ marginTop: "1.5rem" }}>
        <h2>Documents</h2>
      </div>
      <div className="workspace-link-grid">
        {DOC_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="workspace-link-tile">
            <strong>{l.label}</strong>
          </Link>
        ))}
      </div>

      <div className="workspace-block-header" style={{ marginTop: "1.5rem" }}>
        <h2>Masters</h2>
      </div>
      <div className="workspace-link-grid">
        {MASTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="workspace-link-tile">
            <strong>{l.label}</strong>
          </Link>
        ))}
      </div>

      <footer className="sto-desk-footer">
        <span className="sto-desk-footer-brand">OpulentAggro</span>
        <span className="muted">Pierre Light · Intercompany workspace</span>
      </footer>
    </div>
  );
}
