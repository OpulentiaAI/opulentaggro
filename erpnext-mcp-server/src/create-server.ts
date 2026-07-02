import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  icBillingToolDefinitions,
  handleIcBillingToolCall,
  isIcBillingToolName,
} from "./ic-billing-tools.js";
import {
  icExtendedToolDefinitions,
  handleIcExtendedToolCall,
  isIcExtendedToolName,
} from "./ic-extended-tools.js";
import { stoToolDefinitions, handleStoToolCall, isStoToolName } from "./sto-tools.js";
import { ERPNextClient } from "./erpnext-client.js";

export interface ErpnextMcpServerBundle {
  server: Server;
  client: ERPNextClient;
}

export function createErpnextMcpServer(client?: ERPNextClient): ErpnextMcpServerBundle {
  const erpnext = client ?? new ERPNextClient();

  const server = new Server(
    {
      name: "erpnext-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "erpnext://DocTypes",
          name: "All DocTypes",
          mimeType: "application/json",
          description: "List of all available DocTypes in the ERPNext instance",
        },
      ],
    };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: [
        {
          uriTemplate: "erpnext://{doctype}/{name}",
          name: "ERPNext Document",
          mimeType: "application/json",
          description: "Fetch an ERPNext document by doctype and name",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    await erpnext.ensureAuthenticated();

    const uri = request.params.uri;
    let result: any;

    if (uri === "erpnext://DocTypes") {
      try {
        const doctypes = await erpnext.getAllDocTypes();
        result = { doctypes };
      } catch (error: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to fetch DocTypes: ${error?.message || "Unknown error"}`
        );
      }
    } else {
      const documentMatch = uri.match(/^erpnext:\/\/([^\/]+)\/(.+)$/);
      if (documentMatch) {
        const doctype = decodeURIComponent(documentMatch[1]);
        const name = decodeURIComponent(documentMatch[2]);

        try {
          result = await erpnext.getDocument(doctype, name);
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Failed to fetch ${doctype} ${name}: ${error?.message || "Unknown error"}`
          );
        }
      }
    }

    if (!result) {
      throw new McpError(ErrorCode.InvalidRequest, `Invalid ERPNext resource URI: ${uri}`);
    }

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ...stoToolDefinitions,
        ...icBillingToolDefinitions,
        ...icExtendedToolDefinitions,
        {
          name: "get_doctypes",
          description: "Get a list of all available DocTypes",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_doctype_fields",
          description: "Get fields list for a specific DocType",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "ERPNext DocType (e.g., Customer, Item)" },
            },
            required: ["doctype"],
          },
        },
        {
          name: "get_documents",
          description: "Get a list of documents for a specific doctype",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "ERPNext DocType (e.g., Customer, Item)" },
              fields: { type: "array", items: { type: "string" }, description: "Fields to include (optional)" },
              filters: {
                type: "object",
                additionalProperties: true,
                description: "Filters in the format {field: value} (optional)",
              },
              limit: { type: "number", description: "Maximum number of documents to return (optional)" },
            },
            required: ["doctype"],
          },
        },
        {
          name: "create_document",
          description: "Create a new document in ERPNext",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "ERPNext DocType (e.g., Customer, Item)" },
              data: { type: "object", additionalProperties: true, description: "Document data" },
              verbose: {
                type: "boolean",
                description:
                  "If true, return the full document in the response. Default is false (returns minimal confirmation only).",
              },
            },
            required: ["doctype", "data"],
          },
        },
        {
          name: "update_document",
          description: "Update an existing document in ERPNext",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "ERPNext DocType (e.g., Customer, Item)" },
              name: { type: "string", description: "Document name/ID" },
              data: { type: "object", additionalProperties: true, description: "Document data to update" },
              verbose: { type: "boolean", description: "If true, return the full document in the response." },
            },
            required: ["doctype", "name", "data"],
          },
        },
        {
          name: "run_report",
          description: "Run an ERPNext report",
          inputSchema: {
            type: "object",
            properties: {
              report_name: { type: "string", description: "Name of the report" },
              filters: {
                type: "object",
                additionalProperties: true,
                description: "Report filters (optional)",
              },
            },
            required: ["report_name"],
          },
        },
        {
          name: "get_document",
          description: "Get a single document by DocType and name, including all child tables and linked data",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "ERPNext DocType (e.g., Customer, Sales Order, BOM)" },
              name: { type: "string", description: "Document name/ID" },
            },
            required: ["doctype", "name"],
          },
        },
        {
          name: "call_method",
          description: "Call an ERPNext/Frappe whitelisted server-side API method.",
          inputSchema: {
            type: "object",
            properties: {
              method: { type: "string", description: "Dotted method path" },
              args: {
                type: "object",
                additionalProperties: true,
                description: "Method arguments as key-value pairs (optional)",
              },
              http_method: {
                type: "string",
                enum: ["GET", "POST"],
                description: "HTTP method to use (default: POST).",
              },
            },
            required: ["method"],
          },
        },
        {
          name: "submit_document",
          description: "Submit a document (set docstatus to 1).",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "ERPNext DocType" },
              name: { type: "string", description: "Document name/ID" },
              verbose: { type: "boolean", description: "If true, return the full document." },
            },
            required: ["doctype", "name"],
          },
        },
        {
          name: "cancel_document",
          description: "Cancel a submitted document (set docstatus to 2).",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "ERPNext DocType" },
              name: { type: "string", description: "Document name/ID" },
              verbose: { type: "boolean", description: "If true, return the full document." },
            },
            required: ["doctype", "name"],
          },
        },
        {
          name: "delete_document",
          description: "Permanently delete a document from ERPNext.",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "ERPNext DocType" },
              name: { type: "string", description: "Document name/ID" },
            },
            required: ["doctype", "name"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      await erpnext.ensureAuthenticated();
    } catch (authError: unknown) {
      const message = authError instanceof Error ? authError.message : "Authentication failed";
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }

    if (isStoToolName(request.params.name)) {
      return handleStoToolCall(
        erpnext,
        request.params.name,
        request.params.arguments as Record<string, unknown> | undefined
      );
    }

    if (isIcBillingToolName(request.params.name)) {
      return handleIcBillingToolCall(
        erpnext,
        request.params.name,
        request.params.arguments as Record<string, unknown> | undefined
      );
    }

    if (isIcExtendedToolName(request.params.name)) {
      return handleIcExtendedToolCall(
        erpnext,
        request.params.name,
        request.params.arguments as Record<string, unknown> | undefined
      );
    }

    switch (request.params.name) {
      case "get_documents": {
        const doctype = String(request.params.arguments?.doctype);
        const fields = request.params.arguments?.fields as string[] | undefined;
        const filters = request.params.arguments?.filters as Record<string, any> | undefined;
        const limit = request.params.arguments?.limit as number | undefined;

        if (!doctype) {
          throw new McpError(ErrorCode.InvalidParams, "Doctype is required");
        }

        try {
          const documents = await erpnext.getDocList(doctype, filters, fields, limit);
          return { content: [{ type: "text", text: JSON.stringify(documents, null, 2) }] };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to get ${doctype} documents: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "create_document": {
        const doctype = String(request.params.arguments?.doctype);
        const data = request.params.arguments?.data as Record<string, any> | undefined;
        const verbose = request.params.arguments?.verbose === true;

        if (!doctype || !data) {
          throw new McpError(ErrorCode.InvalidParams, "Doctype and data are required");
        }

        try {
          const result = await erpnext.createDocument(doctype, data);
          if (verbose) {
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  doctype,
                  name: result.name,
                  docstatus: result.docstatus,
                }),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to create ${doctype}: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "update_document": {
        const doctype = String(request.params.arguments?.doctype);
        const name = String(request.params.arguments?.name);
        const data = request.params.arguments?.data as Record<string, any> | undefined;
        const verbose = request.params.arguments?.verbose === true;

        if (!doctype || !name || !data) {
          throw new McpError(ErrorCode.InvalidParams, "Doctype, name, and data are required");
        }

        try {
          const result = await erpnext.updateDocument(doctype, name, data);
          if (verbose) {
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  doctype,
                  name: result.name,
                  docstatus: result.docstatus,
                }),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              { type: "text", text: `Failed to update ${doctype} ${name}: ${error?.message || "Unknown error"}` },
            ],
            isError: true,
          };
        }
      }

      case "run_report": {
        const reportName = String(request.params.arguments?.report_name);
        const filters = request.params.arguments?.filters as Record<string, any> | undefined;

        if (!reportName) {
          throw new McpError(ErrorCode.InvalidParams, "Report name is required");
        }

        try {
          const result = await erpnext.runReport(reportName, filters);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to run report ${reportName}: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "get_document": {
        const doctype = String(request.params.arguments?.doctype);
        const name = String(request.params.arguments?.name);

        if (!doctype || !name) {
          throw new McpError(ErrorCode.InvalidParams, "Doctype and name are required");
        }

        try {
          const document = await erpnext.getDocument(doctype, name);
          return { content: [{ type: "text", text: JSON.stringify(document, null, 2) }] };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to get ${doctype} ${name}: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "call_method": {
        const method = String(request.params.arguments?.method);
        const args = request.params.arguments?.args as Record<string, any> | undefined;
        const httpMethod = (request.params.arguments?.http_method as "GET" | "POST") || "POST";

        if (!method) {
          throw new McpError(ErrorCode.InvalidParams, "Method is required");
        }

        try {
          const result = await erpnext.callMethod(method, args, httpMethod);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to call method ${method}: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "submit_document": {
        const doctype = String(request.params.arguments?.doctype);
        const name = String(request.params.arguments?.name);
        const verbose = request.params.arguments?.verbose === true;

        if (!doctype || !name) {
          throw new McpError(ErrorCode.InvalidParams, "Doctype and name are required");
        }

        try {
          const fullDoc = await erpnext.getDocument(doctype, name);
          const result = await erpnext.callMethod("frappe.client.submit", { doc: fullDoc });
          if (verbose) {
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
          if (!result || typeof result !== "object" || result.name == null || result.docstatus == null) {
            throw new McpError(
              ErrorCode.InternalError,
              `Unexpected response from ERPNext while submitting ${doctype} ${name}`
            );
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  doctype,
                  name: result.name,
                  docstatus: result.docstatus,
                }),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to submit ${doctype} ${name}: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "cancel_document": {
        const doctype = String(request.params.arguments?.doctype);
        const name = String(request.params.arguments?.name);
        const verbose = request.params.arguments?.verbose === true;

        if (!doctype || !name) {
          throw new McpError(ErrorCode.InvalidParams, "Doctype and name are required");
        }

        try {
          const result = await erpnext.callMethod("frappe.client.cancel", { doctype, name });
          if (verbose) {
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
          if (!result || typeof result !== "object" || result.name == null || result.docstatus == null) {
            throw new McpError(
              ErrorCode.InternalError,
              `Unexpected response from ERPNext while cancelling ${doctype} ${name}`
            );
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  doctype,
                  name: result.name,
                  docstatus: result.docstatus,
                }),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to cancel ${doctype} ${name}: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "delete_document": {
        const doctype = String(request.params.arguments?.doctype);
        const name = String(request.params.arguments?.name);

        if (!doctype || !name) {
          throw new McpError(ErrorCode.InvalidParams, "Doctype and name are required");
        }

        try {
          await erpnext.deleteDocument(doctype, name);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "success", action: "deleted", doctype, name }),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to delete ${doctype} ${name}: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "get_doctype_fields": {
        const doctype = String(request.params.arguments?.doctype);

        if (!doctype) {
          throw new McpError(ErrorCode.InvalidParams, "Doctype is required");
        }

        try {
          const documents = await erpnext.getDocList(doctype, {}, ["*"], 1);

          if (!documents || documents.length === 0) {
            return {
              content: [{ type: "text", text: `No documents found for ${doctype}. Cannot determine fields.` }],
              isError: true,
            };
          }

          const sampleDoc = documents[0];
          const fields = Object.keys(sampleDoc).map((field) => ({
            fieldname: field,
            value: typeof sampleDoc[field],
            sample: sampleDoc[field]?.toString()?.substring(0, 50) || null,
          }));

          return { content: [{ type: "text", text: JSON.stringify(fields, null, 2) }] };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to get fields for ${doctype}: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      case "get_doctypes": {
        try {
          const doctypes = await erpnext.getAllDocTypes();
          return { content: [{ type: "text", text: JSON.stringify(doctypes, null, 2) }] };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Failed to get DocTypes: ${error?.message || "Unknown error"}` }],
            isError: true,
          };
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
  });

  return { server, client: erpnext };
}
