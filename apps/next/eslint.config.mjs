import baseConfig from "@kingstack/eslint-config";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig(
  ...baseConfig,
  {
    name: "kingstack/next",
    files: ["**/*.{js,jsx,ts,tsx,mjs,mts}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    name: "kingstack/react-hooks",
    files: ["**/*.{js,jsx,ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      // Third-party hooks such as TanStack Table intentionally return functions.
      "react-hooks/incompatible-library": "off",
      // Hydration guards and responsive state intentionally synchronize on mount.
      "react-hooks/set-state-in-effect": "off",
    },
  },
);
