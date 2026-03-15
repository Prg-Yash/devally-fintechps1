import type { NextConfig } from "next";

// When the admin uses API_BASE_URL = "/api", requests are proxied here. Ensure the Express API is running on this port.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_PROXY_TARGET}/:path*` }];
  },
};

export default nextConfig;
