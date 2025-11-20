import type { JuiceLevel, JuiceLevelConfig } from "./types";

/**
 * Configuration for each juice level
 */
export const JUICE_CONFIGS: Record<JuiceLevel, JuiceLevelConfig> = {
  0: {
    scale: {
      hover: 1,
      active: 1,
    },
    duration: 150,
    enableRipple: false,
    enableSound: false,
    enableConfetti: false,
    enableHaptic: false,
  },
  1: {
    scale: {
      hover: 1.02,
      active: 0.98,
    },
    duration: 150,
    enableRipple: false,
    enableSound: false,
    enableConfetti: false,
    enableHaptic: true,
  },
  2: {
    scale: {
      hover: 1.05,
      active: 0.95,
    },
    duration: 250,
    enableRipple: true,
    enableSound: true,
    enableConfetti: false,
    enableHaptic: true,
  },
  3: {
    scale: {
      hover: 1.08,
      active: 0.92,
    },
    duration: 350,
    enableRipple: true,
    enableSound: true,
    enableConfetti: true,
    enableHaptic: true,
  },
};

/**
 * Get juice configuration for a specific level
 */
export function getJuiceConfig(level: JuiceLevel): JuiceLevelConfig {
  return JUICE_CONFIGS[level];
}

/**
 * Determine if a feature is enabled for a juice level
 */
export function isFeatureEnabled(
  level: JuiceLevel,
  feature: keyof Omit<JuiceLevelConfig, "scale" | "duration">
): boolean {
  return JUICE_CONFIGS[level][feature];
}
