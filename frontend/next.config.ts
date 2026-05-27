import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/reset-password",
        destination: "/reset-pwd",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;