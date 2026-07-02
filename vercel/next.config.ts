import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["erpnext-mcp-server"],
  },
  async redirects() {
    return [
      { source: "/desk", destination: "/app", permanent: false },
      { source: "/desk/:path*", destination: "/app/:path*", permanent: false },
    ];
  },
  async rewrites() {
    return [
      // Safety net: Frappe desk assets requested without /erpnext prefix still reach the proxy.
      { source: "/assets/:path*", destination: "/erpnext/assets/:path*" },
      { source: "/files/:path*", destination: "/erpnext/files/:path*" },
    ];
  },
};

export default nextConfig;
