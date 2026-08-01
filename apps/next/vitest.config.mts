import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
      "server-only": resolve(import.meta.dirname, "__tests__/server-only.ts"),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
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
  },
});
