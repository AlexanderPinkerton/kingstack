import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
    exclude: ["node_modules", "dist"],
    globals: true,
    environment: "node",
    reporters: [
      [
        "default",
        {
          summary: false,
        },
      ],
    ],
    setupFiles: [],
    coverage: {
      enabled: false,
    },
  },
});
