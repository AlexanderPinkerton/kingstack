import { describe, expect, it } from "vitest";
import { ThemeLabStore } from "@/components/theme-builder/theme-lab-store";

describe("ThemeLabStore", () => {
  it("applies a preset as one coherent token set", () => {
    const store = new ThemeLabStore();

    store.selectPreset("paper");

    expect(store.selectedPreset.name).toBe("Paper");
    expect(store.palette.background).toBe("#f1eee5");
    expect(store.cssVariables).toMatchObject({
      "--background": "#f1eee5",
      "--card": "#fffdf7",
      "--accent-1-m": "#6555d9",
      "--radius": "8px",
    });
    expect(store.isCustomized).toBe(false);
  });

  it("derives the semantic variable graph from a small editable palette", () => {
    const store = new ThemeLabStore();

    store.setColor("accentOne", "#112233");
    store.setRadius(27);
    store.setGlow(64);
    store.setDensity("compact");

    expect(store.customizationCount).toBe(4);
    expect(store.cssVariables).toMatchObject({
      "--primary": "#112233",
      "--ring": "#112233",
      "--chart-1": "#112233",
      "--theme-space": "0.75rem",
      "--theme-glow": "64%",
      "--radius": "27px",
    });
    expect(store.cssVariables["--muted-foreground"]).toContain(
      "var(--foreground)",
    );
  });

  it("rejects invalid colors, clamps ranges, and resets custom values", () => {
    const store = new ThemeLabStore();
    const initialAccent = store.palette.accentOne;

    store.setColor("accentOne", "red");
    store.setRadius(100);
    store.setGlow(-10);

    expect(store.palette.accentOne).toBe(initialAccent);
    expect(store.radius).toBe(28);
    expect(store.glow).toBe(0);
    expect(store.isCustomized).toBe(true);

    store.reset();

    expect(store.radius).toBe(store.selectedPreset.radius);
    expect(store.glow).toBe(store.selectedPreset.glow);
    expect(store.isCustomized).toBe(false);
  });

  it("exports the live semantic variables as reusable CSS", () => {
    const store = new ThemeLabStore();
    store.setColor("surface", "#202124");

    expect(store.cssText).toContain(":root {");
    expect(store.cssText).toContain("--card: #202124;");
    expect(store.cssText).toContain("--gradient-from: var(--accent-1-m);");
    expect(store.cssText.endsWith("\n}")).toBe(true);
  });
});
