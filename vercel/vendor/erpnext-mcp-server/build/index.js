#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createErpnextMcpServer } from "./create-server.js";
async function main() {
    const { server, client } = createErpnextMcpServer();
    try {
        await client.ensureAuthenticated();
        console.error(`ERPNext MCP auth: ${client.authMode()}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`ERPNext MCP auth warning: ${message}`);
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ERPNext MCP server running on stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
