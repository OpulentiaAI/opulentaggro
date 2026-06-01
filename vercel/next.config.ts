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
};

export default nextConfig;
