// Shared base config for all apps — includes TypeScript and Prettier support.
// Does NOT include any React/Next.js-specific rules (those are added in the frontend config).

import tseslint from "typescript-eslint";                  // Official flat config helper for TypeScript
import prettierPlugin from "eslint-plugin-prettier";       // Plugin to run Prettier as an ESLint rule
import eslintConfigPrettier from "eslint-config-prettier"; // Disables ESLint rules that conflict with Prettier

// TypeScript ESLint config with Prettier rules added
const tsEslintConfig = tseslint.config({
    files: ["**/*.ts", "**/*.tsx"],

    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: {
                jsx: true, // Enable parsing of JSX for shared use in frontend
            },
        },
    },

    plugins: {
        prettier: prettierPlugin,
    },

    rules: {
        ...eslintConfigPrettier.rules,        // Disable conflicting formatting rules
        "prettier/prettier": "error",         // Run Prettier as an ESLint error
        "@typescript-eslint/no-explicit-any": "off",  // Allow 'any'
        "@typescript-eslint/no-unused-vars": "warn",  // Warn on unused vars
    },
});

// Export the combined config: recommended TS rules + our overrides + ignores
export default [
    ...tseslint.configs.recommended, // Base rules from typescript-eslint
    ...tsEslintConfig,                     // Our overrides and Prettier integration
    {
        ignores: [".next/", "dist/", "coverage/"], // Common ignored folders
    },
];
