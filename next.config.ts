import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Teaching materials (slides, PDFs) are uploaded through server actions.
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  poweredByHeader: false,
  // Text extraction libraries run as plain Node modules on the server.
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
