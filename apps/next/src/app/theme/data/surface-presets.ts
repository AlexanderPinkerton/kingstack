export type SurfaceShadePreset = {
  key: string;
  label: string;
  values: string[];
};

export const SURFACE_SHADE_PRESETS: SurfaceShadePreset[] = [
  {
    key: "cream",
    label: "Cream",
    values: ["#FEFEFB", "#FAF9F4", "#F0EEE6"],
  },
  {
    key: "primary",
    label: "Primary",
    values: [
      "color-mix(in srgb, white 96%, var(--color-primary))",
      "color-mix(in srgb, white 90%, var(--color-primary))",
      "color-mix(in srgb, white 80%, var(--color-primary))",
    ],
  },
  {
    key: "secondary",
    label: "Secondary",
    values: [
      "color-mix(in srgb, white 96%, var(--color-secondary))",
      "color-mix(in srgb, white 90%, var(--color-secondary))",
      "color-mix(in srgb, white 80%, var(--color-secondary))",
    ],
  },
  {
    key: "tertiary",
    label: "Tertiary",
    values: [
      "color-mix(in srgb, white 96%, var(--color-tertiary))",
      "color-mix(in srgb, white 90%, var(--color-tertiary))",
      "color-mix(in srgb, white 80%, var(--color-tertiary))",
    ],
  },
];

