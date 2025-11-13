/**
 * Generic singleton manager for managing singleton instances
 * Provides instance tracking, disposal, and lifecycle management
 */
export class SingletonManager<T extends { dispose?: () => void }> {
  private static instances = new Map<string, any>();
  private static instanceCounts = new Map<string, number>();

  /**
   * Register a new instance, disposing any existing instance if present
   */
  static register<T extends { dispose?: () => void }>(
    key: string,
    instance: T,
    options?: {
      autoDisposePrevious?: boolean;
      isDevelopment?: boolean;
    },
  ): T {
    const { autoDisposePrevious = true, isDevelopment = false } = options || {};

    // Track instance creation
    const count = (this.instanceCounts.get(key) || 0) + 1;
    this.instanceCounts.set(key, count);

    // Check for existing instance
    const existing = this.instances.get(key);
    if (existing && autoDisposePrevious) {
      const logLevel = isDevelopment ? "log" : "warn";
      const emoji = isDevelopment ? "🔄" : "⚠️";
      const reason = isDevelopment ? "HMR" : "memory leak";

      console[logLevel](
        `${emoji} SingletonManager [${key}]: Multiple instances detected (${reason})`,
        "Auto-disposing previous instance...",
      );

      if (existing.dispose) {
        existing.dispose();
      }
    }

    // Store new instance
    this.instances.set(key, instance);
    return instance;
  }

  /**
   * Get the current instance for a key
   */
  static getInstance<T>(key: string): T | null {
    return (this.instances.get(key) as T) || null;
  }

  /**
   * Check if there's an active instance for a key
   */
  static hasInstance(key: string): boolean {
    const instance = this.instances.get(key);
    return instance !== undefined && instance !== null;
  }

  /**
   * Unregister an instance (typically called during disposal)
   */
  static unregister(key: string, instance: any): void {
    const current = this.instances.get(key);
    if (current === instance) {
      this.instances.delete(key);
    }
  }

  /**
   * Get the instance count for debugging
   */
  static getInstanceCount(key: string): number {
    return this.instanceCounts.get(key) || 0;
  }
}
