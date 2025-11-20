import type { JuiceLevel } from "../types";

/**
 * Custom easing functions for different emotional states
 */
export const easings = {
  // Standard ease-in-out for most interactions
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",

  // Elastic bounce for success/celebration
  elasticOut: "cubic-bezier(0.34, 1.56, 0.64, 1)",

  // Anticipation (slight pullback before action) for destructive
  anticipate: "cubic-bezier(0.68, -0.55, 0.27, 1.55)",

  // Quick snap for punchy neo-brutalist
  snap: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",

  // Smooth flow for neomorphism
  smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",

  // Light float for glassmorphism
  float: "cubic-bezier(0.16, 1, 0.3, 1)",

  // Ease out for general interactions
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
};

/**
 * Get easing function based on variant and theme
 */
export function getEasing(
  variant?: string,
  themeStyle?: string
): string {
  // Variant-specific easing
  if (variant === "success") return easings.elasticOut;
  if (variant === "destructive") return easings.anticipate;

  // Theme-specific easing
  if (themeStyle === "neo-brutalist") return easings.snap;
  if (themeStyle === "neomorphism") return easings.smooth;
  if (themeStyle === "glassmorphism") return easings.float;

  return easings.easeInOut;
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get scale values based on juice level
 */
export function getScaleValues(
  juiceLevel: JuiceLevel,
  scaleMultiplier: number = 1
): { hover: number; active: number } {
  const scales = {
    0: { hover: 1, active: 1 },
    1: { hover: 1.02, active: 0.98 },
    2: { hover: 1.05, active: 0.95 },
    3: { hover: 1.08, active: 0.92 },
  };

  const base = scales[juiceLevel];
  return {
    hover: 1 + (base.hover - 1) * scaleMultiplier,
    active: 1 + (base.active - 1) * scaleMultiplier,
  };
}

/**
 * Get animation duration based on juice level
 */
export function getAnimationDuration(
  juiceLevel: JuiceLevel,
  durationMultiplier: number = 1
): number {
  const durations = {
    0: 150,
    1: 150,
    2: 250,
    3: 350,
  };

  return durations[juiceLevel] * durationMultiplier;
}

/**
 * Apply shake animation to element
 */
export function shakeElement(element: HTMLElement, intensity: "mild" | "strong" = "mild") {
  const keyframes = intensity === "mild"
    ? [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" },
      ]
    : [
        { transform: "translateX(0) rotate(0deg)" },
        { transform: "translateX(-8px) rotate(-2deg)" },
        { transform: "translateX(8px) rotate(2deg)" },
        { transform: "translateX(-8px) rotate(-2deg)" },
        { transform: "translateX(8px) rotate(2deg)" },
        { transform: "translateX(-4px) rotate(-1deg)" },
        { transform: "translateX(4px) rotate(1deg)" },
        { transform: "translateX(0) rotate(0deg)" },
      ];

  const timing = {
    duration: intensity === "mild" ? 300 : 500,
    easing: "ease-in-out",
  };

  element.animate(keyframes, timing);
}

/**
 * Apply pulse animation to element
 */
export function pulseElement(element: HTMLElement, duration: number = 1000) {
  const keyframes = [
    { transform: "scale(1)", opacity: 1 },
    { transform: "scale(1.05)", opacity: 0.8 },
    { transform: "scale(1)", opacity: 1 },
  ];

  const timing = {
    duration,
    easing: "ease-in-out",
    iterations: 1,
  };

  element.animate(keyframes, timing);
}

/**
 * Apply color wave animation
 */
export function colorWave(
  element: HTMLElement,
  fromColor: string,
  toColor: string,
  duration: number = 600
) {
  const keyframes = [
    { backgroundColor: fromColor },
    { backgroundColor: toColor },
    { backgroundColor: fromColor },
  ];

  const timing = {
    duration,
    easing: "ease-in-out",
  };

  element.animate(keyframes, timing);
}

/**
 * Apply success pulse animation
 */
export function successPulse(element: HTMLElement) {
  const keyframes = [
    { transform: "scale(1)", filter: "brightness(1)" },
    { transform: "scale(1.1)", filter: "brightness(1.2)" },
    { transform: "scale(1.05)", filter: "brightness(1.1)" },
    { transform: "scale(1)", filter: "brightness(1)" },
  ];

  const timing = {
    duration: 600,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  element.animate(keyframes, timing);
}

/**
 * Get CSS custom properties for juice level
 */
export function getJuiceStyles(
  juiceLevel: JuiceLevel,
  themeAdaptation: { durationMultiplier: number; scaleMultiplier: number },
  variant?: string,
  themeStyle?: string
): React.CSSProperties {
  const scales = getScaleValues(juiceLevel, themeAdaptation.scaleMultiplier);
  const duration = getAnimationDuration(juiceLevel, themeAdaptation.durationMultiplier);
  const easing = getEasing(variant, themeStyle);

  return {
    ["--juice-scale-hover" as string]: scales.hover,
    ["--juice-scale-active" as string]: scales.active,
    ["--juice-duration" as string]: `${duration}ms`,
    ["--juice-easing" as string]: easing,
    transition: `transform ${duration}ms ${easing},
                 box-shadow ${duration}ms ease,
                 background-color ${duration}ms ease,
                 opacity ${duration}ms ease,
                 width 300ms ease-out`,
  };
}

/**
 * FLIP (First, Last, Invert, Play) animation utility
 * Used for smooth state transitions
 */
export interface FLIPState {
  first: DOMRect;
  last: DOMRect;
  element: HTMLElement;
}

/**
 * Capture the First position
 */
export function captureFirst(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect();
}

/**
 * Calculate and apply the Invert transform
 */
export function calculateInvert(first: DOMRect, last: DOMRect) {
  return {
    x: first.left - last.left,
    y: first.top - last.top,
    scaleX: first.width / last.width,
    scaleY: first.height / last.height,
  };
}

/**
 * Play the FLIP animation
 */
export function playFLIP(
  element: HTMLElement,
  first: DOMRect,
  duration: number = 300,
  easing: string = easings.easeOut
) {
  const last = element.getBoundingClientRect();
  const invert = calculateInvert(first, last);

  // Apply the inverted transform
  element.style.transform = `
    translate(${invert.x}px, ${invert.y}px)
    scale(${invert.scaleX}, ${invert.scaleY})
  `;
  element.style.transition = "none";

  // Force reflow
  element.offsetHeight;

  // Remove transform and let it animate to natural position
  element.style.transition = `transform ${duration}ms ${easing}`;
  element.style.transform = "";
}

/**
 * FLIP animation for icon morphing (e.g., loader -> checkmark)
 */
export function morphIcon(
  fromElement: HTMLElement,
  toElement: HTMLElement,
  duration: number = 400
) {
  const first = fromElement.getBoundingClientRect();

  // Hide from element
  fromElement.style.opacity = "0";

  // Show to element at from's position
  toElement.style.opacity = "0";
  const last = toElement.getBoundingClientRect();

  const invert = calculateInvert(first, last);

  // Start at inverted position
  toElement.style.transform = `
    translate(${invert.x}px, ${invert.y}px)
    scale(${invert.scaleX}, ${invert.scaleY})
  `;
  toElement.style.opacity = "1";

  // Force reflow
  toElement.offsetHeight;

  // Animate to natural position
  toElement.style.transition = `transform ${duration}ms ${easings.elasticOut}, opacity ${duration}ms ease`;
  toElement.style.transform = "";
}

/**
 * Stagger animation for multiple elements
 */
export function staggerAnimation(
  elements: HTMLElement[],
  duration: number = 300,
  staggerDelay: number = 50,
  easing: string = easings.easeOut
) {
  elements.forEach((element, index) => {
    setTimeout(() => {
      element.style.transition = `all ${duration}ms ${easing}`;
      element.style.opacity = "1";
      element.style.transform = "translateY(0)";
    }, index * staggerDelay);
  });
}
