/**
 * Test utilities for performance and memory testing
 * Provides environment-aware thresholds and helper functions
 */

/**
 * Detects if running in a CI environment
 */
export const isCI = (): boolean => {
  return process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.CIRCLECI === 'true' ||
    process.env.TRAVIS === 'true' ||
    process.env.JENKINS_URL !== undefined;
};

/**
 * Gets performance thresholds based on environment
 * CI environments get more lenient thresholds due to resource constraints
 */
export const getPerformanceThresholds = () => {
  const ci = isCI();
  return {
    // Performance thresholds (in milliseconds)
    largeDataset: ci ? 500 : 100,     // 500ms for CI, 100ms for local
    rapidUpdates: ci ? 300 : 50,      // 200ms for CI, 50ms for local
    smallOperations: ci ? 100 : 25,   // 100ms for CI, 25ms for local

    // Memory thresholds (in bytes)
    memoryLeak: ci ? 5 * 1024 * 1024 : 2 * 1024 * 1024,        // 5MB for CI, 2MB for local
    largeDatasetMemory: ci ? 200 * 1024 * 1024 : 100 * 1024 * 1024, // 200MB for CI, 100MB for local
  };
};

/**
 * Measures performance of a function with environment-aware thresholds
 */
export const measurePerformance = async <T>(
  fn: () => T | Promise<T>,
  threshold: number,
  description: string
): Promise<{ result: T; duration: number; passed: boolean }> => {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  const duration = endTime - startTime;
  const passed = duration < threshold;

  if (!passed) {
    console.warn(`Performance test "${description}" took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
  }

  return { result, duration, passed };
};

/**
 * Forces garbage collection if available
 */
export const forceGC = (): void => {
  if (global.gc) {
    global.gc();
  }
};

/**
 * Measures memory usage before and after an operation
 */
export const measureMemoryUsage = (fn: () => void | Promise<void>) => {
  const initialMemory = process.memoryUsage().heapUsed;
  const result = fn();

  // If it's a promise, wait for it to complete
  if (result instanceof Promise) {
    return result.then(() => {
      forceGC();
      const finalMemory = process.memoryUsage().heapUsed;
      return {
        initial: initialMemory,
        final: finalMemory,
        increase: finalMemory - initialMemory,
      };
    });
  }

  forceGC();
  const finalMemory = process.memoryUsage().heapUsed;
  return {
    initial: initialMemory,
    final: finalMemory,
    increase: finalMemory - initialMemory,
  };
};
