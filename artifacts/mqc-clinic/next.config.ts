import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

const workspaceEnvFile = path.resolve(process.cwd(), "../../.env");
if (existsSync(workspaceEnvFile)) process.loadEnvFile(workspaceEnvFile);

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/db", "@workspace/api-zod"],
};

export default nextConfig;