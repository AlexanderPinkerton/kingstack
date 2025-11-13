import { makeAutoObservable } from "mobx";
import { AdvancedTodoStore } from "./todoStore";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./checkboxStore";
import { AdvancedUserStore } from "./userStore";
import { PublicTodoStore } from "./publicTodoStore";
import { SingletonManager } from "@/lib/singleton";
import { SessionManager, type SupabaseSession } from "@/lib/session-manager";
import { RealtimeManager } from "@/lib/realtime-manager";
import { getBrowserId } from "@/lib/browser-id";

const SINGLETON_KEY = "RootStore";

export class RootStore {
  // Session management
  private sessionManager: SessionManager;
  session: SupabaseSession = null;

  // Realtime management
  private realtimeManager: RealtimeManager;

  // Optimistic stores
  todoStore: AdvancedTodoStore;
  postStore: AdvancedPostStore;
  checkboxStore: RealtimeCheckboxStore;
  userStore: AdvancedUserStore;
  publicTodoStore: PublicTodoStore;

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

    // Create all optimistic stores
    this.todoStore = new AdvancedTodoStore();
    this.postStore = new AdvancedPostStore();
    this.checkboxStore = new RealtimeCheckboxStore(this.browserId);
    this.publicTodoStore = new PublicTodoStore();
    this.userStore = new AdvancedUserStore();

    // Initialize realtime manager with stores that support realtime
    this.realtimeManager = new RealtimeManager({
      stores: [
        this.todoStore,
        this.postStore,
        this.checkboxStore,
        this.userStore,
      ],
      browserId: this.browserId,
    });

    // Initialize session manager with stores that require auth
    this.sessionManager = new SessionManager({
      stores: [this.todoStore, this.postStore, this.userStore],
      onSessionChange: (session, event) => {
        // Update observable session
        this.session = session;

        // Handle realtime connection based on session state
        if (session?.access_token && event === "SIGNED_IN") {
          console.log("✅ RootStore: Session established, setting up realtime");
          this.realtimeManager.setup(session.access_token);
        } else if (!session?.access_token) {
          console.log("❌ RootStore: Session lost, tearing down realtime");
          this.realtimeManager.teardown();
        }
      },
    });

    // Make session and stores observable
    makeAutoObservable(this, {
      session: true,
      todoStore: true,
      postStore: true,
      checkboxStore: true,
      userStore: true,
    });

    // Initialize session management (sets up auth listener or playground mode)
    this.sessionManager.initialize();

    console.log("🔧 RootStore: Initialized");
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

    // Clean up session manager (unsubscribes from auth listener and disables stores)
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
    return this.userStore.currentUser;
  }
}
