import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext applies the multipart guard before API routing, including asset uploads.
  // Keep it above the existing 20 MB PDF limit; individual routes enforce their own limits.
  experimental: { serverActions: { bodySizeLimit: "22mb" } },
};

export default nextConfig;
