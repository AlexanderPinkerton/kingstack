// Shared TypeScript and Prettier configuration. Type-aware correctness is
// handled by each package's tsc check; framework rules are layered on by
// consuming apps and packages.

import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import prettierPlugin from "eslint-plugin-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [
      ...tseslint.configs.recommended,
      eslintConfigPrettier,
    ],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
);
