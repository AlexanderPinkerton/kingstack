import { makeAutoObservable, observable, runInAction } from "mobx";
import {
  defineFlags,
  type FlagCatalog,
  type FlagDefinition,
  type FlagValue,
} from "./definitions.js";
import {
  DecisionStatuses,
  SnapshotModes,
  defaultSnapshot,
  parseSnapshot,
  snapshotDecision,
  type FlagDecision,
  type FlagSnapshot,
  type SnapshotLoader,
} from "./snapshot.js";
import {
  DeadlineError,
  positiveInteger,
  report,
  withinDeadline,
} from "./async.js";

export const FeatureFlagStoreStatuses = {
  Idle: "idle",
  Loading: "loading",
  Ready: "ready",
  Degraded: "degraded",
  Disabled: "disabled",
} as const;

export type FeatureFlagStoreStatus =
  (typeof FeatureFlagStoreStatuses)[keyof typeof FeatureFlagStoreStatuses];

export const SnapshotFailureReasons = {
  LoadError: "load-error",
  Timeout: "timeout",
} as const;

export type SnapshotFailureReason =
  (typeof SnapshotFailureReasons)[keyof typeof SnapshotFailureReasons];

const DEFAULT_LOAD_TIMEOUT_MS = 5000;
const DEFAULT_REFRESH_INTERVAL_MS = 0;

export interface SnapshotDiagnostic {
  reason: SnapshotFailureReason;
}
export interface FeatureFlagStoreOptions {
  catalog: FlagCatalog;
  enabled?: boolean;
  loadSnapshot?: SnapshotLoader;
  /** null means identity is not ready. Include relevant targeting revisions in the scope. */
  scope?: string | null;
  initialSnapshot?: unknown;
  /** No background polling by default. Explicit refresh and scope changes still load. */
  refreshIntervalMs?: number;
  timeoutMs?: number;
  onError?: (event: SnapshotDiagnostic) => void;
}

/** Pure TypeScript lifecycle and state. Construction and reads never perform I/O. */
export class FeatureFlagStore {
  private currentSnapshot: FlagSnapshot | null = null;
  private currentScope: string | null;
  private remoteDisabled = false;
  private loading = false;
  private disposed = false;
  private leases = 0;
  private generation = 0;
  private pending: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly catalog: FlagCatalog;
  private readonly timeoutMs: number;
  private readonly refreshIntervalMs: number;

  constructor(private readonly options: FeatureFlagStoreOptions) {
    this.options = Object.freeze({ ...options });
    this.catalog = defineFlags(options.catalog);
    this.currentScope = options.scope ?? null;
    this.timeoutMs = positiveInteger(
      options.timeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS,
      "timeoutMs",
    );
    this.refreshIntervalMs =
      options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    if (this.refreshIntervalMs !== 0)
      positiveInteger(this.refreshIntervalMs, "refreshIntervalMs");
    if (options.enabled && !options.loadSnapshot)
      throw new Error("Enabled flags require a snapshot loader");
    if (this.currentScope !== null && !this.currentScope.trim())
      throw new Error("Snapshot scope must be nonempty");
    if (
      options.enabled &&
      options.initialSnapshot !== undefined &&
      this.currentScope !== null
    ) {
      this.currentSnapshot = parseSnapshot(
        options.initialSnapshot,
        this.catalog,
        this.currentScope,
      );
      this.remoteDisabled =
        this.currentSnapshot.mode === SnapshotModes.Disabled;
    }
    makeAutoObservable<
      this,
      | "options"
      | "catalog"
      | "timeoutMs"
      | "refreshIntervalMs"
      | "leases"
      | "generation"
      | "pending"
      | "controller"
      | "timer"
      | "currentSnapshot"
    >(
      this,
      {
        options: false,
        catalog: false,
        timeoutMs: false,
        refreshIntervalMs: false,
        leases: false,
        generation: false,
        pending: false,
        controller: false,
        timer: false,
        currentSnapshot: observable.ref,
      },
      { autoBind: true },
    );
  }

  get enabled(): boolean {
    return Boolean(this.options.enabled) && !this.remoteDisabled;
  }
  get scope(): string | null {
    return this.currentScope;
  }
  get snapshot(): FlagSnapshot | null {
    return this.currentSnapshot;
  }
  get refreshing(): boolean {
    return this.loading;
  }
  get ready(): boolean {
    return !this.enabled || this.currentSnapshot !== null;
  }
  get status(): FeatureFlagStoreStatus {
    if (!this.enabled) return FeatureFlagStoreStatuses.Disabled;
    if (!this.currentSnapshot) {
      if (this.loading) return FeatureFlagStoreStatuses.Loading;
      return FeatureFlagStoreStatuses.Idle;
    }
    for (const decision of Object.values(this.currentSnapshot.flags)) {
      if (decision.status === DecisionStatuses.Error)
        return FeatureFlagStoreStatuses.Degraded;
    }
    return FeatureFlagStoreStatuses.Ready;
  }

  get<F extends FlagDefinition>(flag: F): FlagValue<F> {
    return this.getDecision(flag).value;
  }

  getDecision<F extends FlagDefinition>(flag: F): FlagDecision<FlagValue<F>> {
    if (!this.enabled) return snapshotDecision(null, flag);
    return snapshotDecision(this.currentSnapshot, flag);
  }

  /** Idempotent release; deferred final cleanup tolerates React's setup/cleanup/setup replay. */
  acquire(): () => void {
    if (this.disposed) throw new Error("FeatureFlagStore has been disposed");
    this.leases++;
    if (this.leases === 1) void this.refresh();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.leases = Math.max(0, this.leases - 1);
      if (this.leases === 0)
        queueMicrotask(() => {
          if (this.leases === 0) runInAction(() => this.cancel());
        });
    };
  }

  /** Clear immediately, even while inactive. Token renewal alone should not change scope. */
  setScope(scope: string | null): void {
    if (scope !== null && !scope.trim())
      throw new Error("Snapshot scope must be nonempty");
    if (this.disposed || scope === this.currentScope) return;
    this.cancel();
    this.currentScope = scope;
    this.currentSnapshot = null;
    if (this.leases > 0) void this.refresh();
  }

  refresh(): Promise<void> {
    if (
      this.disposed ||
      !this.enabled ||
      this.leases === 0 ||
      this.currentScope === null
    )
      return Promise.resolve();
    if (this.pending) return this.pending;
    this.clearTimer();
    const scope = this.currentScope;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.loading = true;
    const load = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error("Flag request cancelled");
      return this.options.loadSnapshot!({ scope, signal: controller.signal });
    });
    this.pending = withinDeadline(load, this.timeoutMs, controller.signal)
      .then((raw) => {
        if (generation !== this.generation || this.disposed) return;
        const snapshot = parseSnapshot(raw, this.catalog, scope);
        runInAction(() => {
          this.currentSnapshot = snapshot;
          this.remoteDisabled = snapshot.mode === SnapshotModes.Disabled;
        });
      })
      .catch((error: unknown) => {
        if (generation !== this.generation || this.disposed) return;
        controller.abort();
        runInAction(() => {
          this.currentSnapshot = defaultSnapshot(
            this.catalog,
            scope,
            SnapshotModes.Enabled,
            DecisionStatuses.Error,
          );
        });
        let reason: SnapshotFailureReason = SnapshotFailureReasons.LoadError;
        if (error instanceof DeadlineError) {
          reason = SnapshotFailureReasons.Timeout;
        }
        report(this.options.onError, { reason });
      })
      .finally(() => {
        if (generation !== this.generation || this.disposed) return;
        runInAction(() => {
          this.loading = false;
          this.pending = null;
          this.controller = null;
          if (this.enabled && this.leases > 0 && this.refreshIntervalMs > 0) {
            this.timer = setTimeout(() => {
              void this.refresh();
            }, this.refreshIntervalMs);
          }
        });
      });
    return this.pending;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.leases = 0;
    this.cancel();
    this.currentSnapshot = null;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private cancel(): void {
    this.generation++;
    this.clearTimer();
    this.controller?.abort();
    this.controller = null;
    this.pending = null;
    this.loading = false;
  }
}
