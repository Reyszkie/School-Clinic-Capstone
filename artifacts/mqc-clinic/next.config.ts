import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/db", "@workspace/api-zod"],
};

export default nextConfig;