import { makeAutoObservable, runInAction } from "mobx";
import { useContext } from "react";
import { io, Socket } from "socket.io-client";
import { PostStore } from "./postStore";
import { createClient } from "@/lib/supabase/browserClient";
import { fetchInternal } from "@/lib/utils";
import { RootStoreContext } from "@/context/rootStoreContext";
import { RealtimeStore } from "./interfaces/RealtimeStore";

const supabase = createClient();

export class RootStore {
  postStore: PostStore;
  session: any = null;
  userData: any = null;
  
  // WebSocket connection management
  socket: Socket | null = null;
  browserId: string = Math.random().toString(36).substring(7);

  constructor() {
    console.log("🔧 RootStore: Constructor called", Math.random());

    this.postStore = new PostStore(this);
    this.session = null;

    // Make session and userData observable before setting up auth listener
    makeAutoObservable(this, {
      session: true, // Ensure session is observable
      userData: true, // Ensure userData is observable
    });

    supabase.auth.onAuthStateChange((event: any, session: any) => {
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
        }
      });
    });

    console.log("🔧 RootStore: Initialized");
  }

  setupRealtime(token: string) {
    console.log("[RootStore] setupRealtime called");
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    const REALTIME_SERVER_URL =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    
    this.socket = io(REALTIME_SERVER_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });
    
    this.socket.on("connect", () => {
      console.log("[RootStore] Realtime socket connected");
      this.socket?.emit("register", {
        token,
        browserId: this.browserId,
      });
      
      // Setup domain-specific event handlers
      this.setupDomainEventHandlers();
    });
    
    this.socket.on("disconnect", () => {
      console.log("[RootStore] Realtime socket disconnected");
    });
  }

  teardownRealtime() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupDomainEventHandlers() {
    if (!this.socket) return;
    
    // Get all domain stores that implement RealtimeStore
    const realtimeStores: RealtimeStore[] = [
      this.postStore,
      // Add other domain stores here as they are created
    ];
    
    // Setup event handlers for each domain store
    realtimeStores.forEach(store => {
      store.setupRealtimeHandlers(this.socket!);
    });
  }

  async fetchUserData() {
    if (!this.session?.access_token) {
      console.log("🔄 RootStore: No session available for user data fetch");
      return;
    }

    console.log("🔄 RootStore: Fetching user data");
    try {
      const userResponse = await fetchInternal(
        this.session.access_token,
        "/api/user",
        "GET",
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
}