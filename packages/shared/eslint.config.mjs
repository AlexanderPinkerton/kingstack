// Frontend config: extends shared base + adds Next.js rules with backward compatibility

import baseConfig from "@kingstack/eslint-config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log the current directory for debugging purposes
console.log("Eslint Frontend Dir:", __dirname);


// Merge Next.js rules with our shared base config, and inject correct tsconfig path
const esLintConfig = [
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
