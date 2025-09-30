import { makeAutoObservable, runInAction } from "mobx";
import { io, Socket } from "socket.io-client";
import { createClient } from "@/lib/supabase/browserClient";
import { fetchWithAuth } from "@/lib/utils";
import { AdvancedTodoStore } from "./todoStore";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./realtimeCheckboxStore";
import { AdvancedUserStore } from "./userStore";

const supabase = createClient();

// Type for any store that might support realtime
type AnyStore = {
  connectRealtime?: (socket: any) => void;
  disconnectRealtime?: () => void;
  [key: string]: any;
};

export class RootStore {
  // Singleton instance tracking
  private static instance: RootStore | null = null;
  private static instanceCount = 0;

  session: any = null;

  // Optimistic stores
  todoStore: AdvancedTodoStore;
  postStore: AdvancedPostStore;
  checkboxStore: RealtimeCheckboxStore;
  userStore: AdvancedUserStore;

  // WebSocket connection management
  socket: Socket | null = null;
  // Stable browser ID for filtering out self-originated realtime events
  browserId: string = this.getBrowserId();

  // Auth listener cleanup
  private authUnsubscribe: (() => void) | null = null;
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
    // Track instance creation
    RootStore.instanceCount++;
    const instanceId = RootStore.instanceCount;
    console.log(`🔧 RootStore: Constructor called (instance #${instanceId})`);
    console.log("🔧 RootStore: Browser ID:", this.browserId);

    // Warn if multiple instances detected (possible memory leak)
    if (RootStore.instance && !RootStore.instance.isDisposed) {
      // In development, HMR causes module re-execution - this is expected
      const isDevelopment = process.env.NODE_ENV === "development";
      const logLevel = isDevelopment ? "log" : "warn";

      console[logLevel](
        `${isDevelopment ? "🔄" : "⚠️"} RootStore: Multiple instances detected (${isDevelopment ? "HMR" : "memory leak"})`,
        "Auto-disposing previous instance...",
      );
      RootStore.instance.dispose();
    }

    // Store reference to this instance
    RootStore.instance = this;

    this.session = null;

    // Create all optimistic stores
    this.todoStore = new AdvancedTodoStore();
    this.postStore = new AdvancedPostStore();
    this.checkboxStore = new RealtimeCheckboxStore(this.browserId);
    this.userStore = new AdvancedUserStore();

    // Make session and stores observable before setting up auth listener
    makeAutoObservable(this, {
      session: true,
      todoStore: true,
      postStore: true,
      checkboxStore: true,
      userStore: true,
    });

    // Clean up any existing auth listener first
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }

    // Set up new auth listener and store the unsubscribe function
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      console.log("🔐 RootStore: Auth state changed:", {
        event,
        hasSession: !!session,
        userEmail: session?.user?.email,
        timestamp: new Date().toISOString(),
      });

      runInAction(() => {
        // Update session state
        this.session = session;

        if (session?.access_token && event === "SIGNED_IN") {
          // Handle auth-required setup here
          console.log("✅ RootStore: Session established, setting up realtime");
          // Enable stores with new token
          this.todoStore.enable(session.access_token);
          this.postStore.enable(session.access_token);
          this.userStore.enable(session.access_token);
          // Setup realtime connection
          this.setupRealtime(session.access_token);
        } else if (!session?.access_token) {
          // Handle auth-required teardown here
          console.log("❌ RootStore: Session lost, tearing down realtime");
          // Teardown realtime connection
          this.teardownRealtime();
          // Disable stores when session is lost
          this.todoStore.disable();
          this.postStore.disable();
          this.userStore.disable();
        }

        // Note: Realtime is only available with authentication
        // Checkboxes will work without realtime when not authenticated
      });
    });

    // Store the unsubscribe function
    this.authUnsubscribe = () => subscription.unsubscribe();

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
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";

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
    console.log("🔄 RootStore: Refreshing session");
    try {
      const result = await supabase.auth.getSession();
      console.log("🔄 RootStore: Session refresh result:", {
        hasSession: !!result.data.session,
        userEmail: result.data.session?.user?.email,
      });

      // Only update if we don't already have a session or if the session is different
      if (!this.session && result.data.session) {
        runInAction(() => {
          this.session = result.data.session;
          console.log("🔄 RootStore: Session set from refresh:", {
            hasSession: !!this.session,
            userEmail: this.session?.user?.email,
          });
        });
        // Enable user store for new session
        this.userStore.enable(result.data.session.access_token);
      } else if (this.session && !result.data.session) {
        runInAction(() => {
          this.session = null;
          console.log("🔄 RootStore: Session cleared from refresh");
        });
        // Disable user store when session is lost
        this.userStore.disable();
      } else {
        console.log("🔄 RootStore: Session refresh - no change needed");
      }
    } catch (error) {
      console.error("🔄 RootStore: Session refresh failed:", error);
    }
  }

  // Get or create stable browser ID (persists across page reloads)
  private getBrowserId(): string {
    if (typeof window === "undefined") {
      return "server";
    }

    const STORAGE_KEY = "kingstack_browser_id";
    let browserId = sessionStorage.getItem(STORAGE_KEY);

    if (!browserId) {
      browserId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem(STORAGE_KEY, browserId);
    }

    return browserId;
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

    // Clean up auth listener
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }

    // Clean up realtime connection
    this.teardownRealtime();

    // Disable stores
    this.todoStore.disable();
    this.postStore.disable();
    this.userStore.disable();

    // Clear singleton reference if this is the current instance
    if (RootStore.instance === this) {
      RootStore.instance = null;
    }

    console.log("🧹 RootStore: Disposed");
  }

  // Static method to get the current instance (useful for debugging)
  static getInstance(): RootStore | null {
    return RootStore.instance;
  }

  // Static method to check if there's an active instance
  static hasActiveInstance(): boolean {
    return RootStore.instance !== null && !RootStore.instance.isDisposed;
  }

  // Convenience getter for user data
  get userData() {
    return this.userStore.currentUser;
  }
}
