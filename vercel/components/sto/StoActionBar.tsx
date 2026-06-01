"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runStoAction } from "@/lib/actions/sto";

const STAGE_ACTIONS: Record<
  string,
  { label: string; action: string; confirm?: string }
> = {
  Draft: { label: "Submit (DoA Approval)", action: "submit", confirm: "Submit this STO for approval?" },
  "Pending Approval": {
    label: "Approve & Route to Sender",
    action: "approve_and_route",
    confirm: "Approve and route this STO?",
  },
  Approved: {
    label: "Post Goods In Transit",
    action: "post_goods_in_transit",
    confirm: "Post goods in transit?",
  },
  "Goods In Transit": {
    label: "Create IC Invoice",
    action: "create_ic_invoice",
    confirm: "Create intercompany invoice?",
  },
  "IC Invoiced": {
    label: "Post Goods Receipt",
    action: "post_goods_receipt",
    confirm: "Post goods receipt?",
  },
  Received: {
    label: "Run Three-Way Match",
    action: "three_way_match",
    confirm: "Run three-way match?",
  },
};

export function StoActionBar({
  purchaseOrder,
  stage,
}: {
  purchaseOrder: string;
  stage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const primary = stage ? STAGE_ACTIONS[stage] : undefined;
  const showRerun = stage && ["Received", "Dispute", "Three Way Matched"].includes(stage);

  function invoke(action: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await runStoAction(action, { purchase_order: purchaseOrder });
      if (!result.ok) {
        setError(result.error ?? "Action failed");
        return;
      }
      setMessage("STO updated successfully");
      router.refresh();
    });
  }

  return (
    <div className="sto-action-bar">
      {error ? <div className="error-banner inline">{error}</div> : null}
      {message ? <div className="success-banner inline">{message}</div> : null}
      {primary ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() => invoke(primary.action, primary.confirm)}
        >
          {pending ? "Working…" : primary.label}
        </button>
      ) : null}
      {showRerun ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => invoke("three_way_match", "Re-run three-way match?")}
        >
          Re-run Three-Way Match
        </button>
      ) : null}
      {!primary && !showRerun ? (
        <p className="muted">No workflow actions available for stage &ldquo;{stage}&rdquo;.</p>
      ) : null}
    </div>
  );
}
