import type { ThemeAdaptation, ThemeStyleVariant } from "./types";

/**
 * Detects the theme style from the DOM
 * Looks for data-style attribute on parent elements
 */
export function detectThemeStyle(element: HTMLElement | null): Exclude<ThemeStyleVariant, "auto"> {
  if (!element) return "box";

  let current: HTMLElement | null = element;
  while (current) {
    const style = current.getAttribute("data-style");
    if (style && ["box", "neo-brutalist", "neomorphism", "glassmorphism"].includes(style)) {
      return style as Exclude<ThemeStyleVariant, "auto">;
    }
    current = current.parentElement;
  }

  return "box";
}

/**
 * Theme-specific adaptations for different styles
 */
export const THEME_ADAPTATIONS: Record<
  Exclude<ThemeStyleVariant, "auto">,
  ThemeAdaptation
> = {
  box: {
    durationMultiplier: 1,
    scaleMultiplier: 1,
    soundEffect: "click",
    confettiConfig: {
      particleCount: 50,
      spread: 70,
      startVelocity: 30,
      decay: 0.9,
      scalar: 1,
    },
  },
  "neo-brutalist": {
    durationMultiplier: 0.8,
    scaleMultiplier: 1.2,
    soundEffect: "punch",
    confettiConfig: {
      particleCount: 40,
      spread: 50,
      startVelocity: 45,
      decay: 0.85,
      scalar: 1.4,
      shapes: ["square"],
    },
    animationClass: "brutalist-juice",
  },
  neomorphism: {
    durationMultiplier: 1.3,
    scaleMultiplier: 0.8,
    soundEffect: "soft",
    confettiConfig: {
      particleCount: 60,
      spread: 90,
      startVelocity: 25,
      decay: 0.92,
      scalar: 0.9,
      shapes: ["circle"],
    },
    animationClass: "neomorph-juice",
  },
  glassmorphism: {
    durationMultiplier: 1.1,
    scaleMultiplier: 0.9,
    soundEffect: "crystal",
    confettiConfig: {
      particleCount: 70,
      spread: 100,
      startVelocity: 35,
      decay: 0.94,
      scalar: 0.8,
      shapes: ["circle"],
    },
    animationClass: "glass-juice",
  },
};

/**
 * Get theme adaptation based on style variant
 */
export function getThemeAdaptation(
  themeStyle: ThemeStyleVariant,
  element: HTMLElement | null = null
): ThemeAdaptation {
  const resolvedStyle = themeStyle === "auto" ? detectThemeStyle(element) : themeStyle;
  return THEME_ADAPTATIONS[resolvedStyle];
}

/**
 * Get colors from CSS variables for confetti
 */
export function getThemeColors(element: HTMLElement | null): string[] {
  if (!element) {
    return ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"];
  }

  const computedStyle = getComputedStyle(element);
  const colors: string[] = [];

  // Try to get primary, secondary, tertiary colors
  const colorVars = [
    "--color-primary",
    "--color-secondary",
    "--color-tertiary",
    "--primary",
    "--secondary",
    "--accent",
  ];

  for (const varName of colorVars) {
    const color = computedStyle.getPropertyValue(varName).trim();
    if (color) {
      // If it's an HSL value, convert it
      if (color.startsWith("hsl")) {
        colors.push(color);
      } else if (!color.includes("var(")) {
        colors.push(color);
      }
    }
  }

  // Fallback colors if we couldn't get any
  if (colors.length === 0) {
    return ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"];
  }

  return colors;
}
