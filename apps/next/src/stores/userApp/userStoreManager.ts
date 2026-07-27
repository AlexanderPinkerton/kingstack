import type { QueryClient } from "@tanstack/react-query";
import { isPlaygroundMode } from "@kingstack/shared";
import type { SupabaseSession } from "@/lib/session-manager";
import { RealtimeManager, type RealtimeStore } from "@/lib/realtime-manager";
import { AdvancedPostStore } from "./postStore";
import { RealtimeCheckboxStore } from "./checkboxStore";
import { CurrentUserStore } from "./currentUserStore";
import { PublicTodoStore } from "./publicTodoStore";

interface UserStoreManagerOptions {
  queryClient: QueryClient;
  browserId: string;
}

/**
 * Typed container for user-facing stores.
 *
 * Store instances are cheap and are created together. Each store independently
 * controls when its query is active, so construction never implies fetching.
 */
export class UserStoreManager {
  readonly postStore: AdvancedPostStore;
  readonly checkboxStore: RealtimeCheckboxStore;
  readonly publicTodoStore: PublicTodoStore;
  readonly currentUserStore: CurrentUserStore;

  private realtimeManager: RealtimeManager | null = null;
  private releaseCurrentUser: (() => void) | null = null;
  private isDisposed = false;

  constructor({ queryClient, browserId }: UserStoreManagerOptions) {
    this.postStore = new AdvancedPostStore(queryClient);
    this.checkboxStore = new RealtimeCheckboxStore(queryClient, browserId);
    this.publicTodoStore = new PublicTodoStore(queryClient);
    this.currentUserStore = new CurrentUserStore(queryClient);
  }

  updateSession(session: SupabaseSession): void {
    if (this.isDisposed) return;

    this.postStore.setSession(session);
    this.currentUserStore.setSession(session);

    const shouldLoadCurrentUser =
      Boolean(session?.access_token) || isPlaygroundMode();

    if (shouldLoadCurrentUser && !this.releaseCurrentUser) {
      this.releaseCurrentUser = this.currentUserStore.activate();
    } else if (!shouldLoadCurrentUser && this.releaseCurrentUser) {
      this.releaseCurrentUser();
      this.releaseCurrentUser = null;
    }
  }

  getRealtimeStores(): RealtimeStore[] {
    return [this.checkboxStore];
  }

  registerRealtime(realtimeManager: RealtimeManager): void {
    if (this.realtimeManager === realtimeManager) return;

    if (this.realtimeManager) {
      this.realtimeManager.unregisterStores(this.getRealtimeStores());
    }

    this.realtimeManager = realtimeManager;
    realtimeManager.registerStores(this.getRealtimeStores());
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.releaseCurrentUser?.();
    this.releaseCurrentUser = null;

    if (this.realtimeManager) {
      this.realtimeManager.unregisterStores(this.getRealtimeStores());
      this.realtimeManager = null;
    }

    this.postStore.dispose();
    this.checkboxStore.dispose();
    this.publicTodoStore.dispose();
    this.currentUserStore.dispose();
  }
}
