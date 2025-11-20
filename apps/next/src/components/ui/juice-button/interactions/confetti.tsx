"use client";

import confetti from "canvas-confetti";
import type { ThemeAdaptation } from "../types";

/**
 * Fire confetti from a button element
 */
export function fireConfetti(
  element: HTMLElement,
  themeAdaptation: ThemeAdaptation,
  colors: string[]
) {
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  const config = themeAdaptation.confettiConfig;

  confetti({
    particleCount: config.particleCount,
    spread: config.spread,
    startVelocity: config.startVelocity,
    decay: config.decay,
    scalar: config.scalar,
    origin: { x, y },
    colors: colors,
    shapes: config.shapes,
    gravity: 1,
    ticks: 200,
  });
}

/**
 * Fire confetti for success actions
 */
export function fireSuccessConfetti(
  element: HTMLElement,
  themeAdaptation: ThemeAdaptation,
  colors: string[]
) {
  // Fire multiple bursts for more celebration
  fireConfetti(element, themeAdaptation, colors);

  setTimeout(() => {
    fireConfetti(element, themeAdaptation, colors);
  }, 150);
}

/**
 * Fire particle effect for destructive/error actions
 */
export function fireWarningParticles(
  element: HTMLElement,
  themeAdaptation: ThemeAdaptation
) {
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  // Red/orange particles with downward bias
  confetti({
    particleCount: 20,
    spread: 40,
    startVelocity: 20,
    decay: 0.9,
    scalar: 0.8,
    origin: { x, y },
    colors: ["#ef4444", "#f97316", "#fbbf24"],
    shapes: ["circle"],
    gravity: 1.5,
    ticks: 100,
  });
}

/**
 * Fire continuous particle effect for loading states (juice level 3)
 */
export function fireLoadingParticles(
  element: HTMLElement,
  themeAdaptation: ThemeAdaptation,
  colors: string[]
) {
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  // Gentle ambient particles
  confetti({
    particleCount: 3,
    spread: 360,
    startVelocity: 15,
    decay: 0.95,
    scalar: 0.6,
    origin: { x, y },
    colors: colors,
    shapes: ["circle"],
    gravity: 0.3,
    ticks: 150,
    drift: 0.5,
  });
}

/**
 * Create a confetti cannon effect for dramatic actions
 */
export function fireConfettiCannon(
  element: HTMLElement,
  themeAdaptation: ThemeAdaptation,
  colors: string[]
) {
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  const config = themeAdaptation.confettiConfig;

  // Fire to the left
  confetti({
    ...config,
    origin: { x, y },
    angle: 60,
    colors: colors,
  });

  // Fire to the right
  confetti({
    ...config,
    origin: { x, y },
    angle: 120,
    colors: colors,
  });

  // Fire upward
  setTimeout(() => {
    confetti({
      ...config,
      origin: { x, y },
      angle: 90,
      spread: config.spread * 1.5,
      colors: colors,
    });
  }, 100);
}
