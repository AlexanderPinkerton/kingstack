import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseSession } from "@/lib/session-manager";
import type { RealtimeTransport } from "@/lib/realtime-manager";
import { createHttpPostRepository } from "@/repositories/posts/http-post-repository";
import { AdvancedPostStore } from "./postStore";
import { OptimisticPostDemoController } from "./optimisticPostDemoController";
import { RealtimeCheckboxStore } from "./checkboxStore";
import { CurrentUserStore } from "./currentUserStore";
import { PublicTodoStore } from "./publicTodoStore";
import {
  SharedCursorStore,
  worldProjection,
  type SharedCursorStoreOptions,
} from "./sharedCursorStore";
import { CANVAS_WORLD } from "@/lib/realtime/canvas-world";

interface UserStoreManagerOptions {
  queryClient: QueryClient;
  browserId: string;
  realtimeSource: RealtimeTransport;
}

/**
 * Typed container for user-facing stores.
 *
 * Store instances are cheap and are created together. Each store independently
 * controls when its query is active, so construction never implies fetching.
 */
export class UserStoreManager {
  readonly postStore: AdvancedPostStore;
  readonly optimisticPostDemoController: OptimisticPostDemoController;
  readonly checkboxStore: RealtimeCheckboxStore;
  readonly publicTodoStore: PublicTodoStore;
  readonly currentUserStore: CurrentUserStore;

  private readonly realtimeSource: RealtimeTransport;
  private readonly cursorStores = new Map<string, SharedCursorStore>();
  private releaseCurrentUser: (() => void) | null = null;
  private isDisposed = false;

  constructor({
    queryClient,
    browserId,
    realtimeSource,
  }: UserStoreManagerOptions) {
    this.realtimeSource = realtimeSource;
    this.optimisticPostDemoController = new OptimisticPostDemoController(
      createHttpPostRepository(),
    );
    this.postStore = new AdvancedPostStore(
      queryClient,
      this.optimisticPostDemoController.repository,
    );
    this.optimisticPostDemoController.attachStore(this.postStore);
    this.checkboxStore = new RealtimeCheckboxStore(
      queryClient,
      realtimeSource,
      browserId,
    );
    this.publicTodoStore = new PublicTodoStore(queryClient);
    this.currentUserStore = new CurrentUserStore(queryClient);
  }

  /**
   * Cursor rooms are scoped per surface rather than per app, so they are made
   * on demand. One store is shared by every consumer of the same room; the
   * manager keeps them so page unmounts cannot leak a socket subscription.
   *
   * Positions are fractions of the bound surface, which only agree between
   * clients rendering the same layout. Use `canvasCursorStore` for a surface
   * that needs to agree across devices.
   */
  cursorStore(scope: string): SharedCursorStore {
    return this.sharedCursorStore(`cursors:${scope}`);
  }

  /** Positions are absolute units in the fixed canvas world. */
  canvasCursorStore(scope: string): SharedCursorStore {
    return this.sharedCursorStore(`canvas:${scope}`, {
      projection: worldProjection(CANVAS_WORLD.width, CANVAS_WORLD.height),
    });
  }

  private sharedCursorStore(
    roomId: string,
    options?: SharedCursorStoreOptions,
  ): SharedCursorStore {
    const existing = this.cursorStores.get(roomId);
    if (existing) return existing;

    const store = new SharedCursorStore(this.realtimeSource, roomId, options);
    this.cursorStores.set(roomId, store);
    return store;
  }

  updateSession(session: SupabaseSession): void {
    if (this.isDisposed) return;

    this.postStore.setContext({
      scope: session?.user.id ?? "anonymous",
      enabled: Boolean(session?.access_token),
      accessToken: session?.access_token,
      currentUser: session?.user ?? null,
    });
    this.currentUserStore.setSession(session);

    const shouldLoadCurrentUser = Boolean(session?.access_token);

    if (shouldLoadCurrentUser && !this.releaseCurrentUser) {
      this.releaseCurrentUser = this.currentUserStore.activate();
    } else if (!shouldLoadCurrentUser && this.releaseCurrentUser) {
      this.releaseCurrentUser();
      this.releaseCurrentUser = null;
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.releaseCurrentUser?.();
    this.releaseCurrentUser = null;

    this.optimisticPostDemoController.dispose();
    this.postStore.dispose();
    this.checkboxStore.dispose();
    this.publicTodoStore.dispose();
    this.currentUserStore.dispose();
    this.cursorStores.forEach((store) => store.dispose());
    this.cursorStores.clear();
  }
}
