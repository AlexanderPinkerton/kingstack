import { useState, useEffect, useCallback } from "react";
import { getPerformanceStats, clearStoreManagerCache } from "@/lib/optimistic-store-pattern";

export interface PerformanceStats {
  queryClient: {
    isGlobal: boolean;
    cacheSize: number;
  };
  storeManagers: {
    count: number;
    keys: string[];
  };
}

export function usePerformanceStats(updateInterval: number = 2000) {
  const [stats, setStats] = useState<PerformanceStats>(getPerformanceStats());
  const [isMonitoring, setIsMonitoring] = useState(false);

  const refreshStats = useCallback(() => {
    setStats(getPerformanceStats());
  }, []);

  const clearCache = useCallback(() => {
    clearStoreManagerCache();
    refreshStats();
  }, [refreshStats]);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(refreshStats, updateInterval);
    return () => clearInterval(interval);
  }, [isMonitoring, updateInterval, refreshStats]);

  return {
    stats,
    refreshStats,
    clearCache,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
  };
}
