import Link from "next/link";
import { Suspense } from "react";
import { TraceSearchForm } from "@/components/TraceSearchForm";
import { StoBackendFallback } from "@/components/sto/StoBackendFallback";
import { TraceView } from "@/components/sto/TraceView";
import { getStoTrace } from "@/lib/sto/handlers";

export const metadata = {
  title: "STO Trace",
};

async function TraceResults({ purchaseOrder }: { purchaseOrder: string }) {
  const trace = await getStoTrace(purchaseOrder);

  if (trace.error) {
    return (
      <StoBackendFallback
        page="sto-trace"
        title="STO Trace"
        query={`purchase_order=${encodeURIComponent(purchaseOrder)}`}
        error={trace.error}
      >
        <div className="error-banner">
          <strong>Trace failed for {purchaseOrder}</strong>
          <p>{trace.error}</p>
        </div>
      </StoBackendFallback>
    );
  }

  return <TraceView trace={trace} />;
}

export default async function StoTracePage({
  searchParams,
}: {
  searchParams: Promise<{ purchase_order?: string }>;
}) {
  const params = await searchParams;
  const purchaseOrder = params.purchase_order?.trim();

  return (
    <div className="sto-trace frappe-page">
      <div className="frappe-page-head">
        <nav className="desk-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/app/intercompany">Intercompany</Link>
          <span aria-hidden>/</span>
          <Link href="/app/sto-dashboard">Stock Transfer Orders</Link>
          <span aria-hidden>/</span>
          <span>STO Trace</span>
        </nav>
        <div className="frappe-page-head-main">
          <h1 className="frappe-page-title">STO Trace</h1>
          <div className="frappe-page-actions">
            <Link href="/app/sto-dashboard" className="btn btn-ghost btn-sm">
              Back to Dashboard
            </Link>
            {purchaseOrder ? (
              <Link
                href={`/app/purchase-order/${encodeURIComponent(purchaseOrder)}`}
                className="btn btn-ghost btn-sm"
              >
                Open Purchase Order
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <TraceSearchForm defaultPo={purchaseOrder} basePath="/app/sto-trace" />

      {purchaseOrder ? (
        <Suspense
          fallback={
            <div className="sto-empty-select">
              <p className="muted">Loading trace for {purchaseOrder}…</p>
            </div>
          }
        >
          <TraceResults purchaseOrder={purchaseOrder} />
        </Suspense>
      ) : (
        <div className="sto-empty-select">
          Select an internal Purchase Order to view the STO document chain.
        </div>
      )}

      <footer className="sto-desk-footer">
        <span className="sto-desk-footer-brand">OpulentAggro</span>
        <span className="muted">Pierre Light · STO Trace</span>
      </footer>
    </div>
  );
}
