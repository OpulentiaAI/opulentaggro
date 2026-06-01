import { StageBadge } from "@/components/StageBadge";
import { DocChainGrid } from "@/components/doctype/FormView";
import { StoActionBar } from "@/components/sto/StoActionBar";
import { StoPipeline } from "@/components/sto/StoPipeline";
import type { StoTraceResponse } from "@/lib/types/sto";

type TraceDocuments = Record<string, unknown>;

function normalizeDocuments(trace: StoTraceResponse): TraceDocuments | null {
  if (!trace.documents) return null;
  if (Array.isArray(trace.documents)) {
    const out: TraceDocuments = {};
    for (const doc of trace.documents) {
      const key = doc.doctype.toLowerCase().replace(/\s+/g, "_") + "s";
      if (!out[key]) out[key] = [];
      (out[key] as unknown[]).push(doc);
    }
    return out;
  }
  return trace.documents as TraceDocuments;
}

export function TraceView({ trace }: { trace: StoTraceResponse }) {
  const documents = normalizeDocuments(trace);
  const match = trace.three_way_match as Record<string, unknown> | undefined;

  const comparison = match?.comparison as Record<string, unknown> | undefined;

  return (
    <div className="sto-trace-layout">
      <div className="sto-header">
        <div className="po-title">{trace.purchase_order}</div>
        <StageBadge stage={trace.stage} />
        <span className="muted">{trace.brand ?? "OpulentAggro"}</span>
      </div>

      <StoPipeline
        stages={trace.stages}
        currentStage={trace.stage}
        stageIndex={trace.stage_index}
      />

      {trace.purchase_order && trace.stage ? (
        <StoActionBar purchaseOrder={trace.purchase_order} stage={trace.stage} />
      ) : null}

      {match ? (
        <div className="sto-section">
          <h4>Three-Way Match</h4>
          <div className={`sto-match-panel${match.matched ? " matched" : " dispute"}`}>
            <div>
              <strong>{match.matched ? "Matched" : "Dispute"}</strong>
            </div>
            {match.message || match.reason ? (
              <div className="muted">{String(match.message ?? match.reason)}</div>
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
                  PO Amount: {String(comparison.po_amount ?? "-")} | PI Amount:{" "}
                  {String(comparison.pi_amount ?? "-")} | Price Var:{" "}
                  {comparison.price_variance_percent != null
                    ? `${Number(comparison.price_variance_percent).toFixed(2)}%`
                    : "-"}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="sto-section">
        <h4>Document Chain</h4>
        {documents ? (
          <div className="sto-doc-grid">
            <DocChainGrid documents={documents} />
          </div>
        ) : (
          <p className="muted">No linked documents in trace.</p>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use TraceView */
export function TraceTimeline({ trace }: { trace: StoTraceResponse }) {
  return <TraceView trace={trace} />;
}
