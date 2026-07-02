"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runStoAction } from "@/lib/actions/sto";

export function StoDisputePanel({
  purchaseOrder,
  stage,
  dispute,
  matchDispute,
}: {
  purchaseOrder: string;
  stage?: string;
  dispute?: {
    status?: string;
    reason?: string;
    resolution?: string;
    parties?: string[];
  } | null;
  matchDispute?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isDispute = stage === "Dispute" || dispute?.status === "Open" || matchDispute;
  if (!isDispute && !dispute) return null;

  function openDispute() {
    const reason = window.prompt("Dispute reason:");
    if (!reason) return;
    startTransition(async () => {
      setError(null);
      const result = await runStoAction("open_dispute", {
        purchase_order: purchaseOrder,
        reason,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to open dispute");
        return;
      }
      router.refresh();
    });
  }

  function resolveDispute() {
    const resolution = window.prompt("Resolution notes:");
    if (!resolution) return;
    startTransition(async () => {
      setError(null);
      const result = await runStoAction("resolve_dispute", {
        purchase_order: purchaseOrder,
        resolution,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to resolve dispute");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="sto-section">
      <h4>Dispute Resolution</h4>
      <div className="sto-match-panel dispute">
        <div>
          <strong>Status: {dispute?.status ?? (matchDispute ? "Open (match)" : "None")}</strong>
        </div>
        {dispute?.reason ? <div className="text-muted">Reason: {dispute.reason}</div> : null}
        {dispute?.parties?.length ? (
          <div className="text-muted">Parties: {dispute.parties.join(", ")}</div>
        ) : null}
        {dispute?.resolution ? (
          <div className="text-muted">Resolution: {dispute.resolution}</div>
        ) : null}
        {error ? <div className="error-banner inline">{error}</div> : null}
        <div className="sto-actions" style={{ marginTop: 8 }}>
          {dispute?.status !== "Open" && isDispute ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={openDispute}>
              Open Dispute
            </button>
          ) : null}
          {dispute?.status === "Open" ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={resolveDispute}>
              Resolve Dispute
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
