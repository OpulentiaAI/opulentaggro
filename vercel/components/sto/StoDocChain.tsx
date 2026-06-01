import Link from "next/link";
import { doctypeFormPath } from "@/lib/doctype";
import type { StoTraceDocumentsObject } from "@/lib/types/sto";

function DocCard({
  doctype,
  doc,
}: {
  doctype: string;
  doc?: Record<string, unknown> | null;
}) {
  if (!doc?.name) {
    return (
      <div className="sto-doc-card">
        <div className="doctype">{doctype}</div>
        <div className="meta">Not created</div>
      </div>
    );
  }

  const name = String(doc.name);
  const status = doc.status ?? doc.docstatus;

  return (
    <div className="sto-doc-card">
      <div className="doctype">{doctype}</div>
      <div className="name">
        <Link href={doctypeFormPath(doctype, name)}>{name}</Link>
      </div>
      <div className="meta">Status: {status != null ? String(status) : "—"}</div>
    </div>
  );
}

/** Document chain grid — mirrors sto_trace.js render_documents. */
export function StoDocChain({ documents }: { documents: StoTraceDocumentsObject }) {
  const deliveryNotes = documents.delivery_notes ?? [];
  const salesInvoices = documents.sales_invoices ?? [];
  const purchaseInvoices = documents.purchase_invoices ?? [];
  const purchaseReceipts = documents.purchase_receipts ?? [];

  return (
    <div className="sto-doc-grid">
      <DocCard doctype="Purchase Order" doc={documents.purchase_order} />
      <DocCard doctype="Sales Order" doc={documents.sales_order} />
      {deliveryNotes.length
        ? deliveryNotes.map((dn) => (
            <DocCard key={`dn-${String(dn.name)}`} doctype="Delivery Note" doc={dn} />
          ))
        : <DocCard doctype="Delivery Note" doc={null} />}
      {salesInvoices.length
        ? salesInvoices.map((si) => (
            <DocCard key={`si-${String(si.name)}`} doctype="Sales Invoice" doc={si} />
          ))
        : <DocCard doctype="Sales Invoice" doc={null} />}
      {purchaseInvoices.length
        ? purchaseInvoices.map((pi) => (
            <DocCard key={`pi-${String(pi.name)}`} doctype="Purchase Invoice" doc={pi} />
          ))
        : <DocCard doctype="Purchase Invoice" doc={null} />}
      {purchaseReceipts.length
        ? purchaseReceipts.map((pr) => (
            <DocCard key={`pr-${String(pr.name)}`} doctype="Purchase Receipt" doc={pr} />
          ))
        : <DocCard doctype="Purchase Receipt" doc={null} />}
    </div>
  );
}
