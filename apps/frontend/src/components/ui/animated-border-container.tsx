import React from "react";

export function AnimatedBorderContainer({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative ${className}`}>
      {/* Glowing animated border */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-400 via-purple-600 to-pink-500 opacity-60 blur-xl animate-pulse z-0" />
      <div className="relative z-10 rounded-3xl bg-black/80 border border-slate-800 shadow-2xl shadow-purple-500/20 backdrop-blur-lg">
        {children}
      </div>
    </div>
  );
}
