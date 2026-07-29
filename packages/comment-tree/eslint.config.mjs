// React package config: shared TypeScript rules plus React Hooks.

import baseConfig from "@kingstack/eslint-config";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  ...baseConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
