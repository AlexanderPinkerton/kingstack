import { makeAutoObservable } from "mobx";
import { SingletonManager } from "@/lib/singleton";
import { SessionManager, type SupabaseSession } from "@/lib/session-manager";
import { RealtimeManager } from "@/lib/realtime-manager";
import { getBrowserId } from "@/lib/browser-id";
import { UserStoreManager } from "./userApp/userStoreManager";
import { AdminStoreManager } from "./adminApp/adminStoreManager";

// Re-export store types for backward compatibility
export type { AdvancedTodoStore } from "./userApp/todoStore";
export type { AdvancedPostStore } from "./userApp/postStore";
export type { RealtimeCheckboxStore } from "./userApp/checkboxStore";
export type { CurrentUserStore } from "./userApp/currentUserStore";
export type { PublicTodoStore } from "./userApp/publicTodoStore";

const SINGLETON_KEY = "RootStore";

export class RootStore {
  // Session management
  private sessionManager: SessionManager;
  session: SupabaseSession = null;

  // Realtime management
  private realtimeManager: RealtimeManager;

  // Store managers (lazy-loaded)
  userStore: UserStoreManager;
  adminStore: AdminStoreManager;

  // Stable browser ID for filtering out self-originated realtime events
  browserId: string = getBrowserId();

  private isDisposed = false;

  constructor() {
    // Register with singleton manager
    const instanceId = SingletonManager.getInstanceCount(SINGLETON_KEY) + 1;
    console.log(`🔧 RootStore: Constructor called (instance #${instanceId})`);
    console.log("🔧 RootStore: Browser ID:", this.browserId);

    const isDevelopment = process.env.NODE_ENV === "development";
    SingletonManager.register(SINGLETON_KEY, this, {
      autoDisposePrevious: true,
      isDevelopment,
    });

    // Create store managers (stores are lazy-loaded)
    this.userStore = new UserStoreManager();
    this.adminStore = new AdminStoreManager();

    // Initialize realtime manager (stores will be registered lazily)
    this.realtimeManager = new RealtimeManager({
      stores: [],
      browserId: this.browserId,
    });

    // Register store managers with realtime manager
    // They will register their stores when initialized
    this.userStore.registerRealtime(this.realtimeManager);
    this.adminStore.registerRealtime(this.realtimeManager);

    // Initialize session manager (no stores initially - they're lazy-loaded)
    this.sessionManager = new SessionManager({
      stores: [],
      onSessionChange: (session, event) => {
        // Update observable session
        this.session = session;

        // Update store managers with new session
        // Only update user stores automatically - admin stores load only when accessed
        this.userStore.updateSession(session);
        // Admin stores are lazy-loaded only when accessed (via getters) or explicitly initialized

        // Handle realtime connection based on session state
        // Set up realtime for both SIGNED_IN and INITIAL_SESSION events
        if (
          session?.access_token &&
          (event === "SIGNED_IN" || event === "INITIAL_SESSION")
        ) {
          console.log(
            `✅ RootStore: Session established (${event}), setting up realtime`,
          );
          this.realtimeManager.setup(session.access_token);
        } else if (!session?.access_token) {
          console.log("❌ RootStore: Session lost, tearing down realtime");
          this.realtimeManager.teardown();
        }
      },
    });

    // Make session and store managers observable
    makeAutoObservable(this, {
      session: true,
      userStore: true,
      adminStore: true,
    });

    // Initialize session management (sets up auth listener or playground mode)
    this.sessionManager.initialize();

    console.log("🔧 RootStore: Initialized");
  }

  // Backward compatibility: delegate to userStore for existing code
  get todoStore() {
    return this.userStore.todoStore;
  }

  get postStore() {
    return this.userStore.postStore;
  }

  get checkboxStore() {
    return this.userStore.checkboxStore;
  }

  get publicTodoStore() {
    return this.userStore.publicTodoStore;
  }

  // Expose socket for external access if needed
  get socket() {
    return this.realtimeManager.getSocket();
  }

  async refreshSession() {
    await this.sessionManager.refreshSession();
    // Session is updated via onSessionChange callback
  }

  // Cleanup method to properly dispose of the store
  dispose() {
    if (this.isDisposed) {
      console.warn("⚠️ RootStore: Already disposed, skipping");
      return;
    }

    console.log("🧹 RootStore: Disposing");

    // Mark as disposed
    this.isDisposed = true;

    // Clean up store managers
    this.userStore.dispose();
    this.adminStore.dispose();

    // Clean up session manager (unsubscribes from auth listener)
    this.sessionManager.dispose();

    // Clean up realtime connection
    this.realtimeManager.dispose();

    // Unregister from singleton manager
    SingletonManager.unregister(SINGLETON_KEY, this);

    console.log("🧹 RootStore: Disposed");
  }

  // Static method to get the current instance (useful for debugging)
  static getInstance(): RootStore | null {
    return SingletonManager.getInstance<RootStore>(SINGLETON_KEY);
  }

  // Static method to check if there's an active instance
  static hasActiveInstance(): boolean {
    const instance = SingletonManager.getInstance<RootStore>(SINGLETON_KEY);
    return instance !== null && !instance.isDisposed;
  }

  // Convenience getter for user data
  get userData() {
    return this.userStore.currentUserStore.currentUser;
  }
}
