import Link from "next/link";
import { FrappeFormChrome } from "@/components/doctype/FrappeFormChrome";
import { doctypeListPath, doctypeFormPath } from "@/lib/doctype";

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function labelize(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FormView({
  doctype,
  doc,
  fields,
  error,
  children,
}: {
  doctype: string;
  doc?: Record<string, unknown>;
  fields: string[];
  error?: string;
  children?: React.ReactNode;
}) {
  if (error) {
    return (
      <div className="error-banner">
        <strong>Failed to load {doctype}</strong>
        <p>{error}</p>
        <Link href={doctypeListPath(doctype)}>← Back to list</Link>
      </div>
    );
  }

  if (!doc) {
    return <p className="muted">Document not found.</p>;
  }

  const name = String(doc.name ?? "");
  const statusLabel = doc.status
    ? String(doc.status)
    : doc.docstatus != null
      ? doc.docstatus === 1
        ? "Submitted"
        : doc.docstatus === 2
          ? "Cancelled"
          : "Draft"
      : undefined;

  return (
    <FrappeFormChrome doctype={doctype} name={name} status={statusLabel}>
      {children}

      <div className="card form-field-grid">
        {fields.map((field) => (
          <div key={field} className="form-field">
            <div className="form-field-label">{labelize(field)}</div>
            <div className="form-field-value">{formatValue(doc[field])}</div>
          </div>
        ))}
      </div>

      {Array.isArray(doc.items) && doc.items.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>Items</h2>
          <div className="sto-table-wrap">
            <table className="sto-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(doc.items as Record<string, unknown>[]).map((item, i) => (
                  <tr key={i}>
                    <td>{String(item.item_code ?? item.item_name ?? "—")}</td>
                    <td>{formatValue(item.qty)}</td>
                    <td>{formatValue(item.rate)}</td>
                    <td>{formatValue(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {doctype === "Purchase Order" && name ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <Link href={`/app/sto-trace?purchase_order=${encodeURIComponent(name)}`} className="btn btn-primary">
            View STO Trace
          </Link>
        </div>
      ) : null}
    </FrappeFormChrome>
  );
}

/** Render linked doc cards from trace documents object */
export function DocChainGrid({
  documents,
}: {
  documents: Record<string, unknown>;
}) {
  const cards: { doctype: string; name: string; status?: string }[] = [];

  const po = documents.purchase_order as Record<string, unknown> | null;
  if (po?.name) cards.push({ doctype: "Purchase Order", name: String(po.name), status: String(po.status ?? "") });

  const so = documents.sales_order as Record<string, unknown> | null;
  if (so?.name) cards.push({ doctype: "Sales Order", name: String(so.name), status: String(so.status ?? "") });

  for (const key of ["delivery_notes", "sales_invoices", "purchase_invoices", "purchase_receipts"] as const) {
    const arr = documents[key] as Record<string, unknown>[] | undefined;
    const dtMap: Record<string, string> = {
      delivery_notes: "Delivery Note",
      sales_invoices: "Sales Invoice",
      purchase_invoices: "Purchase Invoice",
      purchase_receipts: "Purchase Receipt",
    };
    if (arr?.length) {
      for (const doc of arr) {
        if (doc?.name) {
          cards.push({
            doctype: dtMap[key],
            name: String(doc.name),
            status: String(doc.status ?? ""),
          });
        }
      }
    }
  }

  if (!cards.length) {
    return <p className="muted">No linked documents.</p>;
  }

  return (
    <>
      {cards.map((c) => (
        <div key={`${c.doctype}-${c.name}`} className="sto-doc-card">
          <div className="doctype">{c.doctype}</div>
          <div className="name">
            <Link href={doctypeFormPath(c.doctype, c.name)}>{c.name}</Link>
          </div>
          {c.status ? <div className="meta">Status: {c.status}</div> : null}
        </div>
      ))}
    </>
  );
}
