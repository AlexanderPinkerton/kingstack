// Frontend config: extends shared base + adds Next.js rules with backward compatibility

import baseConfig from "@kingstack/eslint-config";
import path from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { fixupConfigRules } from "@eslint/compat"; // Patches older plugin APIs for ESLint 9+

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log the current directory for debugging purposes
console.log("Eslint Frontend Dir:", __dirname);

// FlatCompat allows us to reuse existing eslint configs like 'next/core-web-vitals'
const compat = new FlatCompat({
    baseDirectory: __dirname,
});

// Fixup patches legacy plugin context issues (e.g., `getAncestors`) from ESLint 9+ updates
const nextCompatRules = fixupConfigRules([
    ...compat.extends("next/core-web-vitals"), // Add Next.js opinionated rules
]);

// Merge Next.js rules with our shared base config, and inject correct tsconfig path
const esLintConfig = [
    ...nextCompatRules,
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
