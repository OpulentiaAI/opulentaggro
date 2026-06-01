import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
/**
 * ERPNext whitelisted methods often expect JSON-encoded child rows (e.g. items).
 * MCP tool schemas use arrays; direct API callers may pass an already-serialized string.
 * Avoid double-encoding: JSON.stringify on a string produces invalid payloads (HTTP 500).
 */
export function serializeJsonField(value, fieldName = "items") {
    if (value === undefined || value === null) {
        throw new McpError(ErrorCode.InvalidParams, `${fieldName} is required`);
    }
    if (typeof value === "string") {
        try {
            JSON.parse(value);
            return value;
        }
        catch {
            throw new McpError(ErrorCode.InvalidParams, `${fieldName} must be a JSON array string or array of objects`);
        }
    }
    return JSON.stringify(value);
}
