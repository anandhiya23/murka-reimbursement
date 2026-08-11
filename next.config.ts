import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module — keep it external so it isn't bundled (Vercel
  // provides a compatible binary at runtime).
  serverExternalPackages: ["sharp"],

  // Dev-only: Next blocks cross-origin requests to /_next dev assets, which
  // breaks hydration when testing from a phone on the LAN IP. Allow private
  // network ranges so device testing works.
  allowedDevOrigins: ["192.168.*.*", "172.*.*.*", "10.*.*.*"],
};

export default nextConfig;
