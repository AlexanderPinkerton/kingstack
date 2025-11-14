import { StoreManager } from "@/lib/store-manager";
import { AdminMgmtStore } from "./adminMgmtStore";
import type { SupabaseSession } from "@/lib/session-manager";
import type { AuthEnabledStore } from "@/lib/session-manager";
import type { RealtimeStore } from "@/lib/realtime-manager";

/**
 * Store configuration for lazy loading
 */
type StoreConfig<T> = {
  name: string;
  factory: () => T;
  requiresAuth?: boolean;
  supportsRealtime?: boolean;
};

/**
 * AdminStore manages all admin-facing stores
 * Stores are lazy-loaded ONLY when:
 * 1. A store getter is accessed (e.g., rootStore.adminStore.adminMgmtStore)
 * 2. Explicitly initialized via initializeWithSession() (e.g., from an admin page)
 *
 * Admin stores do NOT auto-initialize on session changes - they only load when needed
 * Note: This class doesn't need to be observable - the stores themselves are observable
 */
export class AdminStoreManager extends StoreManager {
  // Store registry - define all stores here
  private readonly storeConfigs: StoreConfig<any>[] = [
    {
      name: "adminMgmtStore",
      factory: () => new AdminMgmtStore(),
      requiresAuth: true,
      supportsRealtime: false,
    },
  ];

  // Store instances cache
  private readonly stores = new Map<string, any>();

  constructor() {
    super();
    // No need to make this observable - the stores themselves are observable
  }

  /**
   * Generic lazy store getter
   */
  private getStore<T>(name: string): T {
    if (this.isDisposed) {
      throw new Error(`AdminStoreManager has been disposed`);
    }

    // Return cached instance if exists
    if (this.stores.has(name)) {
      return this.stores.get(name);
    }

    // Find store config
    const config = this.storeConfigs.find((c) => c.name === name);
    if (!config) {
      throw new Error(`Store "${name}" not found in registry`);
    }

    // Create store instance
    try {
      const store = config.factory();
      this.stores.set(name, store);

      // Note: Admin stores require explicit initialization via initializeWithSession()
      // This ensures they only load when actually needed (e.g., on admin pages)
      // If accessed before initialization, the store will be created but not enabled
      if (!this.isInitialized) {
        console.warn(
          "⚠️ AdminStoreManager: Store accessed before initialization. " +
            "Call initializeWithSession() explicitly (e.g., from admin page component).",
        );
      }

      return store;
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
      throw error;
    }
  }

  // Type-safe getters for each store
  get adminMgmtStore(): AdminMgmtStore {
    return this.getStore<AdminMgmtStore>("adminMgmtStore");
  }

  /**
   * Override updateSession to prevent auto-initialization
   * Admin stores should only initialize when explicitly requested
   */
  updateSession(session: SupabaseSession | null): void {
    // Only update if already initialized
    // Do NOT auto-initialize - admin stores should only load when accessed
    if (!this.isInitialized) {
      // Silently return - admin stores are context-specific and load on demand
      return;
    }

    // Update stores with new session if already initialized
    const token = session?.access_token || "playground-token";
    const stores = this.getAuthStores();

    if (session?.access_token) {
      stores.forEach((store) => store.enable(token));
    } else {
      stores.forEach((store) => store.disable());
    }
  }

  /**
   * Initialize stores with session
   */
  initialize(session: SupabaseSession | null): void {
    if (this.isDisposed) {
      console.warn(
        "⚠️ AdminStoreManager: Attempted to initialize after disposal",
      );
      return;
    }

    if (this.isInitialized) {
      return;
    }

    console.log("👑 AdminStoreManager: Initializing admin stores");

    // Create all stores that haven't been created yet
    for (const config of this.storeConfigs) {
      if (!this.stores.has(config.name)) {
        try {
          const store = config.factory();
          this.stores.set(config.name, store);
        } catch (error) {
          console.error(`Failed to create ${config.name}:`, error);
        }
      }
    }

    // Mark as initialized BEFORE enabling stores to prevent recursion
    this.isInitialized = true;

    // Register with realtime if available
    if (this.realtimeManager) {
      this.registerRealtime(this.realtimeManager);
    }

    // Enable stores with current session
    // Session management is handled by RootStore, we just enable/disable stores
    const token = session?.access_token || "playground-token";
    const stores = this.getAuthStores();

    if (session?.access_token) {
      stores.forEach((store) => store.enable(token));
    } else {
      stores.forEach((store) => store.disable());
    }

    console.log("👑 AdminStoreManager: Admin stores initialized");
  }

  /**
   * Get all stores that require authentication
   */
  getAuthStores(): AuthEnabledStore[] {
    const stores: AuthEnabledStore[] = [];
    for (const config of this.storeConfigs) {
      if (config.requiresAuth) {
        const store = this.stores.get(config.name);
        if (store) {
          stores.push(store as AuthEnabledStore);
        }
      }
    }
    return stores;
  }

  /**
   * Get all stores that support realtime
   */
  getRealtimeStores(): RealtimeStore[] {
    const stores: RealtimeStore[] = [];
    for (const config of this.storeConfigs) {
      if (config.supportsRealtime) {
        const store = this.stores.get(config.name);
        if (store) {
          stores.push(store as RealtimeStore);
        }
      }
    }
    return stores;
  }

  /**
   * Cleanup all stores
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    console.log("👑 AdminStoreManager: Disposing admin stores");

    this.isDisposed = true;

    // Disable all stores
    try {
      this.getAuthStores().forEach((store) => store.disable());
    } catch (error) {
      console.error("Error disabling stores during disposal:", error);
    }

    // Clear all store references
    this.stores.clear();

    // Note: Session manager cleanup is handled by RootStore

    this.isInitialized = false;
    console.log("👑 AdminStoreManager: Admin stores disposed");
  }
}
