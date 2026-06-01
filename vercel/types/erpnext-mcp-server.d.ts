declare module "erpnext-mcp-server/create-server" {
  import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

  export class ERPNextClient {
    ensureAuthenticated(): Promise<void>;
    authMode(): string;
  }

  export interface ErpnextMcpServerBundle {
    server: Server;
    client: ERPNextClient;
  }

  export function createErpnextMcpServer(client?: ERPNextClient): ErpnextMcpServerBundle;
}

declare module "erpnext-mcp-server/erpnext-client" {
  export class ERPNextClient {
    ensureAuthenticated(): Promise<void>;
    authMode(): string;
  }
}
