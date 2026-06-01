import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createErpnextMcpServer } from "erpnext-mcp-server/create-server";

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function checkAuth(request: Request): Response | null {
  const expected = process.env.MCP_AUTH_TOKEN;
  if (!expected) {
    return null;
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== expected) {
    return unauthorized();
  }

  return null;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const authFailure = checkAuth(request);
  if (authFailure) {
    return authFailure;
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const { server } = createErpnextMcpServer();
  await server.connect(transport);
  return transport.handleRequest(request);
}
