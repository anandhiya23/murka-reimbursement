import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/init",
        destination: "http://localhost:3001/init",
      },
      {
        source: "/postreimburse",
        destination: "http://localhost:3001/postreimburse",
      },
    ];
  },
};

export default nextConfig;
