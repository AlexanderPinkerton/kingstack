import { makeAutoObservable, runInAction } from "mobx";
import { io, Socket } from "socket.io-client";
import { createClient } from "@/lib/supabase/browserClient";
import { AdvancedTodoStore } from "./todoStore";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./checkboxStore";
import { AdvancedUserStore } from "./userStore";
import { isPlaygroundMode } from "@kingstack/shared";

const supabase = createClient();
const REALTIME_SERVER_URL =
  process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
const STORAGE_KEY = "kingstack_browser_id";

// Type for stores that support enable/disable
type EnableableStore = {
  enable: (token: string) => void;
  disable: () => void;
};

export class RootStore {
  private static instance: RootStore | null = null;
  private static instanceCount = 0;

  session: any = null;
  todoStore: AdvancedTodoStore;
  postStore: AdvancedPostStore;
  checkboxStore: RealtimeCheckboxStore;
  userStore: AdvancedUserStore;
  socket: Socket | null = null;
  browserId: string = this.getBrowserId();

  private authUnsubscribe: (() => void) | null = null;
  private isDisposed = false;

  constructor() {
    RootStore.instanceCount++;
    this.handleSingletonInstance();

    RootStore.instance = this;
    this.session = null;

    // Initialize stores
    this.todoStore = new AdvancedTodoStore();
    this.postStore = new AdvancedPostStore();
    this.checkboxStore = new RealtimeCheckboxStore(this.browserId);
    this.userStore = new AdvancedUserStore();

    makeAutoObservable(this, {
      session: true,
      todoStore: true,
      postStore: true,
      checkboxStore: true,
      userStore: true,
    });

    this.setupAuth();
  }

  // ============================================================================
  // Singleton Management
  // ============================================================================

  private handleSingletonInstance() {
    if (RootStore.instance && !RootStore.instance.isDisposed) {
      const isDevelopment = process.env.NODE_ENV === "development";
      console[isDevelopment ? "log" : "warn"](
        `${isDevelopment ? "🔄" : "⚠️"} RootStore: Multiple instances detected (${isDevelopment ? "HMR" : "memory leak"})`,
        "Auto-disposing previous instance...",
      );
      RootStore.instance.dispose();
    }
  }

  static getInstance(): RootStore | null {
    return RootStore.instance;
  }

  static hasActiveInstance(): boolean {
    return RootStore.instance !== null && !RootStore.instance.isDisposed;
  }

  // ============================================================================
  // Authentication Setup
  // ============================================================================

  private setupAuth() {
    if (isPlaygroundMode() || !supabase) {
      this.enablePlaygroundMode();
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      runInAction(() => {
        this.session = session;

        if (session?.access_token && event === "SIGNED_IN") {
          this.enableStores(session.access_token);
          this.setupRealtime(session.access_token);
        } else if (!session?.access_token) {
          this.disableStores();
          this.teardownRealtime();
        }
      });
    });

    this.authUnsubscribe = () => subscription.unsubscribe();
  }

  private enablePlaygroundMode() {
    runInAction(() => {
      this.todoStore.enable("playground-token");
      this.postStore.enable("playground-token");
      this.userStore.enable("playground-token");
    });
  }

  private enableStores(token: string) {
    const stores: EnableableStore[] = [
      this.todoStore,
      this.postStore,
      this.userStore,
    ];
    stores.forEach((store) => store.enable(token));
  }

  private disableStores() {
    const stores: EnableableStore[] = [
      this.todoStore,
      this.postStore,
      this.userStore,
    ];
    stores.forEach((store) => store.disable());
  }

  async refreshSession() {
    if (!supabase) return;

    try {
      const result = await supabase.auth.getSession();
      const newSession = result.data.session;

      if (!this.session && newSession) {
        runInAction(() => {
          this.session = newSession;
        });
        this.userStore.enable(newSession.access_token);
      } else if (this.session && !newSession) {
        runInAction(() => {
          this.session = null;
        });
        this.userStore.disable();
      }
    } catch (error) {
      console.error("🔄 RootStore: Session refresh failed:", error);
    }
  }

  // ============================================================================
  // Realtime Management
  // ============================================================================

  setupRealtime(token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(REALTIME_SERVER_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      this.socket?.emit("register", {
        token,
        browserId: this.browserId,
      });
      // Only checkboxStore supports realtime
      this.checkboxStore.connectRealtime(this.socket!);
    });

    this.socket.on("disconnect", () => {
      // Handle disconnect if needed
    });
  }

  teardownRealtime() {
    this.checkboxStore.disconnectRealtime();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ============================================================================
  // Browser ID Management
  // ============================================================================

  private getBrowserId(): string {
    if (typeof window === "undefined") {
      return "server";
    }

    let browserId = sessionStorage.getItem(STORAGE_KEY);
    if (!browserId) {
      browserId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem(STORAGE_KEY, browserId);
    }

    return browserId;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose() {
    if (this.isDisposed) return;

    this.isDisposed = true;

    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }

    this.teardownRealtime();
    this.disableStores();

    if (RootStore.instance === this) {
      RootStore.instance = null;
    }
  }

  // ============================================================================
  // Convenience Getters
  // ============================================================================

  get userData() {
    return this.userStore.currentUser;
  }
}
