import { NextResponse } from "next/server";
import { checkErpnextConnectivity } from "@/lib/erpnext/fetch-client";

export const runtime = "nodejs";

export async function GET() {
  const erpnextUrl = process.env.ERPNEXT_URL ?? null;
  const mcpProtected = Boolean(process.env.MCP_AUTH_TOKEN);
  const connectivity = await checkErpnextConnectivity();

  return NextResponse.json({
    status: "ok",
    service: "opulentaggro-vercel",
    framework: "nextjs",
    components: {
      mcp: {
        endpoint: "/api/mcp",
        transport: "streamable-http (stateless)",
        auth: mcpProtected ? "bearer-token" : "open",
      },
      erpnext: {
        configured: connectivity.configured,
        url: erpnextUrl,
        reachable: connectivity.reachable,
        authMode: connectivity.authMode,
        error: connectivity.error,
      },
      pages: {
        desk: "/app",
        dashboard: "/app/sto-dashboard",
        trace: "/app/sto-trace",
        intercompany: "/app/intercompany",
        billing: "/app/intercompany/billing",
        login: "/login",
      },
    },
  });
}
