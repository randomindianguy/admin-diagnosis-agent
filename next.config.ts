import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SID-74: ensure scenario.json (read at runtime via process.cwd()) is bundled
  // into the /api/reset serverless function — resetAllPersonas() reads it for the
  // canonical seed memberships, and process.cwd() reads aren't always auto-traced.
  outputFileTracingIncludes: {
    "/api/reset": ["./scenario.json"],
  },
};

export default nextConfig;
