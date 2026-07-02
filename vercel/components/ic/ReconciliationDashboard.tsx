"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runIcAction } from "@/lib/actions/ic";

type Summary = {
  pending_clearing_count?: number;
  open_dispute_count?: number;
  pending_clearing?: Array<{
    sales_invoice?: string;
    purchase_invoice?: string;
    seller_company?: string;
    buyer_company?: string;
    ar_outstanding?: number;
    ap_outstanding?: number;
    status?: string;
  }>;
  open_disputes?: Array<{
    purchase_order?: string;
    reason?: string;
    status?: string;
  }>;
  by_company?: Record<
    string,
    { pending_clearing?: number; ar_outstanding?: number; ap_outstanding?: number }
  >;
  error?: string;
};

export function ReconciliationDashboard({ summary }: { summary: Summary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (summary.error) {
    return <div className="error-banner">{summary.error}</div>;
  }

  function clearRow(si?: string, pi?: string) {
    if (!si || !pi) return;
    startTransition(async () => {
      setError(null);
      const result = await runIcAction("match_and_clear", {
        sales_invoice: si,
        purchase_invoice: pi,
      });
      if (!result.ok) {
        setError(result.error ?? "Clear failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="sto-trace-layout">
      <div className="sto-section">
        <h4>Summary</h4>
        <div className="workspace-link-grid">
          <div className="workspace-link-tile">
            <strong>{summary.pending_clearing_count ?? 0}</strong>
            <span>Pending Clearing</span>
          </div>
          <div className="workspace-link-tile">
            <strong>{summary.open_dispute_count ?? 0}</strong>
            <span>Open Disputes</span>
          </div>
        </div>
      </div>

      {summary.by_company && Object.keys(summary.by_company).length > 0 ? (
        <div className="sto-section">
          <h4>By Company</h4>
          <table className="desk-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Pending</th>
                <th>AR Outstanding</th>
                <th>AP Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.by_company).map(([company, row]) => (
                <tr key={company}>
                  <td>{company}</td>
                  <td>{row.pending_clearing ?? 0}</td>
                  <td>{row.ar_outstanding ?? 0}</td>
                  <td>{row.ap_outstanding ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="sto-section">
        <h4>Pending Match &amp; Clear</h4>
        {error ? <div className="error-banner inline">{error}</div> : null}
        {(summary.pending_clearing?.length ?? 0) === 0 ? (
          <p className="muted">No pending clearing items.</p>
        ) : (
          <table className="desk-table">
            <thead>
              <tr>
                <th>SI</th>
                <th>PI</th>
                <th>Seller</th>
                <th>Buyer</th>
                <th>AR</th>
                <th>AP</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summary.pending_clearing?.map((row) => (
                <tr key={`${row.sales_invoice}-${row.purchase_invoice}`}>
                  <td>{row.sales_invoice}</td>
                  <td>{row.purchase_invoice}</td>
                  <td>{row.seller_company}</td>
                  <td>{row.buyer_company}</td>
                  <td>{row.ar_outstanding}</td>
                  <td>{row.ap_outstanding}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={pending}
                      onClick={() => clearRow(row.sales_invoice, row.purchase_invoice)}
                    >
                      Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sto-section">
        <h4>Open STO Disputes</h4>
        {(summary.open_disputes?.length ?? 0) === 0 ? (
          <p className="muted">No open disputes.</p>
        ) : (
          <table className="desk-table">
            <thead>
              <tr>
                <th>STO</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summary.open_disputes?.map((row) => (
                <tr key={row.purchase_order}>
                  <td>
                    <Link
                      href={`/app/sto-trace?purchase_order=${encodeURIComponent(row.purchase_order ?? "")}`}
                    >
                      {row.purchase_order}
                    </Link>
                  </td>
                  <td>{row.reason}</td>
                  <td>
                    <Link
                      href={`/app/sto-trace?purchase_order=${encodeURIComponent(row.purchase_order ?? "")}`}
                      className="btn btn-ghost btn-sm"
                    >
                      Trace
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
