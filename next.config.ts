import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) needs its worker resolved at runtime, so keep it
  // external to Next's bundling.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
