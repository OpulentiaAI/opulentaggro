import Link from "next/link";
import type { ListColumn } from "@/lib/doctype";
import { doctypeFormPath } from "@/lib/doctype";

type Row = Record<string, unknown>;

function formatCell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function ListView({
  doctype,
  rows,
  columns,
  error,
}: {
  doctype: string;
  rows: Row[];
  columns: ListColumn[];
  error?: string;
}) {
  if (error) {
    return (
      <div className="error-banner">
        <strong>Failed to load {doctype}</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (!rows.length) {
    return <p className="muted">No {doctype} records found.</p>;
  }

  return (
    <div className="sto-table-wrap">
      <table className="sto-table desk-list-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.field} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = String(row.name ?? "");
            return (
              <tr key={name}>
                {columns.map((col, idx) => {
                  const value = row[col.field];
                  if (idx === 0 && name) {
                    return (
                      <td key={col.field}>
                        <Link href={doctypeFormPath(doctype, name)}>{formatCell(value)}</Link>
                      </td>
                    );
                  }
                  return <td key={col.field}>{formatCell(value)}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ListViewSkeleton({ columns }: { columns: ListColumn[] }) {
  return (
    <div className="sto-table-wrap">
      <table className="sto-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.field}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col.field}>
                  <span className="skeleton-line" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
