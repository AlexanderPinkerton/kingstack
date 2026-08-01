import baseConfig from "@kingstack/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig(
  ...baseConfig,
  {
    name: "kingstack/nest-runtime-logging",
    files: ["src/**/*.ts"],
    ignores: ["src/scripts/**/*.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    name: "kingstack/nest-cli-output",
    files: ["src/scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
);
