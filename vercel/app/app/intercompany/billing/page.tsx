import Link from "next/link";
import { DeskUnavailableBanner } from "@/components/desk/DeskUnavailableBanner";
import { IcAccountsTable } from "@/components/IcAccountsTable";
import { IcBillingForm } from "@/components/ic/IcBillingForm";
import { IcInvoiceStatusPanel } from "@/components/ic/IcInvoiceStatusPanel";
import { IcBillingListEmbeds } from "@/components/ic/IcBillingListEmbeds";
import { isFrappeDeskBootHealthy } from "@/lib/erpnext/desk-probe";
import { isFrappeDeskProxyEnabled } from "@/lib/frappe-desk";
import { getIcAccounts } from "@/lib/ic/handlers";

export const metadata = {
  title: "IC Billing",
};

export default async function IcBillingPage() {
  const proxyEnabled = isFrappeDeskProxyEnabled();
  const deskHealthy = proxyEnabled ? await isFrappeDeskBootHealthy() : false;
  const data = await getIcAccounts();
  const pairs = data.pairs ?? [];
  const loadError = data.error;

  return (
    <div className="frappe-workspace">
      <nav className="desk-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/app/intercompany">Intercompany</Link>
        <span aria-hidden>/</span>
        <span>IC Billing</span>
      </nav>

      <div className="workspace-block-header">
        <p className="h4">
          <strong>IC Billing</strong>
        </p>
      </div>
      <p className="workspace-block-paragraph muted">
        Create linked AR/AP invoice pairs across intercompany accounts. Browse Sales and Purchase
        invoices below, or use ERPNext forms for taxes, attachments, and submission.
      </p>

      {proxyEnabled && !deskHealthy ? (
        <DeskUnavailableBanner reason="ERPNext desk session boot failed. Use the form and links below; invoice lists open on ported views." />
      ) : null}

      {loadError ? (
        <div className="error-banner">
          <strong>ERPNext unavailable</strong>
          <p>{loadError}</p>
        </div>
      ) : (
        <>
          <IcBillingForm pairs={pairs} />
          <IcInvoiceStatusPanel />

          {pairs.length > 0 ? (
            <div className="card" style={{ marginTop: "1rem" }}>
              <h2>Intercompany Account Pairs</h2>
              <IcAccountsTable pairs={pairs} />
            </div>
          ) : null}
        </>
      )}

      {deskHealthy ? (
        <IcBillingListEmbeds />
      ) : (
        <div className="workspace-link-grid" style={{ marginTop: "1.5rem" }}>
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
      )}
    </div>
  );
}
