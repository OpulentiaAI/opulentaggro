"use client";

import { useState, useTransition } from "react";
import { runIcAction } from "@/lib/actions/ic";

type InvoiceStatus = {
  sales_invoice?: { name?: string; docstatus?: number; status?: string; outstanding_amount?: number };
  purchase_invoice?: { name?: string; docstatus?: number; status?: string; outstanding_amount?: number };
  linked?: boolean;
  ar_posted?: boolean;
  ap_posted?: boolean;
  fully_posted?: boolean;
};

export function IcInvoiceStatusPanel() {
  const [salesInvoice, setSalesInvoice] = useState("");
  const [purchaseInvoice, setPurchaseInvoice] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function lookup() {
    if (!salesInvoice && !purchaseInvoice) {
      setError("Enter a Sales Invoice and/or Purchase Invoice name");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await runIcAction("get_invoice_status", {
        sales_invoice: salesInvoice || undefined,
        purchase_invoice: purchaseInvoice || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Status lookup failed");
        setStatus(null);
        return;
      }
      setStatus(result.data as InvoiceStatus);
    });
  }

  function submitInvoices() {
    if (!salesInvoice && !purchaseInvoice) return;
    if (!window.confirm("Submit the specified intercompany invoice(s)?")) return;
    startTransition(async () => {
      setError(null);
      const result = await runIcAction("submit_invoice", {
        sales_invoice: salesInvoice || undefined,
        purchase_invoice: purchaseInvoice || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Submit failed");
        return;
      }
      lookup();
    });
  }

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h2>Invoice Status &amp; Submit</h2>
      <p className="muted">
        Trace AR/AP posting for linked intercompany invoices or submit draft invoices.
      </p>
      <div className="form-grid" style={{ display: "grid", gap: "0.75rem", maxWidth: 480 }}>
        <label>
          Sales Invoice
          <input
            className="input"
            value={salesInvoice}
            onChange={(e) => setSalesInvoice(e.target.value)}
            placeholder="ACC-SINV-2026-00001"
          />
        </label>
        <label>
          Purchase Invoice
          <input
            className="input"
            value={purchaseInvoice}
            onChange={(e) => setPurchaseInvoice(e.target.value)}
            placeholder="ACC-PINV-2026-00001"
          />
        </label>
      </div>
      {error ? <div className="error-banner inline">{error}</div> : null}
      <div className="sto-actions" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={lookup}>
          {pending ? "Loading…" : "Get Status"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={submitInvoices}>
          Submit Invoice(s)
        </button>
      </div>
      {status ? (
        <div className="sto-match-panel" style={{ marginTop: "1rem" }}>
          <div>
            <strong>{status.fully_posted ? "Fully Posted" : "Partial / Draft"}</strong>
            {status.linked ? " — Linked pair" : ""}
          </div>
          {status.sales_invoice ? (
            <div className="text-muted">
              SI {status.sales_invoice.name}: docstatus {status.sales_invoice.docstatus}, outstanding{" "}
              {status.sales_invoice.outstanding_amount ?? "—"}
            </div>
          ) : null}
          {status.purchase_invoice ? (
            <div className="text-muted">
              PI {status.purchase_invoice.name}: docstatus {status.purchase_invoice.docstatus}, outstanding{" "}
              {status.purchase_invoice.outstanding_amount ?? "—"}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
