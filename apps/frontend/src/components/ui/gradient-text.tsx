import React from "react";

export function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600 ${className}`}>
      {children}
    </span>
  );
}
