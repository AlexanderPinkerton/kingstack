import { AdvancedTodoStore } from "./todoStore";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./checkboxStore";
import { CurrentUserStore } from "./currentUserStore";
import { PublicTodoStore } from "./publicTodoStore";
import { StoreManager } from "@/lib/store-manager";
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
 * UserStore manages all user-facing stores
 * Stores are lazy-loaded when first accessed
 * Note: This class doesn't need to be observable - the stores themselves are observable
 */
export class UserStoreManager extends StoreManager {
  private _initializing = false; // Guard against race conditions

  // Store registry - define all stores here
  private readonly storeConfigs: StoreConfig<any>[] = [
    {
      name: "todoStore",
      factory: () => new AdvancedTodoStore(),
      requiresAuth: true,
      supportsRealtime: false,
    },
    {
      name: "postStore",
      factory: () => new AdvancedPostStore(),
      requiresAuth: true,
      supportsRealtime: false,
    },
    {
      name: "checkboxStore",
      factory: () => new RealtimeCheckboxStore(this.browserId),
      requiresAuth: false,
      supportsRealtime: true,
    },
    {
      name: "publicTodoStore",
      factory: () => new PublicTodoStore(),
      requiresAuth: false,
      supportsRealtime: false,
    },
    {
      name: "currentUserStore",
      factory: () => new CurrentUserStore(),
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
      throw new Error(`UserStoreManager has been disposed`);
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
      this.ensureInitialized();
      return store;
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
      throw error;
    }
  }

  // Type-safe getters for each store
  get todoStore(): AdvancedTodoStore {
    return this.getStore<AdvancedTodoStore>("todoStore");
  }

  get postStore(): AdvancedPostStore {
    return this.getStore<AdvancedPostStore>("postStore");
  }

  get checkboxStore(): RealtimeCheckboxStore {
    return this.getStore<RealtimeCheckboxStore>("checkboxStore");
  }

  get publicTodoStore(): PublicTodoStore {
    return this.getStore<PublicTodoStore>("publicTodoStore");
  }

  get currentUserStore(): CurrentUserStore {
    return this.getStore<CurrentUserStore>("currentUserStore");
  }

  // Backward compatibility alias
  get userStore(): CurrentUserStore {
    return this.currentUserStore;
  }

  /**
   * Ensure stores are initialized with current session
   * Note: Session will be set via updateSession() from RootStore
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      // Initialize with null - RootStore will call updateSession() to set the actual session
      this.initialize(null);
    }
  }

  /**
   * Initialize stores with session
   */
  initialize(session: SupabaseSession | null): void {
    if (this.isDisposed) {
      console.warn(
        "⚠️ UserStoreManager: Attempted to initialize after disposal",
      );
      return;
    }

    if (this.isInitialized) {
      return;
    }

    this._initializing = true;
    console.log("👤 UserStoreManager: Initializing user stores");

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

    // Mark as initialized BEFORE calling updateSession to prevent recursion
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

    this._initializing = false;
    console.log("👤 UserStoreManager: User stores initialized");
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

    console.log("👤 UserStoreManager: Disposing user stores");

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
    console.log("👤 UserStoreManager: User stores disposed");
  }
}
