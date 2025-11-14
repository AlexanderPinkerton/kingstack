import { AdvancedTodoStore } from "./todoStore";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./checkboxStore";
import { AdvancedUserStore } from "./userStore";
import { PublicTodoStore } from "./publicTodoStore";
import { StoreManager } from "./store-manager";
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
  private _userStore: AdvancedUserStore | null = null;

  constructor() {
    super();
    // No need to make this observable - the stores themselves are observable
  }

  // Getters with lazy initialization
  get todoStore(): AdvancedTodoStore {
    if (!this._todoStore) {
      this._todoStore = new AdvancedTodoStore();
      this.ensureInitialized();
    }
    return this._todoStore;
  }

  get postStore(): AdvancedPostStore {
    if (!this._postStore) {
      this._postStore = new AdvancedPostStore();
      this.ensureInitialized();
    }
    return this._postStore;
  }

  get checkboxStore(): RealtimeCheckboxStore {
    if (!this._checkboxStore) {
      this._checkboxStore = new RealtimeCheckboxStore(this.browserId);
      this.ensureInitialized();
    }
    return this._checkboxStore;
  }

  get publicTodoStore(): PublicTodoStore {
    if (!this._publicTodoStore) {
      this._publicTodoStore = new PublicTodoStore();
      this.ensureInitialized();
    }
    return this._publicTodoStore;
  }

  get userStore(): AdvancedUserStore {
    if (!this._userStore) {
      this._userStore = new AdvancedUserStore();
      this.ensureInitialized();
    }
    return this._userStore;
  }

  /**
   * Ensure stores are initialized with current session
   */
  private ensureInitialized(): void {
    if (!this.isInitialized && this.sessionManager) {
      const session = this.sessionManager.getSession();
      this.initialize(session);
    }
  }

  /**
   * Initialize stores with session
   */
  initialize(session: SupabaseSession | null): void {
    if (this.isInitialized) {
      return;
    }

    console.log("👤 UserStoreManager: Initializing user stores");

    // Create stores if they don't exist yet
    if (!this._todoStore) this._todoStore = new AdvancedTodoStore();
    if (!this._postStore) this._postStore = new AdvancedPostStore();
    if (!this._checkboxStore)
      this._checkboxStore = new RealtimeCheckboxStore(this.browserId);
    if (!this._publicTodoStore) this._publicTodoStore = new PublicTodoStore();
    if (!this._userStore) this._userStore = new AdvancedUserStore();

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

    console.log("👤 UserStoreManager: User stores initialized");
  }

  /**
   * Get all stores that require authentication
   */
  getAuthStores(): AuthEnabledStore[] {
    const stores: AuthEnabledStore[] = [];
    if (this._todoStore) stores.push(this._todoStore);
    if (this._postStore) stores.push(this._postStore);
    if (this._userStore) stores.push(this._userStore);
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
    if (this._userStore) stores.push(this._userStore);
    return stores;
  }

  /**
   * Cleanup all stores
   */
  dispose(): void {
    console.log("👤 UserStoreManager: Disposing user stores");

    // Disable all stores
    this.getAuthStores().forEach((store) => store.disable());

    // Clear references
    this._todoStore = null;
    this._postStore = null;
    this._checkboxStore = null;
    this._publicTodoStore = null;
    this._userStore = null;

    // Note: Session manager cleanup is handled by RootStore

    this.isInitialized = false;
    console.log("👤 UserStoreManager: User stores disposed");
  }
}
