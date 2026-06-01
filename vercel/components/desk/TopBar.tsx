"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { doctypeToSlug } from "@/lib/doctype";

const SEARCHABLE = [
  "Purchase Order",
  "Sales Order",
  "Delivery Note",
  "Purchase Receipt",
  "Sales Invoice",
  "Purchase Invoice",
  "Payment Entry",
  "Journal Entry",
  "Customer",
  "Supplier",
  "Item",
];

export function DeskSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [doctype, setDoctype] = useState("Purchase Order");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const slug = doctypeToSlug(doctype);
    router.push(`/app/${slug}/${encodeURIComponent(q)}`);
  }

  return (
    <form className="desk-search" onSubmit={onSubmit} role="search">
      <select
        value={doctype}
        onChange={(e) => setDoctype(e.target.value)}
        aria-label="DocType"
        className="desk-search-select"
      >
        {SEARCHABLE.map((dt) => (
          <option key={dt} value={dt}>
            {dt}
          </option>
        ))}
      </select>
      <input
        type="search"
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search documents"
        className="desk-search-input"
      />
      <button type="submit" className="btn btn-ghost btn-sm">
        Go
      </button>
    </form>
  );
}

export function DeskTopBar({ user }: { user?: string | null }) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "OpulentAggro";

  return (
    <header className="desk-topbar">
      <Link href="/app" className="desk-brand">
        <span className="desk-brand-mark" aria-hidden>
          ◆
        </span>
        {appName}
      </Link>
      <DeskSearchBar />
      <div className="desk-topbar-actions">
        <a
          href="https://docs.frappe.io/erpnext"
          className="desk-help-link muted"
          target="_blank"
          rel="noopener noreferrer"
        >
          Help
        </a>
        <span className="desk-notifications muted" title="Notifications">
          🔔
        </span>
        {user ? (
          <span className="desk-user muted">{user}</span>
        ) : (
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
