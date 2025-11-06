"use client";

import React, { useContext, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { RootStoreContext } from "@/context/rootStoreContext";
import { isPlaygroundMode } from "@kingstack/shapes";

// ---------- Realtime Checkboxes Component ----------

export const RealtimeCheckboxes = observer(() => {
  const rootStore = useContext(RootStoreContext);
  const { checkboxStore } = rootStore;
  const [isClient, setIsClient] = useState(false);

  // Prevent hydration mismatch by only rendering after client mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show loading state during hydration
  if (!isClient || checkboxStore.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading checkboxes...</div>
      </div>
    );
  }

  if (checkboxStore.isError) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-red-500">
          Error loading checkboxes: {checkboxStore.error?.message}
        </div>
      </div>
    );
  }

  // If no checkboxes exist, show a message to initialize them
  if (checkboxStore.count === 0) {
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
              await checkboxStore.initializeCheckboxes();
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
    <div className="p-8 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-600 shadow-2xl">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div
          className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-4 ${
            isClient && isPlaygroundMode()
              ? "bg-yellow-500/20 border border-yellow-500/30 text-yellow-400"
              : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full animate-pulse mr-2 ${
              isClient && isPlaygroundMode()
                ? "bg-yellow-400"
                : "bg-emerald-400"
            }`}
          />
          {isClient && isPlaygroundMode() ? "Mock Demo" : "Live Demo"}
        </div>
        <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
          Realtime Optimistic Updates
        </h2>
        {isClient && isPlaygroundMode() && (
          <p className="text-yellow-200 text-sm mb-4">
            Playground mode is active. Enable Supabase for a full experience.
          </p>
        )}
        <p className="text-slate-300 text-lg max-w-2xl mx-auto leading-relaxed">
          Experience instant UI updates with automatic rollback on errors.
          Changes sync across all users in real-time with zero configuration.
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="flex items-center space-x-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold">Instant Updates</div>
            <div className="text-slate-400 text-sm">
              UI responds immediately
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold">Auto Rollback</div>
            <div className="text-slate-400 text-sm">
              Failed operations revert
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold">Multi-User Sync</div>
            <div className="text-slate-400 text-sm">
              Real-time collaboration
            </div>
          </div>
        </div>
      </div>

      {/* Demo Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Interactive Demo</h3>
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                isClient && isPlaygroundMode()
                  ? "bg-yellow-400"
                  : "bg-emerald-400"
              }`}
            />
            <span>{isClient && isPlaygroundMode() ? "Mock" : "Live"}</span>
            {(checkboxStore.updatePending ||
              checkboxStore.createPending ||
              checkboxStore.deletePending) && (
              <span className="text-blue-400">• Syncing...</span>
            )}
          </div>
        </div>
        <p className="text-slate-400 mb-4">
          Click any checkbox below to see optimistic updates in action. Open
          this page in multiple tabs to experience real-time synchronization.
        </p>

        <div className="grid grid-cols-10 sm:grid-cols-20 gap-2 p-4 bg-slate-900/30 rounded-lg border border-slate-600">
          {Array.from({ length: 200 }, (_, i) => {
            const isChecked = checkboxStore.isCheckboxChecked(i);

            return (
              <label
                key={i}
                className={`
                  group relative flex items-center justify-center w-6 h-6 border-2 rounded cursor-pointer transition-all duration-200 transform hover:scale-110
                  ${
                    isChecked
                      ? "bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/25"
                      : "bg-slate-700/50 border-slate-500 text-slate-300 hover:bg-slate-600/50 hover:border-slate-400 hover:shadow-md"
                  }
                `}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => checkboxStore.toggleCheckbox(i)}
                  className="sr-only"
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
      </div>

      {/* Call to Action */}
      <div className="mt-8 p-6 bg-gradient-to-r from-slate-700/30 to-slate-800/30 rounded-xl border border-slate-600">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white mb-2">
            Ready to Build Something Amazing?
          </h3>
          <p className="text-slate-300 mb-4">
            This demo showcases our optimistic store pattern with real-time
            synchronization. Perfect for collaborative apps, real-time
            dashboards, and interactive experiences.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2 text-sm text-slate-400">
              {rootStore.socket?.connected ? (
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              ) : (
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              )}
              <span>
                Socket:{" "}
                {rootStore.socket?.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="text-sm text-slate-500">
              • {checkboxStore.count} items loaded
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
