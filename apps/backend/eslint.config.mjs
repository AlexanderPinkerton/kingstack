// Backend config: uses shared base config only (no Next.js/React rules)

import baseConfig from "@kingstack/eslint-config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inject the proper tsconfig path for this app so type-aware linting works
export default baseConfig.map((config) => {
    if (config.languageOptions?.parser === "@typescript-eslint/parser") {
        return {
            ...config,
            languageOptions: {
                ...config.languageOptions,
                parserOptions: {
                    ...config.languageOptions.parserOptions,
                    tsconfigRootDir: __dirname,         // Set to current backend folder
                    project: ["./tsconfig.json"],        // Adjust if using tsconfig.eslint.json
                },
            },
        };
    }
    return config;
});
