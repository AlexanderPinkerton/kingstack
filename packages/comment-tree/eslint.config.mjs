import baseConfig from "@kingstack/eslint-config";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig(...baseConfig, {
  name: "kingstack/react-hooks",
  files: ["src/**/*.{ts,tsx}"],
  extends: [reactHooks.configs.flat.recommended],
  rules: {
    // TanStack Virtual is intentionally not memoized by React Compiler.
    "react-hooks/incompatible-library": "off",
  },
});
