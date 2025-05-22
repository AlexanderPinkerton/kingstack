import React from "react";

export function NeonCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl bg-black/80 border border-slate-800 shadow-2xl shadow-purple-500/20 backdrop-blur-lg p-6 ${className}`}
    >
      {children}
    </div>
  );
}
