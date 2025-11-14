import { runInAction } from "mobx";
import { createClient } from "@/lib/supabase/browserClient";
import { isPlaygroundMode } from "@kingstack/shared";

/**
 * Type for Supabase session
 */
export type SupabaseSession = {
  access_token: string;
  user: {
    email?: string;
    id: string;
    [key: string]: any;
  };
  [key: string]: any;
} | null;

/**
 * Store interface for stores that can be enabled/disabled with auth tokens
 */
export interface AuthEnabledStore {
  enable(token: string): void;
  disable(): void;
}

/**
 * Callback type for session changes
 */
export type SessionChangeCallback = (
  session: SupabaseSession,
  event: string,
) => void;

/**
 * Session Manager
 * Handles authentication state, session management, and store lifecycle
 */
export class SessionManager {
  private supabase = createClient();
  private authUnsubscribe: (() => void) | null = null;
  private session: SupabaseSession = null;
  private stores: AuthEnabledStore[] = [];
  private onSessionChange: SessionChangeCallback | null = null;

  constructor(options?: {
    stores?: AuthEnabledStore[];
    onSessionChange?: SessionChangeCallback;
  }) {
    const { stores = [], onSessionChange = null } = options || {};
    this.stores = stores;
    this.onSessionChange = onSessionChange;
  }

  /**
   * Register stores that should be enabled/disabled based on session
   */
  registerStores(stores: AuthEnabledStore[]): void {
    this.stores = [...this.stores, ...stores];
  }

  /**
   * Set callback for session changes
   */
  setOnSessionChange(callback: SessionChangeCallback): void {
    this.onSessionChange = callback;
  }

  /**
   * Get current session
   */
  getSession(): SupabaseSession {
    return this.session;
  }

  /**
   * Initialize session management
   * Sets up auth state listener or enables playground mode
   */
  initialize(): void {
    // Handle playground mode vs normal mode
    if (isPlaygroundMode() || !this.supabase) {
      console.log(
        "🎮 SessionManager: Playground mode detected - enabling stores with mock data",
      );
      this.enablePlaygroundMode();
    } else {
      this.setupAuthListener();
    }
  }

  /**
   * Enable stores in playground mode
   */
  private enablePlaygroundMode(): void {
    runInAction(() => {
      this.session = null; // No real session in playground mode
      this.stores.forEach((store) => {
        store.enable("playground-token");
      });
    });
  }

  /**
   * Setup Supabase auth state change listener
   */
  private setupAuthListener(): void {
    if (!this.supabase) {
      console.warn("⚠️ SessionManager: No Supabase client available");
      return;
    }

    // Clean up any existing listener first
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }

    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange((event: string, session: any) => {
      console.log("🔐 SessionManager: Auth state changed:", {
        event,
        hasSession: !!session,
        userEmail: session?.user?.email,
        timestamp: new Date().toISOString(),
      });

      this.handleAuthStateChange(event, session);
    });

    // Store the unsubscribe function
    this.authUnsubscribe = () => subscription.unsubscribe();
  }

  /**
   * Handle auth state changes
   */
  private handleAuthStateChange(event: string, session: any): void {
    runInAction(() => {
      // Update session state
      this.session = session;

      if (session?.access_token && event === "SIGNED_IN") {
        // Handle auth-required setup
        console.log("✅ SessionManager: Session established, enabling stores");
        this.enableStores(session.access_token);
      } else if (!session?.access_token) {
        // Handle auth-required teardown
        console.log("❌ SessionManager: Session lost, disabling stores");
        this.disableStores();
      }

      // Notify callback if provided
      if (this.onSessionChange) {
        this.onSessionChange(this.session, event);
      }
    });
  }

  /**
   * Enable all registered stores with auth token
   */
  private enableStores(token: string): void {
    this.stores.forEach((store) => {
      store.enable(token);
    });
  }

  /**
   * Disable all registered stores
   */
  private disableStores(): void {
    this.stores.forEach((store) => {
      store.disable();
    });
  }

  /**
   * Refresh session from Supabase
   */
  async refreshSession(): Promise<void> {
    console.log("🔄 SessionManager: Refreshing session");

    if (!this.supabase) {
      console.log(
        "🔄 SessionManager: No Supabase client available (playground mode)",
      );
      return;
    }

    try {
      const result = await this.supabase.auth.getSession();
      console.log("🔄 SessionManager: Session refresh result:", {
        hasSession: !!result.data.session,
        userEmail: result.data.session?.user?.email,
      });

      const newSession = result.data.session;

      // Only update if session state changed
      if (!this.session && newSession) {
        runInAction(() => {
          this.session = newSession;
          console.log("🔄 SessionManager: Session set from refresh:", {
            hasSession: !!this.session,
            userEmail: this.session?.user?.email,
          });
        });
        this.enableStores(newSession.access_token);
        // Notify callback of session change
        if (this.onSessionChange) {
          this.onSessionChange(this.session, "SIGNED_IN");
        }
      } else if (this.session && !newSession) {
        runInAction(() => {
          this.session = null;
          console.log("🔄 SessionManager: Session cleared from refresh");
        });
        this.disableStores();
        // Notify callback of session change
        if (this.onSessionChange) {
          this.onSessionChange(null, "SIGNED_OUT");
        }
      } else {
        console.log("🔄 SessionManager: Session refresh - no change needed");
      }
    } catch (error) {
      console.error("🔄 SessionManager: Session refresh failed:", error);
    }
  }

  /**
   * Cleanup: unsubscribe from auth listener
   */
  dispose(): void {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }

    // Disable all stores
    this.disableStores();

    // Clear session
    this.session = null;
  }
}
