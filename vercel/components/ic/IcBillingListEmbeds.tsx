"use client";

import { useState } from "react";
import { FrappeDeskEmbed } from "@/components/desk/FrappeDeskEmbed";
import { frappeListUrl } from "@/lib/frappe-desk-urls";

type ListTab = "sales-invoice" | "purchase-invoice";

const TABS: { id: ListTab; label: string; doctype: string; title: string }[] = [
  { id: "sales-invoice", label: "Sales Invoices", doctype: "Sales Invoice", title: "IC Billing — Sales Invoices" },
  { id: "purchase-invoice", label: "Purchase Invoices", doctype: "Purchase Invoice", title: "IC Billing — Purchase Invoices" },
];

/** Tabbed Frappe list embeds for intercompany SI/PI browsing. */
export function IcBillingListEmbeds() {
  const [tab, setTab] = useState<ListTab>("sales-invoice");
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="card ic-billing-embed-panel" style={{ marginTop: "1.5rem", padding: 0, overflow: "hidden" }}>
      <div className="ic-billing-embed-toolbar" role="tablist" aria-label="Invoice lists">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`frappe-form-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <FrappeDeskEmbed src={frappeListUrl(active.doctype)} title={active.title} />
    </div>
  );
}
