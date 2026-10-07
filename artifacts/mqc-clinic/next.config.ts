import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

const workspaceEnvFiles = ["../../.env.local", "../../.env"].map(file => path.resolve(process.cwd(), file));
for (const workspaceEnvFile of workspaceEnvFiles) {
  if (existsSync(workspaceEnvFile)) process.loadEnvFile(workspaceEnvFile);
}

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/db", "@workspace/api-zod"],
};

export default nextConfig;