// Frontend config: extends shared base + adds React hooks rules

import baseConfig from "@celestial/eslint-config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import reactHooks from "eslint-plugin-react-hooks";

const esLintConfig = [
    {
        plugins: {
            "react-hooks": reactHooks,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
        },
    },
    ...baseConfig.map((config) => {
        if (config.languageOptions?.parser === "@typescript-eslint/parser") {
            return {
                ...config,
                languageOptions: {
                    ...config.languageOptions,
                    parserOptions: {
                        ...config.languageOptions.parserOptions,
                        tsconfigRootDir: __dirname,
                        project: ["./tsconfig.json"],
                    },
                },
            };
        }
        return config;
    }),
];

export default esLintConfig;
