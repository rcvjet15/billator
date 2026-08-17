import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trace only the code needed at runtime for a lean Docker image.
  output: "standalone",
  // pdf-parse (pdfjs-dist) needs its worker resolved at runtime, so keep it
  // external to Next's bundling.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
