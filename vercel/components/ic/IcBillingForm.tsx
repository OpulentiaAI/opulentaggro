"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { runIcAction } from "@/lib/actions/ic";
import type { IcCompanyPair } from "@/lib/types/ic";

export function IcBillingForm({ pairs }: { pairs: IcCompanyPair[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const defaultFrom = pairs[0]?.from_company ?? "";
  const defaultTo = pairs[0]?.to_company ?? "";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const body = {
      from_company: String(fd.get("from_company")),
      to_company: String(fd.get("to_company")),
      posting_date: String(fd.get("posting_date") || new Date().toISOString().slice(0, 10)),
      customer: String(fd.get("customer") || ""),
      supplier: String(fd.get("supplier") || ""),
      items: [
        {
          item_code: String(fd.get("item_code")),
          qty: Number(fd.get("qty") || 1),
          rate: Number(fd.get("rate") || 0),
        },
      ],
      submit: fd.get("submit") === "on",
    };

    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const result = await runIcAction("create_invoice_pair", body);
      if (!result.ok) {
        setError(result.error ?? "Invoice creation failed");
        return;
      }
      setSuccess("Invoice pair created");
      router.refresh();
    });
  }

  if (!pairs.length) {
    return <p className="muted">No intercompany account pairs configured.</p>;
  }

  return (
    <form className="card ic-billing-form" onSubmit={onSubmit}>
      <h2>Create Invoice Pair</h2>
      {error ? <div className="error-banner">{error}</div> : null}
      {success ? <div className="success-banner">{success}</div> : null}

      <div className="form-row">
        <label>
          From Company
          <select name="from_company" defaultValue={defaultFrom} required>
            {pairs.map((p) => (
              <option key={p.from_company} value={p.from_company}>
                {p.from_company}
              </option>
            ))}
          </select>
        </label>
        <label>
          To Company
          <select name="to_company" defaultValue={defaultTo} required>
            {pairs.map((p) => (
              <option key={p.to_company} value={p.to_company}>
                {p.to_company}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Posting Date
          <input type="date" name="posting_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </label>
        <label>
          Item Code
          <input type="text" name="item_code" placeholder="ITEM-001" required />
        </label>
      </div>

      <div className="form-row">
        <label>
          Qty
          <input type="number" name="qty" defaultValue={1} min={0.001} step="any" />
        </label>
        <label>
          Rate
          <input type="number" name="rate" defaultValue={0} min={0} step="any" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Customer (optional)
          <input type="text" name="customer" placeholder="Auto from IC pair" />
        </label>
        <label>
          Supplier (optional)
          <input type="text" name="supplier" placeholder="Auto from IC pair" />
        </label>
      </div>

      <label className="checkbox-label">
        <input type="checkbox" name="submit" />
        Submit invoices after creation
      </label>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create Invoice Pair"}
      </button>
    </form>
  );
}
