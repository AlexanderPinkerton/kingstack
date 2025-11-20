export const COLOR_VARIABLES = [
  "--color-primary",
  "--color-on-primary",
  "--color-secondary",
  "--color-on-secondary",
  "--color-tertiary",
  "--color-on-tertiary",
  "--color-surface",
  "--color-on-surface",
  "--color-surface-elevated",
  "--color-surface-dim",
  "--color-outline",
  "--color-outline-variant",
  "--color-inverse-surface",
  "--color-on-inverse-surface",
  "--color-error",
  "--color-on-error",
  "--color-success",
  "--color-on-success",
  "--color-warning",
] as const;

export const EXTRA_COLOR_TOKENS = [
  "--color-success-contrast",
  "--color-warning-contrast",
  "--color-error-contrast",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
] as const;

export type ColorVariable = (typeof COLOR_VARIABLES)[number];

export const DEFAULT_RADIUS = 0;

