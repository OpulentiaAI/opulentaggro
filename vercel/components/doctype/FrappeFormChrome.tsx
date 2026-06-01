import Link from "next/link";
import { ReactNode } from "react";
import { doctypeListPath } from "@/lib/doctype";

const DEFAULT_TABS = ["Details", "More Info", "Connections"];

export function FrappeFormChrome({
  doctype,
  name,
  status,
  children,
  actions,
}: {
  doctype: string;
  name: string;
  status?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="frappe-form-view">
      <div className="frappe-form-toolbar">
        <nav className="desk-breadcrumbs" aria-label="Breadcrumb">
          <Link href={doctypeListPath(doctype)}>{doctype}</Link>
          <span aria-hidden>/</span>
          <span>{name}</span>
        </nav>
        <div className="frappe-form-toolbar-actions">
          {actions}
          <div className="frappe-menu" aria-label="Create menu">
            <button type="button" className="btn btn-ghost btn-sm" disabled title="Use ERPNext desk for Create">
              Create ▾
            </button>
          </div>
        </div>
      </div>

      <div className="frappe-form-header">
        <h1>{name}</h1>
        {status ? <span className="form-status-badge">{status}</span> : null}
      </div>

      <div className="frappe-form-tabs" role="tablist">
        {DEFAULT_TABS.map((tab, i) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={`frappe-form-tab${i === 0 ? " active" : ""}`}
            aria-selected={i === 0}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="frappe-form-body">{children}</div>

      <aside className="frappe-form-sidebar">
        <section className="frappe-sidebar-block">
          <h3>Activity</h3>
          <p className="muted">Timeline and comments load in full Frappe desk embed.</p>
        </section>
        <section className="frappe-sidebar-block">
          <h3>Attachments</h3>
          <p className="muted">No attachments in read-only port view.</p>
        </section>
      </aside>
    </div>
  );
}
