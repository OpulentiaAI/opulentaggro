"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { runIcAction } from "@/lib/actions/ic";
import type { IcCompanyPair } from "@/lib/types/ic";

export function TriangularSaleForm({ pairs }: { pairs: IcCompanyPair[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const companies = [...new Set(pairs.flatMap((p) => [p.from_company, p.to_company]))];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      selling_company: String(fd.get("selling_company")),
      billing_company: String(fd.get("billing_company")),
      plant_company: String(fd.get("plant_company") || ""),
      customer: String(fd.get("customer")),
      posting_date: String(fd.get("posting_date") || new Date().toISOString().slice(0, 10)),
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
      const result = await runIcAction("triangular_sale", body);
      if (!result.ok) {
        setError(result.error ?? "Triangular sale failed");
        return;
      }
      setSuccess("Triangular sale created");
      router.refresh();
    });
  }

  return (
    <form className="card ic-billing-form" onSubmit={onSubmit}>
      <h2>New Triangular Sale</h2>
      {error ? <div className="error-banner">{error}</div> : null}
      {success ? <div className="success-banner">{success}</div> : null}

      <div className="form-row">
        <label>
          Selling Company
          <select name="selling_company" className="input" defaultValue={companies[0] ?? ""} required>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Billing Company
          <select name="billing_company" className="input" defaultValue={companies[1] ?? companies[0] ?? ""} required>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Plant Company (optional)
          <input name="plant_company" className="input" placeholder="Defaults to billing company" />
        </label>
        <label>
          Customer
          <input name="customer" className="input" required placeholder="Customer name" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Item
          <input name="item_code" className="input" defaultValue="STO-TEST-ITEM-001" required />
        </label>
        <label>
          Qty
          <input name="qty" type="number" className="input" defaultValue={1} min={0.001} step="any" />
        </label>
        <label>
          Rate
          <input name="rate" type="number" className="input" defaultValue={100} min={0} step="any" />
        </label>
        <label>
          Posting Date
          <input
            name="posting_date"
            type="date"
            className="input"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>
      </div>

      <label className="checkbox-label">
        <input name="submit" type="checkbox" defaultChecked />
        Submit documents after create
      </label>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create Triangular Sale"}
      </button>
    </form>
  );
}
