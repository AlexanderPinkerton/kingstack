import { makeAutoObservable } from "mobx";
import { io, Socket } from "socket.io-client";
import { AdvancedTodoStore } from "./todoStore";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./checkboxStore";
import { AdvancedUserStore } from "./userStore";
import { PublicTodoStore } from "./publicTodoStore";
import { SingletonManager } from "@/lib/singleton";
import { SessionManager, type SupabaseSession } from "@/lib/session-manager";
import { getBrowserId } from "@/lib/browser-id";

// Type for any store that might support realtime
type AnyStore = {
  connectRealtime?: (socket: any) => void;
  disconnectRealtime?: () => void;
  [key: string]: any;
};

const SINGLETON_KEY = "RootStore";

export class RootStore {
  // Session management
  private sessionManager: SessionManager;
  session: SupabaseSession = null;

  // Optimistic stores
  todoStore: AdvancedTodoStore;
  postStore: AdvancedPostStore;
  checkboxStore: RealtimeCheckboxStore;
  userStore: AdvancedUserStore;
  publicTodoStore: PublicTodoStore;

  // WebSocket connection management
  socket: Socket | null = null;
  // Stable browser ID for filtering out self-originated realtime events
  browserId: string = getBrowserId();

  private isDisposed = false;

  // Get all optimistic stores
  private getOptimisticStores(): AnyStore[] {
    return [this.todoStore, this.postStore, this.checkboxStore, this.userStore];
  }

  // Connect all stores that support realtime
  private connectAllRealtime(socket: Socket): void {
    console.log("🔌 RootStore: Connecting stores that support realtime");
    this.getOptimisticStores().forEach((store, index) => {
      if (store.connectRealtime) {
        store.connectRealtime(socket);
        console.log(`🔌 RootStore: Connected store ${index} to realtime`);
      }
    });
  }

  // Disconnect all stores from realtime
  private disconnectAllRealtime(): void {
    console.log("🔌 RootStore: Disconnecting stores from realtime");
    this.getOptimisticStores().forEach((store, index) => {
      if (store.disconnectRealtime) {
        store.disconnectRealtime();
        console.log(`🔌 RootStore: Disconnected store ${index} from realtime`);
      }
    });
  }

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

    // Initialize session manager with stores that require auth
    this.sessionManager = new SessionManager({
      stores: [this.todoStore, this.postStore, this.userStore],
      onSessionChange: (session, event) => {
        // Update observable session
        this.session = session;

        // Handle realtime connection based on session state
        if (session?.access_token && event === "SIGNED_IN") {
          console.log(
            "✅ RootStore: Session established, setting up realtime",
          );
          this.setupRealtime(session.access_token);
        } else if (!session?.access_token) {
          console.log("❌ RootStore: Session lost, tearing down realtime");
          this.teardownRealtime();
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

  // Setup realtime (requires authentication)
  setupRealtime(token: string) {
    console.log("🔌 RootStore: Setting up realtime");
    const socket = this.createSocket();

    socket.on("connect", () => {
      console.log("🔌 RootStore: Realtime socket connected");
      socket.emit("register", {
        token,
        browserId: this.browserId,
      });
      this.connectAllRealtime(socket);
    });
  }

  // Create socket connection
  private createSocket(): Socket {
    // Clean up existing socket first
    if (this.socket) {
      console.log("🔌 RootStore: Cleaning up existing socket");
      this.socket.disconnect();
      this.socket = null;
    }

    const REALTIME_SERVER_URL =
      process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";

    const socket = io(REALTIME_SERVER_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });

    socket.on("disconnect", () => {
      console.log("🔌 RootStore: Realtime socket disconnected");
    });

    this.socket = socket;
    return socket;
  }

  // Teardown realtime connections
  teardownRealtime() {
    console.log("🔌 RootStore: Tearing down realtime");
    this.disconnectAllRealtime();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
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
    this.teardownRealtime();

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
