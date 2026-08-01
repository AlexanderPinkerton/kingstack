import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Pino and its optional worker-thread pretty transport out of server bundles.
  // Pretty output is rejected by @kingstack/logger outside local runtimes.
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default nextConfig;
