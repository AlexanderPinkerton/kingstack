import { computed, makeObservable, observable, runInAction } from "mobx";
import type {
  PostCreateInput,
  PostRepository,
  PostUpdateInput,
} from "@/repositories/posts/types";
import type { AdvancedPostStore } from "./postStore";

export type OptimisticDemoOperation = "create" | "update" | "remove";
export type OptimisticDemoPipelineStatus =
  "pending" | "confirmed" | "rolled_back";
export type OptimisticDemoPipelineDirection = "outbound" | "return";

export interface OptimisticDemoPipelineRun {
  id: number;
  operation: OptimisticDemoOperation;
  status: OptimisticDemoPipelineStatus;
  /** Edge currently being traversed, indexed from the UI end of the pipeline. */
  edgeIndex: number;
  direction: OptimisticDemoPipelineDirection;
  result: Exclude<OptimisticDemoPipelineStatus, "pending"> | null;
  label: string;
  willReject: boolean;
  /** Duration of one pipeline edge for this run; 0 means no visible travel. */
  stepMs: number;
}

const DEFAULT_DELAY_MS = 1000;

/**
 * Edges between the pipeline's five nodes:
 * UI → MobX → transformer → TanStack Query → API.
 *
 * Must match the node list the diagram renders.
 */
export const OPTIMISTIC_PIPELINE_EDGES = 4;

/**
 * A round trip crosses every edge twice. The visualisation spans the configured
 * latency, so each edge takes `networkDelayMs / OPTIMISTIC_PIPELINE_STEPS` and a
 * latency of "None" plays out with no visible travel at all.
 */
export const OPTIMISTIC_PIPELINE_STEPS = OPTIMISTIC_PIPELINE_EDGES * 2;

/**
 * Edge between MobX and the transformer. The returning response is handed to
 * the store once the blip has crossed it, because that write is what clears the
 * optimistic layer — anything below this edge is the store talking to the
 * network, anything above it is the interface reacting.
 */
const OPTIMISTIC_PIPELINE_STORE_EDGE = 1;

export class OptimisticPostDemoController {
  networkDelayMs = DEFAULT_DELAY_MS;
  failureArmed = false;
  activeMutationCount = 0;
  pipelineRun: OptimisticDemoPipelineRun | null = null;

  readonly repository: PostRepository;

  private store: AdvancedPostStore | null = null;
  private runSequence = 0;
  private rejectingRunId: number | null = null;
  private rejectedAttempts = 0;
  private pipelineOutboundReadyAt = 0;
  private pipelineTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly source: PostRepository) {
    this.repository = {
      list: (context) => this.source.list(context),
      create: (data, context) =>
        this.executeRequest(() => this.source.create(data, context)),
      update: (params, context) =>
        this.executeRequest(() => this.source.update(params, context)),
      remove: (id, context) =>
        this.executeRequest(() => this.source.remove(id, context)),
    };

    makeObservable(this, {
      networkDelayMs: observable,
      failureArmed: observable,
      activeMutationCount: observable,
      pipelineRun: observable.ref,
      isMutationPending: computed,
    });
  }

  get isMutationPending(): boolean {
    return (
      this.activeMutationCount > 0 || this.pipelineRun?.status === "pending"
    );
  }

  attachStore(store: AdvancedPostStore): void {
    if (this.store && this.store !== store) {
      throw new Error("OptimisticPostDemoController already has a store");
    }
    this.store = store;
  }

  setNetworkDelay(delayMs: number): void {
    runInAction(() => {
      this.networkDelayMs = Math.max(0, Math.round(delayMs));
    });
  }

  toggleFailure(): void {
    runInAction(() => {
      this.failureArmed = !this.failureArmed;
    });
  }

  create(data: PostCreateInput): void {
    const store = this.requireStore();
    void this.runMutation("create", data.title, () => store.api.create(data));
  }

  update(id: string, data: PostUpdateInput, label: string): void {
    const store = this.requireStore();
    void this.runMutation("update", label, () => store.api.update(id, data));
  }

  remove(id: string, label: string): void {
    const store = this.requireStore();
    void this.runMutation("remove", label, () => store.api.remove(id));
  }

  dispose(): void {
    for (const timer of this.pipelineTimers) {
      clearTimeout(timer);
    }
    this.pipelineTimers.clear();
  }

  private async runMutation<T>(
    operation: OptimisticDemoOperation,
    label: string,
    mutation: () => Promise<T>,
  ): Promise<void> {
    const runId = ++this.runSequence;
    const willReject = this.failureArmed;
    // Captured per run so the visualisation matches the latency in force when
    // the mutation started, even if the setting changes before it settles.
    const stepMs = Math.max(
      0,
      Math.round(this.networkDelayMs / OPTIMISTIC_PIPELINE_STEPS),
    );

    runInAction(() => {
      this.activeMutationCount += 1;
      if (willReject) {
        this.failureArmed = false;
        this.rejectingRunId = runId;
        this.rejectedAttempts = 0;
      }
      this.pipelineRun = {
        id: runId,
        operation,
        status: "pending",
        edgeIndex: 0,
        direction: "outbound",
        result: null,
        label,
        willReject,
        stepMs,
      };
      this.pipelineOutboundReadyAt =
        Date.now() + stepMs * OPTIMISTIC_PIPELINE_EDGES;
    });
    for (let edge = 1; edge < OPTIMISTIC_PIPELINE_EDGES; edge += 1) {
      this.scheduleOutboundEdge(runId, edge, stepMs * edge);
    }

    try {
      await mutation();
      void this.settlePipeline(runId, "confirmed");
    } catch {
      void this.settlePipeline(runId, "rolled_back");
    } finally {
      if (this.rejectingRunId === runId) {
        this.rejectingRunId = null;
        this.rejectedAttempts = 0;
      }
      runInAction(() => {
        this.activeMutationCount = Math.max(0, this.activeMutationCount - 1);
      });
    }
  }

  /**
   * Wraps a single request attempt with the demo's artificial latency and
   * one-shot rejection.
   *
   * The rejection is held for the whole mutation rather than for one attempt.
   * React Query retries failed mutations (the app configures
   * `mutations: { retry: 1 }`), so an attempt-scoped flag would be spent on the
   * first try and let the retry reach the real API — the armed rejection would
   * silently succeed. `runMutation` clears the flag once the mutation settles.
   */
  private async executeRequest<T>(request: () => Promise<T>): Promise<T> {
    const reject = this.rejectingRunId !== null;
    // Only the first attempt pays the latency; retries of an already-rejected
    // mutation fail immediately so the rollback still lands promptly.
    const attempt = reject ? this.rejectedAttempts++ : 0;
    // Only the first attempt pays the latency; retries of an already-rejected
    // mutation fail immediately so the rollback still lands promptly.
    const delayMs = attempt > 0 ? 0 : this.networkDelayMs;

    if (delayMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }

    const pending = reject
      ? Promise.reject(
          new Error("Demo rejection: the next mutation was not sent"),
        )
      : request();

    // Observe the outcome without consuming it, so the original settlement —
    // value or error — is what the store eventually receives.
    let failed = false;
    await pending.catch(() => {
      failed = true;
    });

    // Walk the response back as far as the store before handing it over. The
    // store's onSuccess/onError is the MobX write, so resolving earlier would
    // clear the optimistic layer while the blip is still in transit.
    if (attempt === 0) {
      await this.playReturnToStore(failed ? "rolled_back" : "confirmed");
    }

    return pending;
  }

  /**
   * Animates the return leg from the API down to the MobX node, leaving only
   * the final store → UI edge for `settlePipeline` once the store has written.
   */
  private async playReturnToStore(
    result: Exclude<OptimisticDemoPipelineStatus, "pending">,
  ): Promise<void> {
    const id = this.pipelineRun?.id;
    if (id === undefined) return;

    await this.waitForPipeline(
      Math.max(0, this.pipelineOutboundReadyAt - Date.now()),
    );

    for (
      let edge = OPTIMISTIC_PIPELINE_EDGES - 1;
      edge >= OPTIMISTIC_PIPELINE_STORE_EDGE;
      edge -= 1
    ) {
      if (this.pipelineRun?.id !== id) return;
      const stepMs = this.pipelineRun.stepMs;

      runInAction(() => {
        if (this.pipelineRun?.id !== id) return;
        this.pipelineRun = {
          ...this.pipelineRun,
          edgeIndex: edge,
          direction: "return",
          result,
        };
      });
      await this.waitForPipeline(stepMs);
    }
  }

  private scheduleOutboundEdge(
    id: number,
    edgeIndex: number,
    delayMs: number,
  ): void {
    const timer = setTimeout(() => {
      this.pipelineTimers.delete(timer);
      runInAction(() => {
        // A zero-latency run can turn around or settle before these fire;
        // never drag a returning or finished run back down the outbound leg.
        if (this.pipelineRun?.id !== id) return;
        if (this.pipelineRun.status !== "pending") return;
        if (this.pipelineRun.direction !== "outbound") return;
        this.pipelineRun = { ...this.pipelineRun, edgeIndex };
      });
    }, delayMs);
    this.pipelineTimers.add(timer);
  }

  /**
   * Plays the last edge — the store's write reaching the components — and marks
   * the run settled. Everything above it already ran in `playReturnToStore`.
   */
  private async settlePipeline(
    id: number,
    result: Exclude<OptimisticDemoPipelineStatus, "pending">,
  ): Promise<void> {
    await this.waitForPipeline(
      Math.max(0, this.pipelineOutboundReadyAt - Date.now()),
    );
    if (this.pipelineRun?.id !== id) return;
    const stepMs = this.pipelineRun.stepMs;

    for (let edge = OPTIMISTIC_PIPELINE_STORE_EDGE - 1; edge >= 0; edge -= 1) {
      if (this.pipelineRun?.id !== id) return;
      runInAction(() => {
        if (this.pipelineRun?.id !== id) return;
        this.pipelineRun = {
          ...this.pipelineRun,
          edgeIndex: edge,
          direction: "return",
          result,
        };
      });
      await this.waitForPipeline(stepMs);
    }

    runInAction(() => {
      if (this.pipelineRun?.id !== id) return;
      this.pipelineRun = { ...this.pipelineRun, status: result };
    });
  }

  private waitForPipeline(delayMs: number): Promise<void> {
    if (delayMs <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pipelineTimers.delete(timer);
        resolve();
      }, delayMs);
      this.pipelineTimers.add(timer);
    });
  }

  private requireStore(): AdvancedPostStore {
    if (!this.store) {
      throw new Error("OptimisticPostDemoController requires a post store");
    }
    return this.store;
  }
}
