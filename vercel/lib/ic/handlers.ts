import { cache } from "react";
import { callErpnextMethod } from "@/lib/erpnext/fetch-client";
import type { IcCompanyPair, IcListAccountsResponse } from "@/lib/types/ic";

const IC_PREFIX = "erpnext.intercompany.intercompany_billing";

export const getIcAccounts = cache(
  async (company?: string): Promise<IcListAccountsResponse> => {
    const result = await callErpnextMethod<IcCompanyPair[]>(
      `${IC_PREFIX}.list_intercompany_accounts`,
      { company }
    );
    if (!result.ok) return { error: result.error };
    return { pairs: result.data };
  }
);

export async function invokeIcAction(
  action: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status: number }> {
  const methodMap: Record<string, { method: string; transform?: (b: Record<string, unknown>) => Record<string, unknown> }> = {
    list_accounts: { method: "list_intercompany_accounts" },
    create_sales_invoice: {
      method: "create_intercompany_sales_invoice",
      transform: (b) => ({
        from_company: b.from_company,
        to_company: b.to_company,
        items: typeof b.items === "string" ? b.items : JSON.stringify(b.items),
        posting_date: b.posting_date,
        customer: b.customer,
        submit: b.submit ? 1 : 0,
      }),
    },
    create_purchase_invoice: {
      method: "create_intercompany_purchase_invoice",
      transform: (b) => ({
        from_company: b.from_company,
        to_company: b.to_company,
        items: typeof b.items === "string" ? b.items : JSON.stringify(b.items),
        posting_date: b.posting_date,
        supplier: b.supplier,
        submit: b.submit ? 1 : 0,
      }),
    },
    create_invoice_pair: {
      method: "create_intercompany_invoice_pair",
      transform: (b) => ({
        from_company: b.from_company,
        to_company: b.to_company,
        items: typeof b.items === "string" ? b.items : JSON.stringify(b.items),
        posting_date: b.posting_date,
        customer: b.customer,
        supplier: b.supplier,
        submit: b.submit === false ? 0 : 1,
      }),
    },
    submit_invoice: { method: "submit_intercompany_invoice" },
    get_invoice_status: { method: "get_intercompany_invoice_status" },
  };

  const mapping = methodMap[action];
  if (!mapping) {
    return { ok: false, error: `Unknown IC action: ${action}`, status: 404 };
  }

  const args = mapping.transform ? mapping.transform(body) : body;
  const result = await callErpnextMethod(`${IC_PREFIX}.${mapping.method}`, args);
  if (!result.ok) return { ok: false, error: result.error, status: result.status ?? 502 };
  return { ok: true, data: result.data };
}
