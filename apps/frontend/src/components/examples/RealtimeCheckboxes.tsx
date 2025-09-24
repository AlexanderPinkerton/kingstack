"use client";

import React from "react";
import { observer } from "mobx-react-lite";
import { useRealtimeCheckboxes } from "@/hooks/useRealtimeCheckboxes";
import { useRootStore } from "@/hooks/useRootStore";

export const RealtimeCheckboxes = observer(() => {
  const rootStore = useRootStore();
  const {
    checkboxes,
    count,
    handleCheckboxChange,
    getCheckbox,
    isLoading,
    isError,
    error,
    isSyncing,
    updatePending,
  } = useRealtimeCheckboxes();


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading checkboxes...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-red-500">Error loading checkboxes: {error?.message}</div>
      </div>
    );
  }

  // If no checkboxes exist, show a message to initialize them
  if (count === 0) {
    return (
      <div className="p-8 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 shadow-2xl">
        <h2 className="text-3xl font-bold mb-4 text-white">
          Realtime Checkboxes
        </h2>
        <p className="text-slate-300 mb-8 text-lg">
          No checkboxes found. Please initialize the database first.
        </p>
        <button
          onClick={async () => {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
              const response = await fetch(`${baseUrl}/checkboxes/initialize`, {
                method: "POST",
              });
              if (response.ok) {
                window.location.reload(); // Simple refresh to reload data
              }
            } catch (error) {
              console.error("Failed to initialize checkboxes:", error);
            }
          }}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          Initialize 200 Checkboxes
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 shadow-2xl">
      <h2 className="text-3xl font-bold mb-4 text-white">
        Realtime Checkboxes ({count} total)
      </h2>
      <p className="text-slate-300 mb-8 text-lg">
        Click any checkbox to toggle it. Changes are synced in real-time across all users!
      </p>
      
      <div className="grid grid-cols-20 gap-1 p-4 bg-slate-900/30 rounded-lg border border-slate-600">
        {Array.from({ length: 200 }, (_, i) => {
          const checkbox = getCheckbox(i);
          const isChecked = checkbox?.checked || false;
          const isPending = updatePending;
          
          return (
            <label
              key={i}
              className={`
                group relative flex items-center justify-center w-6 h-6 border-2 rounded cursor-pointer transition-all duration-200 transform hover:scale-110
                ${isChecked 
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/25' 
                  : 'bg-slate-700/50 border-slate-500 text-slate-300 hover:bg-slate-600/50 hover:border-slate-400 hover:shadow-md'
                }
                ${isPending ? 'opacity-50 scale-95' : ''}
              `}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => handleCheckboxChange(i, e.target.checked)}
                className="sr-only"
                disabled={isPending}
              />
              {isChecked && (
                <svg 
                  className="w-3 h-3 drop-shadow-sm" 
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
              <div className="absolute inset-0 rounded-lg bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </label>
          );
        })}
      </div>
      
      <div className="mt-6 flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4 text-slate-400">
          {isSyncing && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span>Syncing...</span>
            </div>
          )}
          {updatePending && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span>Updating...</span>
            </div>
          )}
        </div>
        
        {/* Debug info - styled to match */}
        <div className="text-xs text-slate-500 space-y-1">
          <div>Socket: {rootStore.socket?.connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
          <div>Loaded: {count} checkboxes</div>
        </div>
      </div>
    </div>
  );
});
