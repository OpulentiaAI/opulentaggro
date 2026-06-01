import type { IcCompanyPair } from "@/lib/types/ic";

export function IcAccountsTable({ pairs }: { pairs: IcCompanyPair[] }) {
  if (!pairs.length) {
    return <p className="muted">No intercompany account pairs configured.</p>;
  }

  return (
    <div className="sto-table-wrap">
      <table className="sto-table">
        <thead>
          <tr>
            <th>From Company</th>
            <th>To Company</th>
            <th>Internal Customer (AR)</th>
            <th>Internal Supplier (AP)</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair) => (
            <tr key={`${pair.from_company}-${pair.to_company}`}>
              <td>{pair.from_company}</td>
              <td>{pair.to_company}</td>
              <td>{pair.internal_customer ?? "—"}</td>
              <td>{pair.internal_supplier ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
