import { RealtimeManager, type RealtimeStore } from "@/lib/realtime-manager";
import { SessionManager, type AuthEnabledStore } from "@/lib/session-manager";
import { getBrowserId } from "@/lib/browser-id";
import type { SupabaseSession } from "@/lib/session-manager";

/**
 * Base class for managing a collection of stores
 * Handles lazy loading, session management, and realtime registration
 * Note: Child classes should call makeAutoObservable in their constructors
 */
export abstract class StoreManager {
  protected browserId: string;
  protected realtimeManager: RealtimeManager | null = null;
  protected sessionManager: SessionManager | null = null;
  protected isInitialized = false;
  protected isDisposed = false;

  constructor() {
    this.browserId = getBrowserId();
    // Note: makeAutoObservable cannot be used in base classes
    // Child classes should call it in their constructors
  }

  /**
   * Initialize stores (lazy loading)
   * Should be called when stores are first accessed
   */
  abstract initialize(session: SupabaseSession | null): void;

  /**
   * Get all stores that require authentication
   */
  abstract getAuthStores(): AuthEnabledStore[];

  /**
   * Get all stores that support realtime
   */
  abstract getRealtimeStores(): RealtimeStore[];

  /**
   * Update session and enable/disable stores accordingly
   * Will initialize stores if not already initialized (lazy initialization)
   * Note: For context-specific stores (like admin), prefer explicit initialization
   */
  updateSession(session: SupabaseSession | null): void {
    if (this.isDisposed) {
      console.warn(
        "⚠️ StoreManager: Attempted to update session after disposal",
      );
      return;
    }

    // Initialize if not already done (lazy initialization)
    if (!this.isInitialized) {
      this.initialize(session);
      return;
    }

    // Update stores with new session
    const token = session?.access_token || "playground-token";
    const stores = this.getAuthStores();

    if (session?.access_token) {
      stores.forEach((store) => store.enable(token));
    } else {
      stores.forEach((store) => store.disable());
    }
  }

  /**
   * Explicitly initialize stores with a session
   * Use this for context-specific stores that should only load when needed
   */
  initializeWithSession(session: SupabaseSession | null): void {
    if (!this.isInitialized) {
      this.initialize(session);
    } else {
      // If already initialized, just update the session
      this.updateSession(session);
    }
  }

  /**
   * Register stores with realtime manager
   */
  registerRealtime(realtimeManager: RealtimeManager): void {
    this.realtimeManager = realtimeManager;
    const stores = this.getRealtimeStores();
    realtimeManager.registerStores(stores);
  }

  /**
   * Cleanup all stores
   */
  abstract dispose(): void;
}
