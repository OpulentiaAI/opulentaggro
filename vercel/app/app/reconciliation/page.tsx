import Link from "next/link";
import { ReconciliationDashboard } from "@/components/ic/ReconciliationDashboard";
import { callErpnextMethod } from "@/lib/erpnext/fetch-client";

export const metadata = {
  title: "IC Reconciliation",
};

type ReconciliationSummary = {
  pending_clearing_count?: number;
  open_dispute_count?: number;
  pending_clearing?: Array<Record<string, unknown>>;
  open_disputes?: Array<Record<string, unknown>>;
  by_company?: Record<string, { pending_clearing?: number; ar_outstanding?: number; ap_outstanding?: number }>;
  error?: string;
};

export default async function ReconciliationPage() {
  const result = await callErpnextMethod<ReconciliationSummary>(
    "erpnext.intercompany.intercompany_treasury.get_central_reconciliation_summary",
    {}
  );

  const summary = result.ok ? result.data : { error: result.error };

  return (
    <div className="frappe-workspace">
      <nav className="desk-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/app/intercompany">Intercompany</Link>
        <span aria-hidden>/</span>
        <span>IC Reconciliation</span>
      </nav>

      <div className="workspace-block-header">
        <p className="h4">
          <strong>Central IC Reconciliation</strong>
        </p>
      </div>
      <p className="workspace-block-paragraph muted">
        Cross-company dashboard for pending treasury match &amp; clear and open STO disputes.
      </p>

      <ReconciliationDashboard summary={summary} />
    </div>
  );
}
