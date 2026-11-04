import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Teaching materials (slides, PDFs) are uploaded through server actions.
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  poweredByHeader: false,
};

export default nextConfig;
