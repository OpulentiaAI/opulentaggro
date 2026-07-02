"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runStoAction } from "@/lib/actions/sto";

export function StoApprovalBanner({
  purchaseOrder,
  approval,
  stage,
}: {
  purchaseOrder: string;
  approval?: { status?: string; reason?: string; requestor?: string };
  stage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = approval?.status ?? "Not Requested";
  const showBanner =
    stage === "Draft" || status === "Pending Approval" || status === "Rejected";

  if (!showBanner) return null;

  function invoke(action: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      setError(null);
      const result = await runStoAction(action, { purchase_order: purchaseOrder });
      if (!result.ok) {
        setError(result.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="sto-section sto-approval-banner">
      <h4>DoA Approval</h4>
      <div className={`sto-match-panel${status === "Rejected" ? " dispute" : ""}`}>
        <div>
          <strong>Status: {status}</strong>
        </div>
        {approval?.requestor ? (
          <div className="text-muted">Requestor: {approval.requestor}</div>
        ) : null}
        {approval?.reason ? (
          <div className="text-muted">Reason: {approval.reason}</div>
        ) : null}
        {error ? <div className="error-banner inline">{error}</div> : null}
        <div className="sto-actions" style={{ marginTop: 8 }}>
          {status === "Not Requested" && stage === "Draft" ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending}
              onClick={() => invoke("request_approval", "Request DoA approval for this STO?")}
            >
              Request Approval
            </button>
          ) : null}
          {status === "Pending Approval" ? (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pending}
                onClick={() => invoke("approve", "Approve and submit this STO?")}
              >
                Approve STO
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending}
                onClick={() => {
                  const reason = window.prompt("Rejection reason (optional):") ?? undefined;
                  startTransition(async () => {
                    setError(null);
                    const result = await runStoAction("reject", {
                      purchase_order: purchaseOrder,
                      reason,
                    });
                    if (!result.ok) {
                      setError(result.error ?? "Reject failed");
                      return;
                    }
                    router.refresh();
                  });
                }}
              >
                Reject
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
