"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2, Check } from "lucide-react";
import { Button } from "../button";
import { cn } from "@/lib/utils";
import { useJuice } from "./juice-context";
import { getThemeAdaptation, getThemeColors } from "./theme-adapters";
import { getJuiceConfig } from "./juice-variants";
import { useJuiceAudio } from "./interactions/audio";
import {
  fireSuccessConfetti,
  fireWarningParticles,
  fireLoadingParticles,
  fireConfetti,
} from "./interactions/confetti";
import { useRipple, RippleEffect } from "./interactions/ripple";
import {
  prefersReducedMotion,
  getJuiceStyles,
  shakeElement,
  successPulse,
  captureFirst,
  playFLIP,
  morphIcon,
} from "./interactions/animations";
import type { JuiceButtonProps } from "./types";

export function JuiceButton({
  className,
  variant = "default",
  size,
  juice = 0,
  themeStyle = "auto",
  isLoading = false,
  loadingProgress,
  audioEnabled = true,
  confettiEnabled = true,
  forceAudio = false,
  forceAnimations = false,
  holdDuration = 2000,
  onHoldComplete,
  asChild = false,
  onClick,
  children,
  ...props
}: JuiceButtonProps) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const loadingIconRef = React.useRef<SVGSVGElement>(null);
  const successIconRef = React.useRef<SVGSVGElement>(null);
  const holdTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const loadingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const previousWidthRef = React.useRef<number | null>(null);
  const [isHolding, setIsHolding] = React.useState(false);
  const [holdProgress, setHoldProgress] = React.useState(0);
  const [wasLoading, setWasLoading] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [explicitWidth, setExplicitWidth] = React.useState<number | null>(null);

  const { globalMute, volume } = useJuice();
  const { playSound, stopSound } = useJuiceAudio();
  const { ripples, addRipple } = useRipple(400);

  // Get juice configuration
  const juiceConfig = getJuiceConfig(juice);

  // Detect theme and get adaptations
  const themeAdaptation = React.useMemo(() => {
    return getThemeAdaptation(themeStyle, buttonRef.current);
  }, [themeStyle]);

  // Get theme colors for confetti
  const themeColors = React.useMemo(() => {
    return getThemeColors(buttonRef.current);
  }, []);

  // Check if we should apply animations/audio
  const reducedMotion = !forceAnimations && prefersReducedMotion();
  const audioAllowed = audioEnabled && (forceAudio || !globalMute);
  const animationsAllowed = !reducedMotion;

  // Smooth width transition using explicit width measurement
  React.useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    // Measure current width before any state changes
    const currentWidth = button.offsetWidth;

    // If this is a state transition, animate the width change
    if (previousWidthRef.current !== null && previousWidthRef.current !== currentWidth) {
      // Set explicit width to previous width (prevents instant jump)
      setExplicitWidth(previousWidthRef.current);

      // Force reflow
      button.offsetWidth;

      // Animate to new width
      requestAnimationFrame(() => {
        setExplicitWidth(currentWidth);

        // Clear explicit width after transition completes
        setTimeout(() => {
          setExplicitWidth(null);
        }, 300); // Match transition duration
      });
    }

    // Always update previous width for next comparison
    previousWidthRef.current = currentWidth;
  }, [isLoading, showSuccess, children]);

  // FLIP animation when transitioning from loading to complete
  React.useEffect(() => {
    if (wasLoading && !isLoading && juice >= 2 && animationsAllowed) {
      // Show success state briefly at juice level 3
      if (juice === 3 && variant !== "destructive") {
        setShowSuccess(true);
        if (buttonRef.current) {
          successPulse(buttonRef.current);
        }
        setTimeout(() => setShowSuccess(false), 2000);
      }
    }

    setWasLoading(isLoading);
  }, [isLoading, wasLoading, juice, animationsAllowed, variant]);

  // Handle loading particle effects for juice level 3
  React.useEffect(() => {
    if (isLoading && juice === 3 && animationsAllowed && buttonRef.current) {
      loadingIntervalRef.current = setInterval(() => {
        if (buttonRef.current) {
          fireLoadingParticles(buttonRef.current, themeAdaptation, themeColors);
        }
      }, 500);

      // Play loading sound if enabled
      if (audioAllowed && juiceConfig.enableSound) {
        playSound("loading", volume * 0.5);
      }

      return () => {
        if (loadingIntervalRef.current) {
          clearInterval(loadingIntervalRef.current);
        }
        stopSound("loading");
      };
    }
  }, [isLoading, juice, animationsAllowed, audioAllowed]);

  // Handle hold-to-confirm for destructive buttons
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (variant === "destructive" && juice >= 2 && onHoldComplete) {
      setIsHolding(true);
      setHoldProgress(0);

      const startTime = Date.now();
      holdTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / holdDuration) * 100, 100);
        setHoldProgress(progress);

        if (progress >= 100) {
          if (holdTimerRef.current) {
            clearInterval(holdTimerRef.current);
          }
          setIsHolding(false);
          onHoldComplete();

          // Fire warning particles
          if (buttonRef.current && animationsAllowed && confettiEnabled) {
            fireWarningParticles(buttonRef.current, themeAdaptation);
          }
        }
      }, 16);

      // Play warning sound
      if (audioAllowed && juiceConfig.enableSound) {
        playSound("error", volume * 0.6);
      }

      // Shake animation
      if (buttonRef.current && animationsAllowed && juice >= 3) {
        shakeElement(buttonRef.current, "strong");
      }
    }

    props.onMouseDown?.(e);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      setIsHolding(false);
      setHoldProgress(0);
    }

    props.onMouseUp?.(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isLoading) return;

    // Add ripple effect
    if (juiceConfig.enableRipple && animationsAllowed) {
      addRipple(e);
    }

    // Play sound
    if (audioAllowed && juiceConfig.enableSound && juice >= 2) {
      const soundKey = variant === "success" ? "success" : themeAdaptation.soundEffect;
      playSound(soundKey, volume);
    }

    // Fire confetti for success variant at juice level 3
    if (
      variant === "success" &&
      juiceConfig.enableConfetti &&
      confettiEnabled &&
      animationsAllowed &&
      buttonRef.current
    ) {
      fireSuccessConfetti(buttonRef.current, themeAdaptation, themeColors);
      if (juice === 3) {
        successPulse(buttonRef.current);
      }
    }

    // Fire confetti for any button at juice level 3 (if enabled)
    if (
      variant !== "success" &&
      juice === 3 &&
      juiceConfig.enableConfetti &&
      confettiEnabled &&
      animationsAllowed &&
      buttonRef.current
    ) {
      fireConfetti(buttonRef.current, themeAdaptation, themeColors);
    }

    // Don't call onClick if we're in hold mode
    if (!(variant === "destructive" && juice >= 2 && onHoldComplete)) {
      onClick?.(e);
    }
  };

  // Compute styles with variant and theme-specific easing
  const juiceStyles = animationsAllowed
    ? getJuiceStyles(juice, themeAdaptation, variant as string, themeStyle)
    : {};

  const Comp = asChild ? Slot : "button";

  // Map juice button variants to base button variants
  const mappedVariant = variant === "success" || variant === "loading" ? "default" : variant;

  return (
    <Button
      ref={buttonRef}
      className={cn(
        "relative overflow-hidden transition-[width] duration-300 ease-out",
        themeAdaptation.animationClass,
        juice > 0 && animationsAllowed && "hover:scale-[var(--juice-scale-hover,1.02)]",
        juice > 0 && animationsAllowed && "active:scale-[var(--juice-scale-active,0.98)]",
        isHolding && "cursor-wait",
        className
      )}
      variant={mappedVariant}
      size={size}
      style={{
        ...juiceStyles,
        width: explicitWidth !== null ? `${explicitWidth}px` : undefined,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      disabled={props.disabled || isLoading}
      asChild={false}
      {...props}
    >
      {/* Ripple effects */}
      {juiceConfig.enableRipple && animationsAllowed && (
        <RippleEffect
          ripples={ripples}
          duration={juiceConfig.duration}
          color={variant === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 255, 255, 0.3)"}
        />
      )}

      {/* Hold progress indicator for destructive buttons */}
      {isHolding && variant === "destructive" && juice >= 2 && (
        <span
          className="absolute bottom-0 left-0 h-1 bg-destructive-foreground/50 transition-all"
          style={{ width: `${holdProgress}%` }}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <>
          <Loader2 ref={loadingIconRef} className="size-4 animate-spin" />
          {juice === 3 && loadingProgress !== undefined && (
            <span className="text-xs">{Math.round(loadingProgress)}%</span>
          )}
        </>
      )}

      {/* Success state (shown briefly after loading completes at juice 3) */}
      {showSuccess && !isLoading && (
        <>
          <Check ref={successIconRef} className="size-4" />
          Done!
        </>
      )}

      {/* Button content - preserves original flex layout */}
      {!isLoading && !showSuccess && (
        <>{children}</>
      )}
    </Button>
  );
}

export { JuiceProvider, useJuice } from "./juice-context";
export type { JuiceButtonProps, JuiceLevel } from "./types";
