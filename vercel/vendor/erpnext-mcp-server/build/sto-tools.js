/**
 * Stock Transfer Order (STO) MCP tools for intercompany workflows.
 * Calls erpnext.intercompany.stock_transfer_order whitelisted API methods.
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { serializeJsonField } from "./json-args.js";
const STO_METHOD_PREFIX = "erpnext.intercompany.stock_transfer_order";
export const stoToolDefinitions = [
    {
        name: "sto_create",
        description: "Create an intercompany Stock Transfer Order (internal Purchase Order). Maps to SAP MM STO creation by Requestor.",
        inputSchema: {
            type: "object",
            properties: {
                company: { type: "string", description: "Receiving company (Requestor entity)" },
                supplier: { type: "string", description: "Internal supplier representing the sending company" },
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            item_code: { type: "string" },
                            qty: { type: "number" },
                            rate: { type: "number" },
                            warehouse: { type: "string", description: "Receiving warehouse" },
                            from_warehouse: { type: "string", description: "Sending warehouse" },
                        },
                        required: ["item_code", "qty"],
                    },
                    description: "Line items to transfer (array). A pre-serialized JSON array string is also accepted (direct API parity).",
                },
                transaction_date: { type: "string", description: "YYYY-MM-DD (optional)" },
                schedule_date: { type: "string", description: "YYYY-MM-DD (optional)" },
                submit: { type: "boolean", description: "Submit immediately after create (default false)" },
            },
            required: ["company", "supplier", "items"],
        },
    },
    {
        name: "sto_submit",
        description: "Submit a draft STO after DoA approval (post the internal Purchase Order).",
        inputSchema: {
            type: "object",
            properties: {
                purchase_order: { type: "string", description: "Purchase Order / STO name" },
            },
            required: ["purchase_order"],
        },
    },
    {
        name: "sto_approve_and_route",
        description: "Approve and route STO to Sender: creates intercompany Sales Order from submitted PO.",
        inputSchema: {
            type: "object",
            properties: {
                purchase_order: { type: "string" },
                delivery_date: { type: "string", description: "YYYY-MM-DD (optional)" },
                submit: { type: "boolean", description: "Submit Sales Order (default true)" },
            },
            required: ["purchase_order"],
        },
    },
    {
        name: "sto_post_goods_in_transit",
        description: "Sender confirms delivery and posts goods in transit (SAP movement type 643 equivalent). Creates Delivery Note with in-transit warehouse.",
        inputSchema: {
            type: "object",
            properties: {
                purchase_order: { type: "string" },
                in_transit_warehouse: { type: "string", description: "GIT warehouse (optional, auto-resolved)" },
                submit: { type: "boolean", description: "Submit Delivery Note (default true)" },
            },
            required: ["purchase_order"],
        },
    },
    {
        name: "sto_create_ic_invoice",
        description: "Auto-create intercompany Sales Invoice and Purchase Invoice (IC AR/AP settlement).",
        inputSchema: {
            type: "object",
            properties: {
                purchase_order: { type: "string" },
                submit: { type: "boolean", description: "Submit both invoices (default true)" },
            },
            required: ["purchase_order"],
        },
    },
    {
        name: "sto_post_goods_receipt",
        description: "Requestor posts goods receipt (intercompany Purchase Receipt from Delivery Note).",
        inputSchema: {
            type: "object",
            properties: {
                purchase_order: { type: "string", description: "STO Purchase Order (optional if delivery_note given)" },
                delivery_note: { type: "string", description: "Source Delivery Note (optional, resolved from PO)" },
                submit: { type: "boolean", description: "Submit Purchase Receipt (default true)" },
            },
        },
    },
    {
        name: "sto_get_trace",
        description: "Trace full STO document chain: PO → SO → DN → PR → SI → PI with workflow stage and three-way match status.",
        inputSchema: {
            type: "object",
            properties: {
                purchase_order: { type: "string" },
            },
            required: ["purchase_order"],
        },
    },
    {
        name: "sto_three_way_match",
        description: "Run three-way match among STO (PO), goods receipt (PR), and IC invoice (PI). Returns match/dispute with tolerance bands.",
        inputSchema: {
            type: "object",
            properties: {
                purchase_order: { type: "string" },
                qty_tolerance_percent: { type: "number", description: "Allowed qty variance % (default 0)" },
                price_tolerance_percent: { type: "number", description: "Allowed price variance % (default 0)" },
            },
            required: ["purchase_order"],
        },
    },
    {
        name: "sto_list",
        description: "List intercompany stock transfer orders (internal Purchase Orders).",
        inputSchema: {
            type: "object",
            properties: {
                company: { type: "string", description: "Filter by company (optional)" },
                status: { type: "string", description: "Filter by PO status (optional)" },
                limit: { type: "number", description: "Max results (default 20, max 100)" },
                include_stage: {
                    type: "boolean",
                    description: "Include workflow stage per row (default false; uses quick stage without three-way match)",
                },
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
async function callStoMethod(client, method, args) {
    return client.callMethod(`${STO_METHOD_PREFIX}.${method}`, args);
}
export async function handleStoToolCall(client, toolName, args) {
    try {
        switch (toolName) {
            case "sto_create": {
                if (!args?.company || !args?.supplier || !args?.items) {
                    throw new McpError(ErrorCode.InvalidParams, "company, supplier, and items are required");
                }
                const result = await callStoMethod(client, "create_stock_transfer_order", {
                    company: String(args.company),
                    supplier: String(args.supplier),
                    items: serializeJsonField(args.items, "items"),
                    transaction_date: args.transaction_date,
                    schedule_date: args.schedule_date,
                    submit: args.submit ? 1 : 0,
                });
                return textResult(result);
            }
            case "sto_submit": {
                if (!args?.purchase_order) {
                    throw new McpError(ErrorCode.InvalidParams, "purchase_order is required");
                }
                const result = await callStoMethod(client, "submit_stock_transfer_order", {
                    purchase_order: String(args.purchase_order),
                });
                return textResult(result);
            }
            case "sto_approve_and_route": {
                if (!args?.purchase_order) {
                    throw new McpError(ErrorCode.InvalidParams, "purchase_order is required");
                }
                const result = await callStoMethod(client, "approve_and_route_stock_transfer", {
                    purchase_order: String(args.purchase_order),
                    delivery_date: args.delivery_date,
                    submit: args.submit === false ? 0 : 1,
                });
                return textResult(result);
            }
            case "sto_post_goods_in_transit": {
                if (!args?.purchase_order) {
                    throw new McpError(ErrorCode.InvalidParams, "purchase_order is required");
                }
                const result = await callStoMethod(client, "post_goods_in_transit", {
                    purchase_order: String(args.purchase_order),
                    in_transit_warehouse: args.in_transit_warehouse,
                    submit: args.submit === false ? 0 : 1,
                });
                return textResult(result);
            }
            case "sto_create_ic_invoice": {
                if (!args?.purchase_order) {
                    throw new McpError(ErrorCode.InvalidParams, "purchase_order is required");
                }
                const result = await callStoMethod(client, "create_intercompany_invoice", {
                    purchase_order: String(args.purchase_order),
                    submit: args.submit === false ? 0 : 1,
                });
                return textResult(result);
            }
            case "sto_post_goods_receipt": {
                if (!args?.purchase_order && !args?.delivery_note) {
                    throw new McpError(ErrorCode.InvalidParams, "purchase_order or delivery_note is required");
                }
                const result = await callStoMethod(client, "post_stock_transfer_receipt", {
                    purchase_order: args.purchase_order,
                    delivery_note: args.delivery_note,
                    submit: args.submit === false ? 0 : 1,
                });
                return textResult(result);
            }
            case "sto_get_trace": {
                if (!args?.purchase_order) {
                    throw new McpError(ErrorCode.InvalidParams, "purchase_order is required");
                }
                const result = await callStoMethod(client, "get_stock_transfer_trace", {
                    purchase_order: String(args.purchase_order),
                });
                return textResult(result);
            }
            case "sto_three_way_match": {
                if (!args?.purchase_order) {
                    throw new McpError(ErrorCode.InvalidParams, "purchase_order is required");
                }
                const result = await callStoMethod(client, "run_stock_transfer_three_way_match", {
                    purchase_order: String(args.purchase_order),
                    qty_tolerance_percent: args.qty_tolerance_percent ?? 0,
                    price_tolerance_percent: args.price_tolerance_percent ?? 0,
                });
                return textResult(result);
            }
            case "sto_list": {
                const result = await callStoMethod(client, "list_stock_transfer_orders", {
                    company: args?.company,
                    status: args?.status,
                    limit: args?.limit ?? 20,
                    include_stage: args?.include_stage ? 1 : 0,
                });
                return textResult(result);
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown STO tool: ${toolName}`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown STO tool error";
        return errorResult(message);
    }
}
export function isStoToolName(name) {
    return stoToolDefinitions.some((tool) => tool.name === name);
}
