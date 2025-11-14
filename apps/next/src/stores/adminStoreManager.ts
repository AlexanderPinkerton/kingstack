import { StoreManager } from "./store-manager";
import { SessionManager } from "@/lib/session-manager";
import { AdminMgmtStore } from "./adminMgmtStore";
import type { SupabaseSession } from "@/lib/session-manager";
import type { AuthEnabledStore } from "@/lib/session-manager";
import type { RealtimeStore } from "@/lib/realtime-manager";

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
  // Admin-facing stores (lazy-loaded)
  private _adminMgmtStore: AdminMgmtStore | null = null;

  // Getters with lazy initialization
  get adminMgmtStore(): AdminMgmtStore {
    if (!this._adminMgmtStore) {
      this._adminMgmtStore = new AdminMgmtStore();
      this.ensureInitialized();
    }
    return this._adminMgmtStore;
  }

  /**
   * Ensure stores are initialized with current session
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      // Get session from RootStore if available
      // For now, we'll initialize when accessed - session will be set via initializeWithSession
      console.log("👑 AdminStoreManager: Store accessed, initialization needed");
    }
  }

  constructor() {
    super();
    // No need to make this observable - the stores themselves are observable
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
    if (this.isInitialized) {
      return;
    }

    console.log("👑 AdminStoreManager: Initializing admin stores");

    // Create stores if they don't exist yet
    if (!this._adminMgmtStore) {
      this._adminMgmtStore = new AdminMgmtStore();
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
    if (this._adminMgmtStore) stores.push(this._adminMgmtStore);
    return stores;
  }

  /**
   * Get all stores that support realtime
   */
  getRealtimeStores(): RealtimeStore[] {
    const stores: RealtimeStore[] = [];
    // Admin stores don't currently support realtime, but can be added here
    // if (this._adminMgmtStore) stores.push(this._adminMgmtStore);
    return stores;
  }

  /**
   * Cleanup all stores
   */
  dispose(): void {
    console.log("👑 AdminStoreManager: Disposing admin stores");

    // Disable all stores
    this.getAuthStores().forEach((store) => store.disable());

    // Clear references
    this._adminMgmtStore = null;

    // Note: Session manager cleanup is handled by RootStore

    this.isInitialized = false;
    console.log("👑 AdminStoreManager: Admin stores disposed");
  }
}
