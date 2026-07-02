"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runIcAction } from "@/lib/actions/ic";

export function StoClearingPanel({
  clearingStatus,
  salesInvoice,
  purchaseInvoice,
  matchRoute,
}: {
  clearingStatus?: {
    status?: string;
    cleared?: boolean;
    ar_outstanding?: number;
    ap_outstanding?: number;
  } | null;
  salesInvoice?: string;
  purchaseInvoice?: string;
  matchRoute?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!salesInvoice && !purchaseInvoice) return null;
  if (matchRoute && matchRoute !== "ic_match_and_clear" && !clearingStatus) return null;

  function clearInvoices() {
    if (!window.confirm("Match and clear intercompany AR/AP for this STO?")) return;
    startTransition(async () => {
      setError(null);
      const result = await runIcAction("match_and_clear", {
        sales_invoice: salesInvoice,
        purchase_invoice: purchaseInvoice,
      });
      if (!result.ok) {
        setError(result.error ?? "Clearing failed");
        return;
      }
      router.refresh();
    });
  }

  const cleared = clearingStatus?.cleared || clearingStatus?.status === "Cleared";

  return (
    <div className="sto-section">
      <h4>IC Match &amp; Clear (F110-lite)</h4>
      <div className={`sto-match-panel${cleared ? " matched" : ""}`}>
        <div>
          <strong>{cleared ? "Cleared" : "Pending Clearing"}</strong>
        </div>
        {clearingStatus ? (
          <div className="text-muted" style={{ marginTop: 4 }}>
            AR outstanding: {clearingStatus.ar_outstanding ?? "—"} | AP outstanding:{" "}
            {clearingStatus.ap_outstanding ?? "—"}
          </div>
        ) : null}
        {error ? <div className="error-banner inline">{error}</div> : null}
        {!cleared && salesInvoice && purchaseInvoice ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginTop: 8 }}
            disabled={pending}
            onClick={clearInvoices}
          >
            {pending ? "Clearing…" : "Match & Clear"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
