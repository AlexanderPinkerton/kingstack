export type ShadowPreset = {
  id: string;
  label: string;
  value: string;
};

export const SHADOW_PRESETS: ShadowPreset[] = [
  {
    id: "flat",
    label: "No shadow",
    value: "none",
  },
  {
    id: "soft",
    label: "Soft ambient",
    value: "0 35px 60px -30px rgba(15, 23, 42, 0.4)",
  },
  {
    id: "contrast",
    label: "High contrast",
    value:
      "0 20px 35px rgba(12, 10, 29, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
  },
  {
    id: "minimal",
    label: "Minimal outline",
    value: "0 12px 26px -18px rgba(15, 23, 42, 0.9)",
  },
];

export const DEFAULT_SHADOW_ID = SHADOW_PRESETS[0]?.id ?? "flat";

