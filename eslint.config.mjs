import baseConfig from "@kingstack/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    name: "kingstack/root-workspace-boundary",
    ignores: [
      "apps/**",
      "packages/**",
      "config/local.ts",
      "config/development.ts",
      "config/production.ts",
    ],
  },
  ...baseConfig,
);
