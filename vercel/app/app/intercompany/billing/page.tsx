import Link from "next/link";
import { Suspense } from "react";
import { FrappeDeskEmbedGate } from "@/components/desk/FrappeDeskEmbedGate";
import { IcAccountsTable } from "@/components/IcAccountsTable";
import { frappeNewFormUrl } from "@/lib/frappe-desk";
import { getIcAccounts } from "@/lib/ic/handlers";

export const metadata = {
  title: "IC Billing",
};

async function AccountsSection() {
  try {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load billing data";
    return (
      <div className="error-banner">
        <strong>ERPNext unavailable</strong>
        <p>{message}</p>
      </div>
    );
  }
}

function IcBillingFallback() {
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

export default async function IcBillingPage() {
  return (
    <FrappeDeskEmbedGate
      src={frappeNewFormUrl("Sales Invoice")}
      title="IC Billing — Sales Invoice"
      fallback={<IcBillingFallback />}
    />
  );
}
