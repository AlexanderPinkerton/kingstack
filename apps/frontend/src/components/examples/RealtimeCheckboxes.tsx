"use client";

import React from "react";
import { observer } from "mobx-react-lite";
import { useRealtimeCheckboxes } from "@/hooks/useRealtimeCheckboxes";

export const RealtimeCheckboxes = observer(() => {
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
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          Realtime Checkboxes
        </h2>
        <p className="text-gray-600 mb-6">
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
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Initialize 200 Checkboxes
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Realtime Checkboxes ({count} total)
      </h2>
      <p className="text-gray-600 mb-6">
        Click any checkbox to toggle it. Changes are synced in real-time across all users!
      </p>
      
      <div className="grid grid-cols-20 gap-1 max-h-96 overflow-y-auto">
        {Array.from({ length: 200 }, (_, i) => {
          const checkbox = getCheckbox(i);
          const isChecked = checkbox?.checked || false;
          const isPending = updatePending;
          
          
          
          return (
            <label
              key={i}
              className={`
                flex items-center justify-center w-8 h-8 border-2 rounded cursor-pointer transition-all
                ${isChecked 
                  ? 'bg-green-500 border-green-600 text-white' 
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }
                ${isPending ? 'opacity-50' : ''}
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
                  className="w-4 h-4" 
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
            </label>
          );
        })}
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        {isSyncing && "Syncing..."}
        {updatePending && "Updating..."}
      </div>
      
      {/* Debug info */}
      <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
        <div>Socket connected: {typeof window !== 'undefined' && (window as any).io ? 'Yes' : 'No'}</div>
        <div>Checkboxes loaded: {count}</div>
      </div>
    </div>
  );
});
