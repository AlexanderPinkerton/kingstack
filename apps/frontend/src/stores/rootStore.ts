import { makeAutoObservable, runInAction } from "mobx";
import { io, Socket } from "socket.io-client";
import { createClient } from "@/lib/supabase/browserClient";
import { fetchWithAuth } from "@/lib/utils";
import { AdvancedTodoStore } from "./todoStore";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./realtimeCheckboxStore";

const supabase = createClient();

// Type for any store that might support realtime
type AnyStore = {
  connectRealtime?: (socket: any) => void;
  disconnectRealtime?: () => void;
  [key: string]: any;
};

export class RootStore {
  session: any = null;
  userData: any = null;
  
  // Optimistic stores
  todoStore: AdvancedTodoStore;
  postStore: AdvancedPostStore;
  checkboxStore: RealtimeCheckboxStore;
  
  // WebSocket connection management
  socket: Socket | null = null;
  // Stable browser ID for filtering out self-originated realtime events
  browserId: string = this.getBrowserId();
  
  // Auth listener cleanup
  private authUnsubscribe: (() => void) | null = null;

  // Get all optimistic stores
  private getOptimisticStores(): AnyStore[] {
    return [
      this.todoStore,
      this.postStore,
      this.checkboxStore,
    ];
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
    console.log("🔧 RootStore: Constructor called", Math.random());
    console.log("🔧 RootStore: Browser ID:", this.browserId);

    this.session = null;

    // Create all optimistic stores
    this.todoStore = new AdvancedTodoStore();
    this.postStore = new AdvancedPostStore();
    this.checkboxStore = new RealtimeCheckboxStore(this.browserId);

    // Make session and userData observable before setting up auth listener
    makeAutoObservable(this, {
      session: true,
      userData: true,
      todoStore: true,
      postStore: true,
      checkboxStore: true,
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
          // Setup realtime connection
          this.setupRealtime(session.access_token);
          // Fetch user data when session is established
          this.fetchUserData();
        } else if (!session?.access_token) {
          // Handle auth-required teardown here
          console.log("❌ RootStore: Session lost, tearing down realtime");
          // Teardown realtime connection
          this.teardownRealtime();
          // Clear user data when session is lost
          this.userData = null;
          // Disable stores when session is lost
          this.todoStore.disable();
          // this.postStore2.disable();
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


  private fetchingUserData = false;

  async fetchUserData() {
    if (!this.session?.access_token) {
      console.log("🔄 RootStore: No session available for user data fetch");
      return;
    }

    if (this.fetchingUserData) {
      console.log(
        "🔄 RootStore: User data fetch already in progress, skipping",
      );
      return;
    }

    this.fetchingUserData = true;
    console.log("🔄 RootStore: Fetching user data");
    try {

      const userResponse = await fetchWithAuth(
        this.session.access_token,
        "/api/user"
      );

      if (userResponse.ok) {
        const userData = await userResponse.json();
        runInAction(() => {
          this.userData = userData;
          console.log(
            "✅ RootStore: User data fetched successfully:",
            userData,
          );
        });
      } else {
        console.error(
          "❌ RootStore: Failed to fetch user data:",
          userResponse.status,
        );
      }
    } catch (error) {
      console.error("❌ RootStore: Error fetching user data:", error);
    } finally {
      this.fetchingUserData = false;
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
        // Fetch user data for new session
        this.fetchUserData();
      } else if (this.session && !result.data.session) {
        runInAction(() => {
          this.session = null;
          this.userData = null;
          console.log("🔄 RootStore: Session cleared from refresh");
        });
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
    console.log("🧹 RootStore: Disposing");

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

    console.log("🧹 RootStore: Disposed");
  }
}
