// NextJS config: extends shared base + adds Next.js rules
// Next.js 16's eslint-config-next already exports flat config format

import baseConfig from "@kingstack/eslint-config";
import nextConfig from "eslint-config-next";

// Filter out the 'next/typescript' config from nextConfig since we handle TypeScript in baseConfig
// This prevents plugin redefinition conflicts
const nextBaseConfig = nextConfig.filter((config) => config.name !== "next/typescript");

// Merge Next.js rules with the shared TypeScript config.
const esLintConfig = [
    ...nextBaseConfig,
    ...baseConfig,
];

export default esLintConfig
