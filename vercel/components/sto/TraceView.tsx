import Link from "next/link";
import { StageBadge } from "@/components/StageBadge";
import { StoActionBar } from "@/components/sto/StoActionBar";
import { StoDocChain } from "@/components/sto/StoDocChain";
import { StoPipeline } from "@/components/sto/StoPipeline";
import type { StoTraceDocumentsObject, StoTraceResponse } from "@/lib/types/sto";

function formatCurrency(value: unknown): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function normalizeDocuments(trace: StoTraceResponse): StoTraceDocumentsObject | null {
  if (!trace.documents) return null;
  if (Array.isArray(trace.documents)) {
    const out: StoTraceDocumentsObject = {};
    for (const doc of trace.documents) {
      const keyMap: Record<string, keyof StoTraceDocumentsObject> = {
        "Purchase Order": "purchase_order",
        "Sales Order": "sales_order",
        "Delivery Note": "delivery_notes",
        "Sales Invoice": "sales_invoices",
        "Purchase Invoice": "purchase_invoices",
        "Purchase Receipt": "purchase_receipts",
      };
      const key = keyMap[doc.doctype];
      if (!key) continue;
      if (key === "purchase_order" || key === "sales_order") {
        out[key] = doc as unknown as Record<string, unknown>;
      } else {
        const arr = (out[key] as Record<string, unknown>[] | undefined) ?? [];
        arr.push(doc as unknown as Record<string, unknown>);
        out[key] = arr;
      }
    }
    return out;
  }
  return trace.documents as StoTraceDocumentsObject;
}

export function TraceView({ trace }: { trace: StoTraceResponse }) {
  const documents = normalizeDocuments(trace);
  const match = trace.three_way_match;
  const comparison = match?.comparison;

  return (
    <div className="sto-trace-layout">
      <div className="sto-header">
        <div className="po-title">{trace.purchase_order}</div>
        <StageBadge stage={trace.stage} />
        <span className="text-muted">OpulentAggro</span>
      </div>

      <StoPipeline
        stages={trace.stages}
        currentStage={trace.stage}
        stageIndex={trace.stage_index}
      />

      <div className="sto-section">
        <h4>Document Chain</h4>
        {documents ? (
          <StoDocChain documents={documents} />
        ) : (
          <p className="muted">No linked documents in trace.</p>
        )}
      </div>

      {match ? (
        <div className="sto-section">
          <h4>Three-Way Match</h4>
          <div className={`sto-match-panel${match.matched ? " matched" : " dispute"}`}>
            <div>
              <strong>{match.matched ? "Matched" : "Dispute"}</strong>
            </div>
            {match.message || match.reason ? (
              <div className="text-muted">{String(match.message ?? match.reason)}</div>
            ) : null}
            {comparison ? (
              <>
                <div style={{ marginTop: 8 }}>
                  PO Qty: {String(comparison.po_qty ?? "-")} | PR Qty:{" "}
                  {String(comparison.pr_qty ?? "-")} | Qty Var:{" "}
                  {comparison.qty_variance_percent != null
                    ? `${Number(comparison.qty_variance_percent).toFixed(2)}%`
                    : "-"}
                </div>
                <div>
                  PO Amount: {formatCurrency(comparison.po_amount)} | PI Amount:{" "}
                  {formatCurrency(comparison.pi_amount)} | Price Var:{" "}
                  {comparison.price_variance_percent != null
                    ? `${Number(comparison.price_variance_percent).toFixed(2)}%`
                    : "-"}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {trace.purchase_order && trace.stage ? (
        <StoActionBar purchaseOrder={trace.purchase_order} stage={trace.stage} />
      ) : null}
    </div>
  );
}

/** @deprecated Use TraceView */
export function TraceTimeline({ trace }: { trace: StoTraceResponse }) {
  return <TraceView trace={trace} />;
}
