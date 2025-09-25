"use client";

import { useState, useEffect } from "react";
import { getPerformanceStats, clearStoreManagerCache } from "@/lib/optimistic-store-pattern";

export const PerformanceDashboard = () => {
  const [stats, setStats] = useState(getPerformanceStats());
  const [isVisible, setIsVisible] = useState(false);

  // Update stats every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getPerformanceStats());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    clearStoreManagerCache();
    setStats(getPerformanceStats());
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      >
        📊 Performance
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 max-w-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Performance Stats</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3 text-sm">
        {/* Query Client Stats */}
        <div className="bg-gray-50 p-2 rounded">
          <h4 className="font-medium text-gray-700">Query Client</h4>
          <div className="text-xs text-gray-600">
            <div>Global: {stats.queryClient.isGlobal ? "✅" : "❌"}</div>
            <div>Cache Size: {stats.queryClient.cacheSize} queries</div>
          </div>
        </div>

        {/* Store Managers Stats */}
        <div className="bg-gray-50 p-2 rounded">
          <h4 className="font-medium text-gray-700">Store Managers</h4>
          <div className="text-xs text-gray-600">
            <div>Count: {stats.storeManagers.count}</div>
            <div className="mt-1">
              <div className="font-medium">Active Stores:</div>
              {stats.storeManagers.keys.map((key) => (
                <div key={key} className="ml-2 text-green-600">
                  • {key}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleClearCache}
            className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
          >
            Clear Cache
          </button>
          <button
            onClick={() => setStats(getPerformanceStats())}
            className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};
