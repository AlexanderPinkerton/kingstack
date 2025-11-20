import type { VariantProps } from "class-variance-authority";
import type { buttonVariants } from "../button";

export type JuiceLevel = 0 | 1 | 2 | 3;

export type ThemeStyleVariant = "box" | "neo-brutalist" | "neomorphism" | "glassmorphism" | "auto";

export type JuiceButtonVariant = "success" | "loading";

export interface JuiceButtonProps
  extends React.ComponentProps<"button">,
    Omit<VariantProps<typeof buttonVariants>, "variant"> {
  /**
   * Juice level: 0 = none, 1 = subtle, 2 = enhanced, 3 = maximum
   * @default 0
   */
  juice?: JuiceLevel;

  /**
   * Button variant - supports all base shadcn variants plus custom juice variants
   */
  variant?: VariantProps<typeof buttonVariants>["variant"] | JuiceButtonVariant;

  /**
   * Theme style - auto-detects from DOM or can be explicitly set
   * @default "auto"
   */
  themeStyle?: ThemeStyleVariant;

  /**
   * Loading state for async operations
   */
  isLoading?: boolean;

  /**
   * Loading progress (0-100) - shown at juice level 3
   */
  loadingProgress?: number;

  /**
   * Enable/disable audio effects
   * @default true
   */
  audioEnabled?: boolean;

  /**
   * Enable/disable confetti effects
   * @default true
   */
  confettiEnabled?: boolean;

  /**
   * Force audio even if globally muted
   */
  forceAudio?: boolean;

  /**
   * Force animations even if prefers-reduced-motion is set
   */
  forceAnimations?: boolean;

  /**
   * Duration in ms for hold-to-confirm (destructive buttons)
   */
  holdDuration?: number;

  /**
   * Callback when hold is complete
   */
  onHoldComplete?: () => void;

  /**
   * Use Slot for composition
   */
  asChild?: boolean;
}

export interface JuiceContextValue {
  /**
   * Global audio mute state
   */
  globalMute: boolean;

  /**
   * Toggle global mute
   */
  toggleMute: () => void;

  /**
   * Set global mute state
   */
  setGlobalMute: (muted: boolean) => void;

  /**
   * Master volume (0-1)
   */
  volume: number;

  /**
   * Set master volume
   */
  setVolume: (volume: number) => void;
}

export interface ThemeAdaptation {
  /**
   * Animation duration multiplier
   */
  durationMultiplier: number;

  /**
   * Scale intensity multiplier
   */
  scaleMultiplier: number;

  /**
   * Sound effect key
   */
  soundEffect: string;

  /**
   * Confetti configuration
   */
  confettiConfig: {
    particleCount: number;
    spread: number;
    startVelocity: number;
    decay: number;
    scalar: number;
    shapes?: ("circle" | "square")[];
  };

  /**
   * Animation CSS class
   */
  animationClass?: string;
}

export interface AudioConfig {
  src: string | string[];
  volume?: number;
  loop?: boolean;
  sprite?: Record<string, [number, number]>;
}

export interface JuiceLevelConfig {
  scale: {
    hover: number;
    active: number;
  };
  duration: number;
  enableRipple: boolean;
  enableSound: boolean;
  enableConfetti: boolean;
  enableHaptic: boolean;
}
