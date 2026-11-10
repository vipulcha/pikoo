import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/r/:path*", headers: noindex },
      { source: "/embed/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
