/** Shared IC billing types — aligned with erpnext-mcp-server ic_* tools. */

export type IcCompanyPair = {
  from_company: string;
  to_company: string;
  internal_customer?: string | null;
  internal_supplier?: string | null;
};

export type IcListAccountsResponse = {
  pairs?: IcCompanyPair[];
  error?: string;
};

export type IcInvoiceStatusResponse = {
  sales_invoice?: Record<string, unknown>;
  purchase_invoice?: Record<string, unknown>;
  linked?: boolean;
  error?: string;
};

export const IC_ACTION_MAP = {
  ic_list_accounts: "list_accounts",
  ic_create_sales_invoice: "create_sales_invoice",
  ic_create_purchase_invoice: "create_purchase_invoice",
  ic_create_invoice_pair: "create_invoice_pair",
  ic_submit_invoice: "submit_invoice",
  ic_get_invoice_status: "get_invoice_status",
} as const;

export type IcApiAction = (typeof IC_ACTION_MAP)[keyof typeof IC_ACTION_MAP];
