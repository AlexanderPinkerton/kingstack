// NextJS config: extends shared base + adds Next.js rules
// Next.js 16's eslint-config-next already exports flat config format

import baseConfig from "@kingstack/eslint-config";
import path from "path";
import { fileURLToPath } from "url";
import nextConfig from "eslint-config-next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log the current directory for debugging purposes
console.log("Eslint NextJS Dir:", __dirname);

// Filter out the 'next/typescript' config from nextConfig since we handle TypeScript in baseConfig
// This prevents plugin redefinition conflicts
const nextBaseConfig = nextConfig.filter((config) => config.name !== "next/typescript");

// Merge Next.js rules with our shared base config, and inject correct tsconfig path
const esLintConfig = [
    ...nextBaseConfig, // Next.js base config (without TypeScript config to avoid conflicts)
    ...baseConfig.map((config) => {
        if (config.languageOptions?.parser === "@typescript-eslint/parser") {
            return {
                ...config,
                languageOptions: {
                    ...config.languageOptions,
                    parserOptions: {
                        ...config.languageOptions.parserOptions,
                        tsconfigRootDir: __dirname,         // Point to the current project root
                        project: ["./tsconfig.json"],        // Needed for type-aware linting
                    },
                },
            };
        }
        return config;
    }),
];

export default esLintConfig
