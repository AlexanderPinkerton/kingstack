// Package config: extends shared base config

import baseConfig from "@kingstack/eslint-config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log the current directory for debugging purposes
console.log("Eslint advanced-optimistic-store Dir:", __dirname);

// Inject correct tsconfig path for type-aware linting
const esLintConfig = [
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
