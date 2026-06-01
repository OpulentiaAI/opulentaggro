import Link from "next/link";
import { Suspense } from "react";
import { FrappeDeskEmbed } from "@/components/desk/FrappeDeskEmbed";
import { FrappeEmbedMode } from "@/components/desk/FrappeEmbedMode";
import { IcAccountsTable } from "@/components/IcAccountsTable";
import { frappeNewFormUrl, isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";
import { getIcAccounts } from "@/lib/ic/handlers";

export const metadata = {
  title: "IC Billing",
};

async function AccountsSection() {
  const data = await getIcAccounts();

  if (data.error) {
    return (
      <div className="error-banner">
        <strong>ERPNext unavailable</strong>
        <p>{data.error}</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h2>Intercompany Account Pairs</h2>
      <IcAccountsTable pairs={data.pairs ?? []} />
    </div>
  );
}

export default function IcBillingPage() {
  const embed = isFrappeDeskProxyEnabled();

  if (embed) {
    return (
      <>
        <FrappeEmbedMode fullBleed />
        <div className="ic-billing-embed-toolbar">
          <Link href={frappeNewFormUrl("Sales Invoice")} className="btn btn-primary btn-sm">
            New Sales Invoice
          </Link>
          <Link href={frappeNewFormUrl("Purchase Invoice")} className="btn btn-primary btn-sm">
            New Purchase Invoice
          </Link>
          <Link href="/app/sales-invoice" className="btn btn-ghost btn-sm">
            Sales Invoice List
          </Link>
          <Link href="/app/purchase-invoice" className="btn btn-ghost btn-sm">
            Purchase Invoice List
          </Link>
        </div>
        <FrappeDeskEmbed
          src={frappeNewFormUrl("Sales Invoice")}
          title="IC Billing — Sales Invoice"
        />
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Intercompany</p>
        <h1>IC Billing</h1>
        <p className="muted">
          Create intercompany AR/AP invoices in ERPNext. Use Sales Invoice and Purchase Invoice
          forms for full Frappe UI (tabs, taxes, attachments).
        </p>
      </header>

      <div className="workspace-link-grid" style={{ marginBottom: "1.5rem" }}>
        <Link href="/app/sales-invoice/new" className="workspace-link-tile">
          <strong>New Sales Invoice</strong>
          <span>AR / selling company</span>
        </Link>
        <Link href="/app/purchase-invoice/new" className="workspace-link-tile">
          <strong>New Purchase Invoice</strong>
          <span>AP / buying company</span>
        </Link>
        <Link href="/app/sales-invoice" className="workspace-link-tile">
          <strong>Sales Invoices</strong>
        </Link>
        <Link href="/app/purchase-invoice" className="workspace-link-tile">
          <strong>Purchase Invoices</strong>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="card">
            <p className="muted">Loading billing data…</p>
          </div>
        }
      >
        <AccountsSection />
      </Suspense>
    </>
  );
}
