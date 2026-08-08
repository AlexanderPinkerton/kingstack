import {
  createClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/browserClient";

export type SupabaseSession = {
  access_token: string;
  user: {
    email?: string;
    id: string;
    [key: string]: any;
  };
  [key: string]: any;
} | null;

export type SessionChangeCallback = (
  session: SupabaseSession,
  event: string,
) => void;

/**
 * Authentication source for the application runtime.
 *
 * Store orchestration intentionally lives in RootStore so session changes have
 * one explicit path through the application.
 */
export class SessionManager {
  private supabase: ReturnType<typeof createClient> | null = null;
  private authUnsubscribe: (() => void) | null = null;
  private session: SupabaseSession = null;
  private initialized = false;

  constructor(
    private readonly onSessionChange: SessionChangeCallback | null = null,
  ) {}

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!isSupabaseBrowserConfigured()) {
      this.session = null;
      this.onSessionChange?.(this.session, "SUPABASE_NOT_CONFIGURED");
      return;
    }

    this.supabase = createClient();
    const supabase = this.supabase;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      this.session = session;
      this.onSessionChange?.(this.session, event);
    });

    this.authUnsubscribe = () => subscription.unsubscribe();
  }

  getSession(): SupabaseSession {
    return this.session;
  }

  async refreshSession(): Promise<void> {
    const supabase = this.supabase;
    if (!supabase) return;

    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;

    // Supabase emits TOKEN_REFRESHED through the existing auth-state listener,
    // which remains the only path that mutates application session state.
  }

  dispose(): void {
    this.authUnsubscribe?.();
    this.authUnsubscribe = null;
    this.supabase = null;
    this.session = null;
    this.initialized = false;
  }
}
