"use client";

import { useState, useEffect } from "react";
import { getGlobalQueryClient } from "@kingstack/advanced-optimistic-store";

interface PerformanceStats {
  queryClient: {
    isGlobal: boolean;
    cacheSize: number;
    queries: string[];
  };
}

function getPerformanceStats(): PerformanceStats {
  const queryClient = getGlobalQueryClient();
  const queryCache = queryClient.getQueryCache();
  const queries = queryCache.getAll();

  return {
    queryClient: {
      isGlobal: true,
      cacheSize: queries.length,
      queries: queries.map((q) => q.queryKey.join(", ")),
    },
  };
}

export const PerformanceDashboard = () => {
  const [stats, setStats] = useState<PerformanceStats>(getPerformanceStats());
  const [isVisible, setIsVisible] = useState(false);

  // Update stats every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getPerformanceStats());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    const queryClient = getGlobalQueryClient();
    queryClient.clear();
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
          <h4 className="font-medium text-gray-700">TanStack Query Cache</h4>
          <div className="text-xs text-gray-600">
            <div>Global Client: {stats.queryClient.isGlobal ? "✅" : "❌"}</div>
            <div>Cached Queries: {stats.queryClient.cacheSize}</div>
          </div>
        </div>

        {/* Active Queries */}
        {stats.queryClient.queries.length > 0 && (
          <div className="bg-gray-50 p-2 rounded">
            <h4 className="font-medium text-gray-700">Active Queries</h4>
            <div className="text-xs text-gray-600 max-h-32 overflow-y-auto">
              {stats.queryClient.queries.map((key, idx) => (
                <div key={idx} className="ml-2 text-green-600">
                  • {key}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 p-2 rounded border border-blue-200">
          <div className="text-xs text-blue-700">
            <div className="font-medium mb-1">💡 About Caching</div>
            <div>Store managers are recreated (~5ms)</div>
            <div>TanStack Query caches data (expensive)</div>
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
