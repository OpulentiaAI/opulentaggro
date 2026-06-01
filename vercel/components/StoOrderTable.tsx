import Link from "next/link";
import { StageBadge } from "@/components/StageBadge";
import type { StoOrderRow } from "@/lib/types/sto";

export function StoOrderTable({ orders }: { orders: StoOrderRow[] }) {
  if (!orders.length) {
    return <p className="muted">No stock transfer orders found.</p>;
  }

  return (
    <div className="sto-table-wrap">
      <table className="sto-table">
        <thead>
          <tr>
            <th>PO</th>
            <th>Company</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Stage</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.name}>
              <td>
                <Link href={`/app/sto-trace?purchase_order=${encodeURIComponent(order.name)}`}>
                  {order.name}
                </Link>
              </td>
              <td>{order.company ?? "—"}</td>
              <td>{order.supplier ?? "—"}</td>
              <td>{order.status ?? "—"}</td>
              <td>
                <StageBadge stage={order.stage} />
              </td>
              <td>{order.transaction_date ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
