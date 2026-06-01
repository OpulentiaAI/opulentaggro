import Link from "next/link";
import { ReactNode } from "react";

export function FrappeListChrome({
  doctype,
  children,
  extraActions,
}: {
  doctype: string;
  children: ReactNode;
  extraActions?: ReactNode;
}) {
  return (
    <div className="frappe-list-view">
      <div className="frappe-page-head">
        <div className="frappe-page-head-main">
          <h1 className="frappe-page-title">{doctype}</h1>
          <div className="frappe-page-actions">
            {extraActions}
            <div className="frappe-menu">
              <button type="button" className="btn btn-ghost btn-sm">
                List View ▾
              </button>
            </div>
            <Link href={`/app/sto-dashboard`} className="btn btn-ghost btn-sm">
              STO Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="frappe-list-filters">
        <input type="search" placeholder="Search or type a filter…" className="frappe-list-filter-input" readOnly />
        <span className="muted frappe-list-pagination">1–50 of many</span>
      </div>

      {children}
    </div>
  );
}
