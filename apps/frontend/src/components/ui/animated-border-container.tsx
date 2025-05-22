import React from "react";

export function AnimatedBorderContainer({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative ${className}`}>
      {/* Glowing animated border */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[var(--gradient-from)] via-[var(--accent-mix)] to-[var(--gradient-to)] opacity-60 blur-xl animate-pulse z-0" />
      <div className="relative z-10 rounded-3xl bg-black/80 border border-slate-800  shadow-2xl shadow-[var(--accent-mix)] backdrop-blur-lg">
        {children}
      </div>
    </div>
  );
}