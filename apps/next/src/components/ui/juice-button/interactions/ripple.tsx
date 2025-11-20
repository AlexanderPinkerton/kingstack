"use client";

import React, { useState, useEffect } from "react";

interface RippleProps {
  duration?: number;
  color?: string;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function useRipple(duration: number = 600) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const addRipple = (event: React.MouseEvent<HTMLElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple: Ripple = {
      id: Date.now(),
      x,
      y,
      size,
    };

    setRipples((prev) => [...prev, newRipple]);

    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, duration);
  };

  return { ripples, addRipple };
}

export function RippleEffect({ ripples, duration, color }: {
  ripples: Ripple[];
  duration: number;
  color?: string;
}) {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute animate-ripple rounded-full opacity-0"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color || "currentColor",
            animationDuration: `${duration}ms`,
          }}
        />
      ))}
    </span>
  );
}
