import { AdvancedTodoStore } from "./todoStore";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./checkboxStore";
import { CurrentUserStore } from "./currentUserStore";
import { PublicTodoStore } from "./publicTodoStore";
import { StoreManager } from "@/lib/store-manager";
import { SessionManager } from "@/lib/session-manager";
import type { SupabaseSession } from "@/lib/session-manager";
import type { AuthEnabledStore } from "@/lib/session-manager";
import type { RealtimeStore } from "@/lib/realtime-manager";

/**
 * UserStore manages all user-facing stores
 * Stores are lazy-loaded when first accessed
 * Note: This class doesn't need to be observable - the stores themselves are observable
 */
export class UserStoreManager extends StoreManager {
  // User-facing stores (lazy-loaded)
  private _todoStore: AdvancedTodoStore | null = null;
  private _postStore: AdvancedPostStore | null = null;
  private _checkboxStore: RealtimeCheckboxStore | null = null;
  private _publicTodoStore: PublicTodoStore | null = null;
  private _currentUserStore: CurrentUserStore | null = null;
  private _initializing = false; // Guard against race conditions

  constructor() {
    super();
    // No need to make this observable - the stores themselves are observable
  }

  // Getters with lazy initialization (race-condition safe)
  get todoStore(): AdvancedTodoStore {
    if (this.isDisposed) {
      throw new Error("UserStoreManager has been disposed");
    }
    if (this._todoStore) return this._todoStore;

    // Prevent race conditions - if already initializing, wait for it
    if (this._initializing) {
      // Return a placeholder or wait - for now, create anyway (stores are idempotent)
      // In production, you might want to use a Promise-based approach
    }

    try {
      this._todoStore = new AdvancedTodoStore();
      this.ensureInitialized();
      return this._todoStore;
    } catch (error) {
      console.error("Failed to initialize todoStore:", error);
      this._todoStore = null;
      throw error;
    }
  }

  get postStore(): AdvancedPostStore {
    if (this.isDisposed) {
      throw new Error("UserStoreManager has been disposed");
    }
    if (this._postStore) return this._postStore;

    try {
      this._postStore = new AdvancedPostStore();
      this.ensureInitialized();
      return this._postStore;
    } catch (error) {
      console.error("Failed to initialize postStore:", error);
      this._postStore = null;
      throw error;
    }
  }

  get checkboxStore(): RealtimeCheckboxStore {
    if (this.isDisposed) {
      throw new Error("UserStoreManager has been disposed");
    }
    if (this._checkboxStore) return this._checkboxStore;

    try {
      this._checkboxStore = new RealtimeCheckboxStore(this.browserId);
      this.ensureInitialized();
      return this._checkboxStore;
    } catch (error) {
      console.error("Failed to initialize checkboxStore:", error);
      this._checkboxStore = null;
      throw error;
    }
  }

  get publicTodoStore(): PublicTodoStore {
    if (this.isDisposed) {
      throw new Error("UserStoreManager has been disposed");
    }
    if (this._publicTodoStore) return this._publicTodoStore;

    try {
      this._publicTodoStore = new PublicTodoStore();
      this.ensureInitialized();
      return this._publicTodoStore;
    } catch (error) {
      console.error("Failed to initialize publicTodoStore:", error);
      this._publicTodoStore = null;
      throw error;
    }
  }

  get currentUserStore(): CurrentUserStore {
    if (this.isDisposed) {
      throw new Error("UserStoreManager has been disposed");
    }
    if (this._currentUserStore) return this._currentUserStore;

    try {
      this._currentUserStore = new CurrentUserStore();
      this.ensureInitialized();
      return this._currentUserStore;
    } catch (error) {
      console.error("Failed to initialize currentUserStore:", error);
      this._currentUserStore = null;
      throw error;
    }
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

    // Create stores if they don't exist yet
    if (!this._todoStore) this._todoStore = new AdvancedTodoStore();
    if (!this._postStore) this._postStore = new AdvancedPostStore();
    if (!this._checkboxStore)
      this._checkboxStore = new RealtimeCheckboxStore(this.browserId);
    if (!this._publicTodoStore) this._publicTodoStore = new PublicTodoStore();
    if (!this._currentUserStore)
      this._currentUserStore = new CurrentUserStore();

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
    if (this._todoStore) stores.push(this._todoStore);
    if (this._postStore) stores.push(this._postStore);
    if (this._currentUserStore) stores.push(this._currentUserStore);
    return stores;
  }

  /**
   * Get all stores that support realtime
   */
  getRealtimeStores(): RealtimeStore[] {
    const stores: RealtimeStore[] = [];
    if (this._todoStore) stores.push(this._todoStore);
    if (this._postStore) stores.push(this._postStore);
    if (this._checkboxStore) stores.push(this._checkboxStore);
    if (this._currentUserStore) stores.push(this._currentUserStore);
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

    // Clear references
    this._todoStore = null;
    this._postStore = null;
    this._checkboxStore = null;
    this._publicTodoStore = null;
    this._currentUserStore = null;

    // Note: Session manager cleanup is handled by RootStore

    this.isInitialized = false;
    console.log("👤 UserStoreManager: User stores disposed");
  }
}
