"use client";

import React, { useRef, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";

interface VirtualizedCheckboxProps {
  index: number;
  checked: boolean;
  onChange: (index: number, checked: boolean) => void;
  style?: React.CSSProperties;
}

export const VirtualizedCheckbox = observer(({ 
  index, 
  checked, 
  onChange, 
  style 
}: VirtualizedCheckboxProps) => {
  return (
    <label
      style={style}
      className={`
        group relative flex items-center justify-center w-6 h-6 border-2 rounded cursor-pointer transition-all duration-200 transform hover:scale-110
        ${checked 
          ? 'bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/25' 
          : 'bg-slate-700/50 border-slate-500 text-slate-300 hover:bg-slate-600/50 hover:border-slate-400 hover:shadow-md'
        }
      `}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(index, e.target.checked)}
        className="sr-only"
      />
      {checked && (
        <svg 
          className="w-2.5 h-2.5 drop-shadow-sm" 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path 
            fillRule="evenodd" 
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
            clipRule="evenodd" 
          />
        </svg>
      )}
      
      {/* Hover effect */}
      <div className="absolute inset-0 rounded bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    </label>
  );
});
