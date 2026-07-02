/**
 * Extended intercompany MCP tools — treasury, triangular sales, accruals, reconciliation.
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { serializeJsonField } from "./json-args.js";
const TREASURY_PREFIX = "erpnext.intercompany.intercompany_treasury";
const TRIANGULAR_PREFIX = "erpnext.intercompany.intercompany_triangular";
const ACCRUAL_PREFIX = "erpnext.intercompany.intercompany_accrual";
const itemSchema = {
    type: "array",
    items: {
        type: "object",
        properties: {
            item_code: { type: "string" },
            qty: { type: "number" },
            rate: { type: "number" },
            description: { type: "string" },
            warehouse: { type: "string" },
        },
        required: ["item_code", "qty"],
    },
    description: "Line items",
};
export const icExtendedToolDefinitions = [
    {
        name: "ic_match_and_clear",
        description: "Match and clear linked intercompany SI/PI open items (F110-lite).",
        inputSchema: {
            type: "object",
            properties: {
                sales_invoice: { type: "string" },
                purchase_invoice: { type: "string" },
                posting_date: { type: "string", description: "YYYY-MM-DD (optional)" },
            },
        },
    },
    {
        name: "ic_get_clearing_status",
        description: "Get AR/AP outstanding and clearing status for linked intercompany invoices.",
        inputSchema: {
            type: "object",
            properties: {
                sales_invoice: { type: "string" },
                purchase_invoice: { type: "string" },
            },
        },
    },
    {
        name: "ic_list_pending_clearing",
        description: "List intercompany invoice pairs pending treasury match & clear.",
        inputSchema: {
            type: "object",
            properties: {
                company: { type: "string", description: "Filter by company (optional)" },
                limit: { type: "number", description: "Max results (default 20)" },
            },
        },
    },
    {
        name: "ic_get_reconciliation_summary",
        description: "Central IC reconciliation dashboard — pending clearing + open disputes.",
        inputSchema: {
            type: "object",
            properties: {
                company: { type: "string", description: "Filter by company (optional)" },
            },
        },
    },
    {
        name: "ic_triangular_sale",
        description: "Create triangular sale: customer SO + linked IC invoice pair (MVP).",
        inputSchema: {
            type: "object",
            properties: {
                selling_company: { type: "string" },
                billing_company: { type: "string" },
                customer: { type: "string" },
                items: itemSchema,
                plant_company: { type: "string", description: "Foreign plant company (optional)" },
                posting_date: { type: "string", description: "YYYY-MM-DD (optional)" },
                submit: { type: "boolean", description: "Submit documents (default false)" },
            },
            required: ["selling_company", "billing_company", "customer", "items"],
        },
    },
    {
        name: "ic_list_triangular_sales",
        description: "List triangular sales orders.",
        inputSchema: {
            type: "object",
            properties: {
                company: { type: "string", description: "Filter by selling company (optional)" },
                limit: { type: "number", description: "Max results (default 20)" },
            },
        },
    },
    {
        name: "ic_create_accrual",
        description: "Create intercompany accrual allocation Journal Entry (MVP).",
        inputSchema: {
            type: "object",
            properties: {
                company: { type: "string" },
                counterparty_company: { type: "string" },
                amount: { type: "number" },
                debit_account: { type: "string" },
                credit_account: { type: "string" },
                posting_date: { type: "string", description: "YYYY-MM-DD (optional)" },
                remarks: { type: "string" },
                submit: { type: "boolean", description: "Submit JE (default true)" },
            },
            required: ["company", "counterparty_company", "amount", "debit_account", "credit_account"],
        },
    },
    {
        name: "ic_list_accruals",
        description: "List intercompany accrual allocation journal entries.",
        inputSchema: {
            type: "object",
            properties: {
                company: { type: "string", description: "Filter by company (optional)" },
                limit: { type: "number", description: "Max results (default 20)" },
            },
        },
    },
];
function textResult(data) {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
}
function errorResult(message) {
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
async function callMethod(client, prefix, method, args) {
    return client.callMethod(`${prefix}.${method}`, args);
}
export async function handleIcExtendedToolCall(client, toolName, args) {
    try {
        switch (toolName) {
            case "ic_match_and_clear": {
                if (!args?.sales_invoice && !args?.purchase_invoice) {
                    throw new McpError(ErrorCode.InvalidParams, "sales_invoice and/or purchase_invoice is required");
                }
                const result = await callMethod(client, TREASURY_PREFIX, "match_and_clear_intercompany_invoice", {
                    sales_invoice: args.sales_invoice,
                    purchase_invoice: args.purchase_invoice,
                    posting_date: args.posting_date,
                });
                return textResult(result);
            }
            case "ic_get_clearing_status": {
                if (!args?.sales_invoice && !args?.purchase_invoice) {
                    throw new McpError(ErrorCode.InvalidParams, "sales_invoice and/or purchase_invoice is required");
                }
                const result = await callMethod(client, TREASURY_PREFIX, "get_clearing_status", {
                    sales_invoice: args.sales_invoice,
                    purchase_invoice: args.purchase_invoice,
                });
                return textResult(result);
            }
            case "ic_list_pending_clearing": {
                const result = await callMethod(client, TREASURY_PREFIX, "list_pending_ic_clearing", {
                    company: args?.company,
                    limit: args?.limit ?? 20,
                });
                return textResult(result);
            }
            case "ic_get_reconciliation_summary": {
                const result = await callMethod(client, TREASURY_PREFIX, "get_central_reconciliation_summary", { company: args?.company });
                return textResult(result);
            }
            case "ic_triangular_sale": {
                if (!args?.selling_company || !args?.billing_company || !args?.customer || !args?.items) {
                    throw new McpError(ErrorCode.InvalidParams, "selling_company, billing_company, customer, and items are required");
                }
                const result = await callMethod(client, TRIANGULAR_PREFIX, "create_triangular_sale", {
                    selling_company: String(args.selling_company),
                    billing_company: String(args.billing_company),
                    customer: String(args.customer),
                    items: serializeJsonField(args.items, "items"),
                    plant_company: args.plant_company,
                    posting_date: args.posting_date,
                    submit: args.submit ? 1 : 0,
                });
                return textResult(result);
            }
            case "ic_list_triangular_sales": {
                const result = await callMethod(client, TRIANGULAR_PREFIX, "list_triangular_sales", {
                    company: args?.company,
                    limit: args?.limit ?? 20,
                });
                return textResult(result);
            }
            case "ic_create_accrual": {
                if (!args?.company ||
                    !args?.counterparty_company ||
                    args?.amount == null ||
                    !args?.debit_account ||
                    !args?.credit_account) {
                    throw new McpError(ErrorCode.InvalidParams, "company, counterparty_company, amount, debit_account, and credit_account are required");
                }
                const result = await callMethod(client, ACCRUAL_PREFIX, "create_accrual_allocation", {
                    company: String(args.company),
                    counterparty_company: String(args.counterparty_company),
                    amount: args.amount,
                    debit_account: String(args.debit_account),
                    credit_account: String(args.credit_account),
                    posting_date: args.posting_date,
                    remarks: args.remarks,
                    submit: args.submit === false ? 0 : 1,
                });
                return textResult(result);
            }
            case "ic_list_accruals": {
                const result = await callMethod(client, ACCRUAL_PREFIX, "list_accrual_allocations", {
                    company: args?.company,
                    limit: args?.limit ?? 20,
                });
                return textResult(result);
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown IC extended tool: ${toolName}`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown IC extended tool error";
        return errorResult(message);
    }
}
export function isIcExtendedToolName(name) {
    return icExtendedToolDefinitions.some((tool) => tool.name === name);
}
