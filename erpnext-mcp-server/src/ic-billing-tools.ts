/**
 * Intercompany billing MCP tools (AR/AP) for multiple company pairs.
 * Calls erpnext.intercompany.intercompany_billing whitelisted API methods.
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { serializeJsonField } from "./json-args.js";

export interface ERPNextClientLike {
  callMethod(method: string, args?: Record<string, unknown>, httpMethod?: "GET" | "POST"): Promise<unknown>;
}

const IC_METHOD_PREFIX = "erpnext.intercompany.intercompany_billing";

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
  description: "Invoice line items",
};

export const icBillingToolDefinitions = [
  {
    name: "ic_list_accounts",
    description:
      "List configured intercompany company pairs with internal Customer (AR) and Supplier (AP) master data links.",
    inputSchema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description: "Filter pairs involving this company (optional)",
        },
      },
    },
  },
  {
    name: "ic_create_sales_invoice",
    description:
      "Create intercompany Sales Invoice on the selling company (from_company) — posts to Accounts Receivable (AR).",
    inputSchema: {
      type: "object",
      properties: {
        from_company: { type: "string", description: "Selling company (AR side)" },
        to_company: { type: "string", description: "Buying company" },
        items: itemSchema,
        posting_date: { type: "string", description: "YYYY-MM-DD (optional)" },
        customer: {
          type: "string",
          description: "Override internal customer (optional; resolved from pair if omitted)",
        },
        submit: { type: "boolean", description: "Submit after create (default false)" },
      },
      required: ["from_company", "to_company", "items"],
    },
  },
  {
    name: "ic_create_purchase_invoice",
    description:
      "Create intercompany Purchase Invoice on the buying company (to_company) — posts to Accounts Payable (AP).",
    inputSchema: {
      type: "object",
      properties: {
        from_company: { type: "string", description: "Selling company" },
        to_company: { type: "string", description: "Buying company (AP side)" },
        items: itemSchema,
        posting_date: { type: "string", description: "YYYY-MM-DD (optional)" },
        supplier: {
          type: "string",
          description: "Override internal supplier (optional; resolved from pair if omitted)",
        },
        submit: { type: "boolean", description: "Submit after create (default false)" },
      },
      required: ["from_company", "to_company", "items"],
    },
  },
  {
    name: "ic_create_invoice_pair",
    description:
      "Create linked Sales Invoice (AR on seller) and Purchase Invoice (AP on buyer) for a company pair.",
    inputSchema: {
      type: "object",
      properties: {
        from_company: { type: "string", description: "Selling company" },
        to_company: { type: "string", description: "Buying company" },
        items: itemSchema,
        posting_date: { type: "string", description: "YYYY-MM-DD (optional)" },
        customer: { type: "string", description: "Override internal customer (optional)" },
        supplier: { type: "string", description: "Override internal supplier (optional)" },
        submit: { type: "boolean", description: "Submit both invoices (default true)" },
      },
      required: ["from_company", "to_company", "items"],
    },
  },
  {
    name: "ic_submit_invoice",
    description: "Submit one or both intercompany Sales Invoice and/or Purchase Invoice.",
    inputSchema: {
      type: "object",
      properties: {
        sales_invoice: { type: "string", description: "Sales Invoice name (optional)" },
        purchase_invoice: { type: "string", description: "Purchase Invoice name (optional)" },
      },
    },
  },
  {
    name: "ic_get_invoice_status",
    description:
      "Trace AR/AP posting status for intercompany invoice(s). Resolves linked SI/PI from inter_company_invoice_reference.",
    inputSchema: {
      type: "object",
      properties: {
        sales_invoice: { type: "string", description: "Sales Invoice name (optional)" },
        purchase_invoice: { type: "string", description: "Purchase Invoice name (optional)" },
      },
    },
  },
] as const;

export type IcBillingToolName = (typeof icBillingToolDefinitions)[number]["name"];

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

async function callIcMethod(
  client: ERPNextClientLike,
  method: string,
  args: Record<string, unknown>
) {
  return client.callMethod(`${IC_METHOD_PREFIX}.${method}`, args);
}

export async function handleIcBillingToolCall(
  client: ERPNextClientLike,
  toolName: IcBillingToolName,
  args: Record<string, unknown> | undefined
) {
  try {
    switch (toolName) {
      case "ic_list_accounts": {
        const result = await callIcMethod(client, "list_intercompany_accounts", {
          company: args?.company,
        });
        return textResult(result);
      }

      case "ic_create_sales_invoice": {
        if (!args?.from_company || !args?.to_company || !args?.items) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "from_company, to_company, and items are required"
          );
        }
        const result = await callIcMethod(client, "create_intercompany_sales_invoice", {
          from_company: String(args.from_company),
          to_company: String(args.to_company),
          items: serializeJsonField(args.items, "items"),
          posting_date: args.posting_date,
          customer: args.customer,
          submit: args.submit ? 1 : 0,
        });
        return textResult(result);
      }

      case "ic_create_purchase_invoice": {
        if (!args?.from_company || !args?.to_company || !args?.items) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "from_company, to_company, and items are required"
          );
        }
        const result = await callIcMethod(client, "create_intercompany_purchase_invoice", {
          from_company: String(args.from_company),
          to_company: String(args.to_company),
          items: serializeJsonField(args.items, "items"),
          posting_date: args.posting_date,
          supplier: args.supplier,
          submit: args.submit ? 1 : 0,
        });
        return textResult(result);
      }

      case "ic_create_invoice_pair": {
        if (!args?.from_company || !args?.to_company || !args?.items) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "from_company, to_company, and items are required"
          );
        }
        const result = await callIcMethod(client, "create_intercompany_invoice_pair", {
          from_company: String(args.from_company),
          to_company: String(args.to_company),
          items: serializeJsonField(args.items, "items"),
          posting_date: args.posting_date,
          customer: args.customer,
          supplier: args.supplier,
          submit: args.submit === false ? 0 : 1,
        });
        return textResult(result);
      }

      case "ic_submit_invoice": {
        if (!args?.sales_invoice && !args?.purchase_invoice) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "sales_invoice and/or purchase_invoice is required"
          );
        }
        const result = await callIcMethod(client, "submit_intercompany_invoice", {
          sales_invoice: args.sales_invoice,
          purchase_invoice: args.purchase_invoice,
        });
        return textResult(result);
      }

      case "ic_get_invoice_status": {
        if (!args?.sales_invoice && !args?.purchase_invoice) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "sales_invoice and/or purchase_invoice is required"
          );
        }
        const result = await callIcMethod(client, "get_intercompany_invoice_status", {
          sales_invoice: args.sales_invoice,
          purchase_invoice: args.purchase_invoice,
        });
        return textResult(result);
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown IC billing tool: ${toolName}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown IC billing tool error";
    return errorResult(message);
  }
}

export function isIcBillingToolName(name: string): name is IcBillingToolName {
  return icBillingToolDefinitions.some((tool) => tool.name === name);
}
