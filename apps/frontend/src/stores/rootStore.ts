import { makeAutoObservable, runInAction } from "mobx";
import { PostStore } from "./postStore";

import { createClient } from "@/lib/supabase/browserClient";

const supabase = createClient();

export class RootStore {
  postStore: PostStore;
  session: any = null;

  constructor() {
    console.log("🔧 RootStore: Constructor called", Math.random());

    this.postStore = new PostStore(this);
    this.session = null;

    // Make session observable before setting up auth listener
    makeAutoObservable(this, {
      session: true, // Ensure session is observable
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
          console.log("✅ RootStore: Session established");
        } else if (!session?.access_token) {
          // Handle auth-required teardown here
          console.log("❌ RootStore: Session lost");
        }
      });
    });

    console.log("🔧 RootStore: Initialized");
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
      } else if (this.session && !result.data.session) {
        runInAction(() => {
          this.session = null;
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
