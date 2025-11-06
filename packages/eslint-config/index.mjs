// Shared base config for all apps — includes TypeScript and Prettier support.
// Does NOT include any React/Next.js-specific rules (those are added in the nextjs config).

import tseslint from "typescript-eslint";                  // Official flat config helper for TypeScript
import prettierPlugin from "eslint-plugin-prettier";       // Plugin to run Prettier as an ESLint rule
import eslintConfigPrettierFlat from "eslint-config-prettier/flat"; // Disable ESLint rules that conflict with Prettier

// TypeScript ESLint config with Prettier rules added
const tsEslintConfig = tseslint.config({
    files: ["**/*.ts", "**/*.tsx"],

    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: {
                jsx: true, // Enable parsing of JSX for shared use in nextjs
            },
        },
    },

    plugins: {
        prettier: prettierPlugin,
    },
    // THIS is the key: pull in both the “plugin:prettier” rule AND
    // disable any ESLint rules that might conflict with Prettier
    rules: {
        "prettier/prettier": "error",         // Run Prettier as an ESLint error
        "@typescript-eslint/no-explicit-any": "off",  // Allow 'any'
        "@typescript-eslint/no-unused-vars": "warn",  // Warn on unused vars
    },
});

// Export the combined config: recommended TS rules + our overrides + ignores
export default [
    eslintConfigPrettierFlat,
    ...tseslint.configs.recommended, // Base rules from typescript-eslint
    ...tsEslintConfig,                     // Our overrides and Prettier integration
    {
        ignores: [".next/", "dist/", "coverage/"], // Common ignored folders
    },
];
