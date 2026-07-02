import { cache } from "react";
import { callErpnextMethod } from "@/lib/erpnext/fetch-client";
import type { IcCompanyPair, IcListAccountsResponse } from "@/lib/types/ic";

const IC_PREFIX = "erpnext.intercompany.intercompany_billing";
const TREASURY_PREFIX = "erpnext.intercompany.intercompany_treasury";
const TRIANGULAR_PREFIX = "erpnext.intercompany.intercompany_triangular";
const ACCRUAL_PREFIX = "erpnext.intercompany.intercompany_accrual";

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
  const methodMap: Record<
    string,
    {
      method: string;
      prefix?: string;
      transform?: (b: Record<string, unknown>) => Record<string, unknown>;
    }
  > = {
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
    match_and_clear: {
      prefix: TREASURY_PREFIX,
      method: "match_and_clear_intercompany_invoice",
    },
    get_clearing_status: {
      prefix: TREASURY_PREFIX,
      method: "get_clearing_status",
    },
    list_pending_clearing: {
      prefix: TREASURY_PREFIX,
      method: "list_pending_ic_clearing",
      transform: (b) => ({ company: b.company, limit: b.limit ?? 20 }),
    },
    get_reconciliation_summary: {
      prefix: TREASURY_PREFIX,
      method: "get_central_reconciliation_summary",
    },
    triangular_sale: {
      prefix: TRIANGULAR_PREFIX,
      method: "create_triangular_sale",
      transform: (b) => ({
        selling_company: b.selling_company,
        billing_company: b.billing_company,
        customer: b.customer,
        items: typeof b.items === "string" ? b.items : JSON.stringify(b.items),
        plant_company: b.plant_company,
        posting_date: b.posting_date,
        submit: b.submit ? 1 : 0,
      }),
    },
    list_triangular_sales: {
      prefix: TRIANGULAR_PREFIX,
      method: "list_triangular_sales",
      transform: (b) => ({ company: b.company, limit: b.limit ?? 20 }),
    },
    create_accrual: {
      prefix: ACCRUAL_PREFIX,
      method: "create_accrual_allocation",
      transform: (b) => ({
        company: b.company,
        counterparty_company: b.counterparty_company,
        amount: b.amount,
        debit_account: b.debit_account,
        credit_account: b.credit_account,
        posting_date: b.posting_date,
        remarks: b.remarks,
        submit: b.submit === false ? 0 : 1,
      }),
    },
    list_accruals: {
      prefix: ACCRUAL_PREFIX,
      method: "list_accrual_allocations",
      transform: (b) => ({ company: b.company, limit: b.limit ?? 20 }),
    },
  };

  const mapping = methodMap[action];
  if (!mapping) {
    return { ok: false, error: `Unknown IC action: ${action}`, status: 404 };
  }

  const args = mapping.transform ? mapping.transform(body) : body;
  const prefix = mapping.prefix ?? IC_PREFIX;
  const result = await callErpnextMethod(`${prefix}.${mapping.method}`, args);
  if (!result.ok) return { ok: false, error: result.error, status: result.status ?? 502 };
  return { ok: true, data: result.data };
}
