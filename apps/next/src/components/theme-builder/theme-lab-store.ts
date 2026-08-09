import { makeAutoObservable } from "mobx";

export type ThemeDensity = "compact" | "comfortable";
export type ThemeColorKey =
  "background" | "surface" | "foreground" | "accentOne" | "accentTwo";

export interface ThemePalette {
  background: string;
  surface: string;
  foreground: string;
  accentOne: string;
  accentTwo: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  palette: ThemePalette;
  radius: number;
  glow: number;
  density: ThemeDensity;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "kingstack",
    name: "KingStack",
    description: "Cyan signal, violet depth",
    palette: {
      background: "#090a0c",
      surface: "#15171c",
      foreground: "#f5f2e8",
      accentOne: "#8ee8ff",
      accentTwo: "#8d7cff",
    },
    radius: 18,
    glow: 42,
    density: "comfortable",
  },
  {
    id: "signal",
    name: "Signal",
    description: "Lime energy, deep forest",
    palette: {
      background: "#06100c",
      surface: "#0e1c16",
      foreground: "#efffe8",
      accentOne: "#d8ff70",
      accentTwo: "#35e6a3",
    },
    radius: 10,
    glow: 52,
    density: "compact",
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm light, cinematic dark",
    palette: {
      background: "#120a08",
      surface: "#21120f",
      foreground: "#fff1e8",
      accentOne: "#ff9c6e",
      accentTwo: "#ffcf70",
    },
    radius: 24,
    glow: 48,
    density: "comfortable",
  },
  {
    id: "paper",
    name: "Paper",
    description: "Editorial light, violet ink",
    palette: {
      background: "#f1eee5",
      surface: "#fffdf7",
      foreground: "#171812",
      accentOne: "#6555d9",
      accentTwo: "#d4527f",
    },
    radius: 8,
    glow: 14,
    density: "comfortable",
  },
] as const;

const DEFAULT_PRESET_ID = "kingstack";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function presetById(id: string): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

function clonePalette(palette: ThemePalette): ThemePalette {
  return { ...palette };
}

export class ThemeLabStore {
  selectedPresetId = DEFAULT_PRESET_ID;
  palette = clonePalette(presetById(DEFAULT_PRESET_ID).palette);
  radius = presetById(DEFAULT_PRESET_ID).radius;
  glow = presetById(DEFAULT_PRESET_ID).glow;
  density: ThemeDensity = presetById(DEFAULT_PRESET_ID).density;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get selectedPreset(): ThemePreset {
    return presetById(this.selectedPresetId);
  }

  get customizationCount(): number {
    const preset = this.selectedPreset;
    const changedColors = (Object.keys(this.palette) as ThemeColorKey[]).filter(
      (key) => this.palette[key] !== preset.palette[key],
    ).length;

    return (
      changedColors +
      Number(this.radius !== preset.radius) +
      Number(this.glow !== preset.glow) +
      Number(this.density !== preset.density)
    );
  }

  get isCustomized(): boolean {
    return this.customizationCount > 0;
  }

  get cssVariables(): Record<string, string> {
    const spacing = this.density === "compact" ? "0.75rem" : "1rem";
    const largeSpacing = this.density === "compact" ? "1rem" : "1.35rem";

    return {
      "--background": this.palette.background,
      "--foreground": this.palette.foreground,
      "--card": this.palette.surface,
      "--card-foreground": this.palette.foreground,
      "--popover": this.palette.surface,
      "--popover-foreground": this.palette.foreground,
      "--primary": this.palette.accentOne,
      "--primary-foreground": this.palette.background,
      "--secondary": "color-mix(in oklch, var(--accent-2-m) 16%, var(--card))",
      "--secondary-foreground": this.palette.foreground,
      "--muted": "color-mix(in oklch, var(--foreground) 7%, var(--background))",
      "--muted-foreground":
        "color-mix(in oklch, var(--foreground) 56%, var(--background))",
      "--accent": "color-mix(in oklch, var(--accent-1-m) 14%, var(--card))",
      "--accent-foreground": this.palette.foreground,
      "--border":
        "color-mix(in oklch, var(--foreground) 15%, var(--background))",
      "--input":
        "color-mix(in oklch, var(--foreground) 18%, var(--background))",
      "--ring": this.palette.accentOne,
      "--accent-1-m": this.palette.accentOne,
      "--accent-2-m": this.palette.accentTwo,
      "--accent-1-l": "color-mix(in oklch, var(--accent-1-m) 72%, white)",
      "--accent-1-d": "color-mix(in oklch, var(--accent-1-m) 72%, black)",
      "--accent-2-l": "color-mix(in oklch, var(--accent-2-m) 72%, white)",
      "--accent-2-d": "color-mix(in oklch, var(--accent-2-m) 72%, black)",
      "--gradient-from": "var(--accent-1-m)",
      "--gradient-to": "var(--accent-2-m)",
      "--accent-mix":
        "color-mix(in oklch, var(--accent-1-m), var(--accent-2-m))",
      "--chart-1": this.palette.accentOne,
      "--chart-2": this.palette.accentTwo,
      "--chart-3": "color-mix(in oklch, var(--accent-1-m), var(--accent-2-m))",
      "--radius": `${this.radius}px`,
      "--theme-radius-sm": `${Math.round(this.radius * 0.55)}px`,
      "--theme-radius-xs": `${Math.round(this.radius * 0.35)}px`,
      "--theme-radius-shell": `${this.radius + 8}px`,
      "--theme-space": spacing,
      "--theme-space-lg": largeSpacing,
      "--theme-glow": `${this.glow}%`,
    };
  }

  get cssText(): string {
    const lines = Object.entries(this.cssVariables).map(
      ([name, value]) => `  ${name}: ${value};`,
    );
    return `:root {\n${lines.join("\n")}\n}`;
  }

  selectPreset(id: string): void {
    const preset = presetById(id);
    this.selectedPresetId = preset.id;
    this.palette = clonePalette(preset.palette);
    this.radius = preset.radius;
    this.glow = preset.glow;
    this.density = preset.density;
  }

  setColor(key: ThemeColorKey, value: string): void {
    if (!HEX_COLOR.test(value)) return;
    this.palette = { ...this.palette, [key]: value.toLowerCase() };
  }

  setRadius(value: number): void {
    this.radius = Math.min(28, Math.max(0, Math.round(value)));
  }

  setGlow(value: number): void {
    this.glow = Math.min(70, Math.max(0, Math.round(value)));
  }

  setDensity(density: ThemeDensity): void {
    this.density = density;
  }

  reset(): void {
    this.selectPreset(this.selectedPresetId);
  }
}
