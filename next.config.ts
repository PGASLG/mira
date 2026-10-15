import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the Mira welcome page is a static file in /public
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/index.html" }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
