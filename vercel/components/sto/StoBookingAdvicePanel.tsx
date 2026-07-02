"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runStoAction } from "@/lib/actions/sto";

export function StoBookingAdvicePanel({
  purchaseOrder,
  bookingAdvice,
  deliveryNotes,
}: {
  purchaseOrder: string;
  bookingAdvice?: {
    delivery_note?: string;
    file?: string;
    sharepoint_archive_path?: string;
  } | null;
  deliveryNotes?: { name?: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasDn = (deliveryNotes?.length ?? 0) > 0;

  function generate() {
    startTransition(async () => {
      setError(null);
      const result = await runStoAction("generate_booking_advice", {
        purchase_order: purchaseOrder,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to generate booking advice");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="sto-section">
      <h4>Booking Advice / BOL</h4>
      <div className="sto-match-panel">
        {bookingAdvice?.file ? (
          <>
            <div>
              <strong>Generated</strong> — DN {bookingAdvice.delivery_note}
            </div>
            <div style={{ marginTop: 8 }}>
              <a href={bookingAdvice.file} className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">
                Download BOL
              </a>
            </div>
            {bookingAdvice.sharepoint_archive_path ? (
              <div className="text-muted" style={{ marginTop: 8 }}>
                SharePoint Tier 2 archive: {bookingAdvice.sharepoint_archive_path}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="text-muted">
              Generate booking advice / bill of lading after goods in transit is posted.
            </div>
            {error ? <div className="error-banner inline">{error}</div> : null}
            {hasDn ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: 8 }}
                disabled={pending}
                onClick={generate}
              >
                {pending ? "Generating…" : "Generate Booking Advice"}
              </button>
            ) : (
              <div className="text-muted" style={{ marginTop: 8 }}>
                Post goods in transit first to create a Delivery Note.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
