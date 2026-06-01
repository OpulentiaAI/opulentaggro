/** DocType slug ↔ ERPNext name mapping and list column configs. */

export const DOCTYPE_BY_SLUG: Record<string, string> = {
  "purchase-order": "Purchase Order",
  "sales-order": "Sales Order",
  "delivery-note": "Delivery Note",
  "purchase-receipt": "Purchase Receipt",
  "sales-invoice": "Sales Invoice",
  "purchase-invoice": "Purchase Invoice",
  "payment-entry": "Payment Entry",
  "journal-entry": "Journal Entry",
  customer: "Customer",
  supplier: "Supplier",
  item: "Item",
  company: "Company",
  warehouse: "Warehouse",
  account: "Account",
};

export const SLUG_BY_DOCTYPE: Record<string, string> = Object.fromEntries(
  Object.entries(DOCTYPE_BY_SLUG).map(([slug, dt]) => [dt, slug])
);

/** Convert unknown slug to ERPNext DocType title (e.g. material-request → Material Request). */
export function slugToDoctypeGuess(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function slugToDoctype(slug: string): string | null {
  return DOCTYPE_BY_SLUG[slug] ?? null;
}

export function resolveDoctypeFromSlug(slug: string): string {
  return slugToDoctype(slug) ?? slugToDoctypeGuess(slug);
}

export function doctypeToSlug(doctype: string): string {
  return SLUG_BY_DOCTYPE[doctype] ?? doctype.toLowerCase().replace(/\s+/g, "-");
}

export function doctypeListPath(doctype: string): string {
  return `/app/${doctypeToSlug(doctype)}`;
}

export function doctypeFormPath(doctype: string, name: string): string {
  return `${doctypeListPath(doctype)}/${encodeURIComponent(name)}`;
}

export type ListColumn = {
  field: string;
  label: string;
  width?: string;
};

export const LIST_COLUMNS: Record<string, ListColumn[]> = {
  "Purchase Order": [
    { field: "name", label: "ID" },
    { field: "supplier", label: "Supplier" },
    { field: "company", label: "Company" },
    { field: "status", label: "Status" },
    { field: "grand_total", label: "Amount" },
    { field: "transaction_date", label: "Date" },
  ],
  "Sales Order": [
    { field: "name", label: "ID" },
    { field: "customer", label: "Customer" },
    { field: "company", label: "Company" },
    { field: "status", label: "Status" },
    { field: "grand_total", label: "Amount" },
    { field: "transaction_date", label: "Date" },
  ],
  "Delivery Note": [
    { field: "name", label: "ID" },
    { field: "customer", label: "Customer" },
    { field: "company", label: "Company" },
    { field: "status", label: "Status" },
    { field: "posting_date", label: "Date" },
  ],
  "Purchase Receipt": [
    { field: "name", label: "ID" },
    { field: "supplier", label: "Supplier" },
    { field: "company", label: "Company" },
    { field: "status", label: "Status" },
    { field: "posting_date", label: "Date" },
  ],
  "Sales Invoice": [
    { field: "name", label: "ID" },
    { field: "customer", label: "Customer" },
    { field: "company", label: "Company" },
    { field: "status", label: "Status" },
    { field: "grand_total", label: "Amount" },
    { field: "posting_date", label: "Date" },
  ],
  "Purchase Invoice": [
    { field: "name", label: "ID" },
    { field: "supplier", label: "Supplier" },
    { field: "company", label: "Company" },
    { field: "status", label: "Status" },
    { field: "grand_total", label: "Amount" },
    { field: "posting_date", label: "Date" },
  ],
  Customer: [
    { field: "name", label: "Name" },
    { field: "customer_group", label: "Group" },
    { field: "territory", label: "Territory" },
  ],
  Supplier: [
    { field: "name", label: "Name" },
    { field: "supplier_group", label: "Group" },
    { field: "country", label: "Country" },
  ],
  Item: [
    { field: "name", label: "Code" },
    { field: "item_name", label: "Name" },
    { field: "item_group", label: "Group" },
    { field: "stock_uom", label: "UOM" },
  ],
  Company: [
    { field: "name", label: "Name" },
    { field: "abbr", label: "Abbr" },
    { field: "country", label: "Country" },
  ],
  Warehouse: [
    { field: "name", label: "Name" },
    { field: "company", label: "Company" },
    { field: "warehouse_type", label: "Type" },
  ],
};

export const FORM_FIELDS: Record<string, string[]> = {
  "Purchase Order": [
    "name",
    "supplier",
    "company",
    "transaction_date",
    "schedule_date",
    "status",
    "docstatus",
    "grand_total",
    "currency",
    "is_internal_supplier",
  ],
  "Sales Order": [
    "name",
    "customer",
    "company",
    "transaction_date",
    "delivery_date",
    "status",
    "docstatus",
    "grand_total",
    "currency",
  ],
  Customer: ["name", "customer_name", "customer_group", "territory", "tax_id"],
  Supplier: ["name", "supplier_name", "supplier_group", "country", "tax_id"],
  Item: ["name", "item_name", "item_group", "stock_uom", "is_stock_item", "standard_rate"],
  Company: ["name", "abbr", "country", "default_currency", "domain"],
};

export const DEFAULT_LIST_COLUMNS: ListColumn[] = [
  { field: "name", label: "Name" },
  { field: "modified", label: "Modified" },
];

export function getListColumns(doctype: string): ListColumn[] {
  return LIST_COLUMNS[doctype] ?? DEFAULT_LIST_COLUMNS;
}

export function getFormFields(doctype: string): string[] {
  return FORM_FIELDS[doctype] ?? ["name", "modified", "owner", "docstatus"];
}

/** Reserved slugs that are desk pages / workspaces, not doctype lists. */
export const DESK_PAGE_SLUGS = new Set([
  "intercompany",
  "sto-dashboard",
  "sto-trace",
  "home",
  "buying",
  "selling",
  "stock",
  "accounts",
  "invoicing",
  "assets",
]);
