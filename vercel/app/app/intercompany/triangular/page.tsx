import Link from "next/link";
import { TriangularSaleForm } from "@/components/ic/TriangularSaleForm";
import { getIcAccounts } from "@/lib/ic/handlers";
import { callErpnextMethod } from "@/lib/erpnext/fetch-client";

export const metadata = {
  title: "Triangular Sales",
};

type TriangularRow = {
  sales_order: string;
  selling_company?: string;
  customer?: string;
  status?: string;
  grand_total?: number;
};

export default async function TriangularSalesPage() {
  const accounts = await getIcAccounts();
  const pairs = accounts.pairs ?? [];

  const listResult = await callErpnextMethod<TriangularRow[]>(
    "erpnext.intercompany.intercompany_triangular.list_triangular_sales",
    { limit: 20 }
  );
  const sales = listResult.ok ? listResult.data ?? [] : [];

  return (
    <div className="frappe-workspace">
      <nav className="desk-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/app/intercompany">Intercompany</Link>
        <span aria-hidden>/</span>
        <span>Triangular Sales</span>
      </nav>

      <div className="workspace-block-header">
        <p className="h4">
          <strong>Triangular Sales</strong>
        </p>
      </div>
      <p className="workspace-block-paragraph muted">
        MVP triangular sale flow — customer SO on seller plus linked IC invoice pair to billing
        company.
      </p>

      <TriangularSaleForm pairs={pairs} />

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2>Recent Triangular Sales</h2>
        {!listResult.ok ? (
          <p className="muted">{listResult.error}</p>
        ) : sales.length === 0 ? (
          <p className="muted">No triangular sales yet.</p>
        ) : (
          <table className="desk-table">
            <thead>
              <tr>
                <th>Sales Order</th>
                <th>Seller</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((row) => (
                <tr key={row.sales_order}>
                  <td>
                    <Link href={`/app/sales-order/${encodeURIComponent(row.sales_order)}`}>
                      {row.sales_order}
                    </Link>
                  </td>
                  <td>{row.selling_company}</td>
                  <td>{row.customer}</td>
                  <td>{row.status}</td>
                  <td>{row.grand_total ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
