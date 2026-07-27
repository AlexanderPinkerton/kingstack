import { computed, makeObservable, observable, runInAction } from "mobx";
import type { QueryClient } from "@tanstack/react-query";
import { SessionManager, type SupabaseSession } from "@/lib/session-manager";
import { RealtimeManager } from "@/lib/realtime-manager";
import { getBrowserId } from "@/lib/browser-id";
import { UserStoreManager } from "./userApp/userStoreManager";
import { AdminStoreManager } from "./adminApp/adminStoreManager";

interface RootStoreOptions {
  queryClient: QueryClient;
}

export class RootStore {
  session: SupabaseSession = null;
  sessionReady = false;

  readonly userStore: UserStoreManager;
  readonly adminStore: AdminStoreManager;
  readonly browserId: string;

  private readonly sessionManager: SessionManager;
  private readonly realtimeManager: RealtimeManager;
  private started = false;
  private disposed = false;
  private mounts = 0;
  private disposalGeneration = 0;

  constructor({ queryClient }: RootStoreOptions) {
    this.browserId = getBrowserId();

    this.userStore = new UserStoreManager({
      queryClient,
      browserId: this.browserId,
    });
    this.adminStore = new AdminStoreManager(queryClient);

    this.realtimeManager = new RealtimeManager({
      browserId: this.browserId,
    });
    this.userStore.registerRealtime(this.realtimeManager);

    this.sessionManager = new SessionManager((session) =>
      this.handleSessionChange(session),
    );

    makeObservable(this, {
      session: observable,
      sessionReady: observable,
      userData: computed,
    });
  }

  /**
   * React lifecycle adapter. Final disposal is deferred by one microtask so
   * React Strict Mode's setup/cleanup/setup probe reuses the same live runtime.
   */
  mount(): () => void {
    if (this.disposed) {
      throw new Error("Cannot mount a disposed RootStore");
    }

    this.mounts += 1;
    this.disposalGeneration += 1;
    this.start();

    let released = false;
    return () => {
      if (released || this.disposed) return;
      released = true;
      this.mounts = Math.max(0, this.mounts - 1);

      if (this.mounts !== 0) return;

      const generation = ++this.disposalGeneration;
      queueMicrotask(() => {
        if (
          !this.disposed &&
          this.mounts === 0 &&
          this.disposalGeneration === generation
        ) {
          this.dispose();
        }
      });
    };
  }

  start(): void {
    if (this.disposed) {
      throw new Error("Cannot start a disposed RootStore");
    }
    if (this.started) return;

    this.started = true;
    this.sessionManager.initialize();
  }

  get socket() {
    return this.realtimeManager.getSocket();
  }

  async refreshSession(): Promise<void> {
    await this.sessionManager.refreshSession();
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.started = false;
    this.mounts = 0;
    this.disposalGeneration += 1;

    this.sessionManager.dispose();
    this.realtimeManager.dispose();
    this.userStore.dispose();
    this.adminStore.dispose();

    runInAction(() => {
      this.session = null;
      this.sessionReady = false;
    });
  }

  get userData() {
    return this.userStore.currentUserStore.currentUser;
  }

  private handleSessionChange(session: SupabaseSession): void {
    if (this.disposed) return;

    runInAction(() => {
      this.session = session;
      this.sessionReady = true;
    });

    // Inactive feature queries remain inactive; session propagation only
    // updates their authorization and cache identity.
    this.userStore.updateSession(session);
    this.adminStore.updateSession(session);

    if (session?.access_token) {
      this.realtimeManager.setup(session.access_token);
    } else {
      this.realtimeManager.teardown();
    }
  }
}
