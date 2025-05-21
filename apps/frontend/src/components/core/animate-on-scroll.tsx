"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimateOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
  rootMargin?: string;
}

export function AnimateOnScroll({
  children,
  className,
  delay = 0,
  threshold = 0.1,
  rootMargin = "0px 0px -100px 0px",
}: AnimateOnScrollProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              if (elementRef.current) {
                elementRef.current.classList.remove("opacity-0");
                elementRef.current.classList.remove("translate-y-8");
                elementRef.current.classList.add("opacity-100");
                elementRef.current.classList.add("translate-y-0");
              }
            }, delay);
          }
        });
      },
      { threshold, rootMargin },
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [delay, threshold, rootMargin]);

  return (
    <div
      ref={elementRef}
      className={cn(
        "opacity-0 translate-y-8 transition-all duration-700",
        className,
      )}
    >
      {children}
    </div>
  );
}
