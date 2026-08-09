import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";

describe("local Supabase CLI pin", () => {
  it("uses an exact version so yarn install cannot advance the image generation", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.supabase).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
