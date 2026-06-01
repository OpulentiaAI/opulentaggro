import Link from "next/link";
import { Suspense } from "react";
import { FrappeDeskPageEmbed } from "@/components/desk/FrappeDeskPageEmbed";
import { TraceSearchForm } from "@/components/TraceSearchForm";
import { TraceView } from "@/components/sto/TraceView";
import { frappePageUrl } from "@/lib/frappe-desk";
import { getStoTrace } from "@/lib/sto/handlers";

export const metadata = {
  title: "STO Trace",
};

async function TraceResults({ purchaseOrder }: { purchaseOrder: string }) {
  const trace = await getStoTrace(purchaseOrder);

  if (trace.error) {
    return (
      <div className="error-banner">
        <strong>Trace failed for {purchaseOrder}</strong>
        <p>{trace.error}</p>
      </div>
    );
  }

  return <TraceView trace={trace} />;
}

function StoTraceFallback({
  purchaseOrder,
}: {
  purchaseOrder: string | undefined;
}) {
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
    </div>
  );
}

export default async function StoTracePage({
  searchParams,
}: {
  searchParams: Promise<{ purchase_order?: string }>;
}) {
  const params = await searchParams;
  const purchaseOrder = params.purchase_order?.trim();

  const embedSrc = purchaseOrder
    ? `${frappePageUrl("sto-trace")}?purchase_order=${encodeURIComponent(purchaseOrder)}`
    : frappePageUrl("sto-trace");

  return (
    <FrappeDeskPageEmbed
      src={embedSrc}
      title="STO Trace"
      fallback={<StoTraceFallback purchaseOrder={purchaseOrder} />}
    />
  );
}
