import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module — keep it external so it isn't bundled (Vercel
  // provides a compatible binary at runtime).
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
