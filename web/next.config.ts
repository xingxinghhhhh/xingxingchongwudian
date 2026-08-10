import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_CLOUD_PET_WEB_RELEASE_ID:
      process.env.CLOUD_PET_RELEASE_ID?.trim() ?? ""
  }
};

export default nextConfig;
