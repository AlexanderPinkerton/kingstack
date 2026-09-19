import type {
  Client,
  EvaluationContext,
  EvaluationDetails,
  StandardResolutionReasons,
} from "@openfeature/server-sdk";
import {
  FlagKinds,
  isFlagValue,
  type FlagCatalog,
  type FlagDefinition,
  type FlagValue,
} from "./definitions.js";
import {
  DecisionStatuses,
  SnapshotModes,
  SNAPSHOT_VERSION,
  type DecisionStatus,
  clientFlags,
  defaultSnapshot,
  type FlagDecision,
  type FlagSnapshot,
} from "./snapshot.js";
import {
  DeadlineError,
  positiveInteger,
  report,
  withinDeadline,
} from "./async.js";

export type { EvaluationContext } from "@openfeature/server-sdk";

export const EvaluationReasons = {
  Provider: "provider",
  Disabled: "disabled",
  ProviderDefault: "provider-default",
  InvalidValue: "invalid-value",
  ProviderError: "provider-error",
  Timeout: "timeout",
} as const;

export type EvaluationReason =
  (typeof EvaluationReasons)[keyof typeof EvaluationReasons];

// Type-check the protocol values against the SDK without loading an optional
// runtime dependency when evaluation is disabled.
const OpenFeatureReasons = {
  ERROR: "ERROR",
  STALE: "STALE",
  DEFAULT: "DEFAULT",
  DISABLED: "DISABLED",
} as const satisfies Partial<typeof StandardResolutionReasons>;

const DEFAULT_EVALUATION_TIMEOUT_MS = 1500;
const DEFAULT_MAX_SNAPSHOT_FLAGS = 16;
const DEFAULT_EVALUATION_CONCURRENCY = 4;

export interface EvaluationDiagnostic {
  flagKey: string;
  status: Exclude<DecisionStatus, typeof DecisionStatuses.Fixture>;
  reason: EvaluationReason;
  durationMs: number;
}
export interface EvaluatorOptions {
  /** null is deliberately disabled. Create the client only in the enabled config branch. */
  client: Pick<Client, "getBooleanDetails" | "getStringDetails"> | null;
  timeoutMs?: number;
  maxSnapshotFlags?: number;
  concurrency?: number;
  onEvaluation?: (event: EvaluationDiagnostic) => void;
}
export interface SnapshotContext {
  scope: string;
  context: EvaluationContext;
}

/** Borrows an application-owned OpenFeature client. Never changes its context or shuts it down. */
export function createFlagEvaluator(options: EvaluatorOptions) {
  options = Object.freeze({ ...options });
  const timeoutMs = positiveInteger(
    options.timeoutMs ?? DEFAULT_EVALUATION_TIMEOUT_MS,
    "timeoutMs",
  );
  const maxFlags = positiveInteger(
    options.maxSnapshotFlags ?? DEFAULT_MAX_SNAPSHOT_FLAGS,
    "maxSnapshotFlags",
  );
  const concurrency = positiveInteger(
    options.concurrency ?? DEFAULT_EVALUATION_CONCURRENCY,
    "concurrency",
  );

  async function details<F extends FlagDefinition>(
    flag: F,
    context: EvaluationContext,
    budget = timeoutMs,
  ): Promise<FlagDecision<FlagValue<F>>> {
    const started = Date.now();
    let reason: EvaluationReason = EvaluationReasons.Disabled;
    let decision: FlagDecision = {
      value: flag.defaultValue,
      status: DecisionStatuses.Default,
    };
    if (options.client) {
      try {
        if (budget <= 0) throw new DeadlineError();
        let request: Promise<EvaluationDetails<boolean | string>>;
        if (flag.kind === FlagKinds.Boolean) {
          request = options.client.getBooleanDetails(
            flag.key,
            flag.defaultValue,
            context,
          );
        } else {
          request = options.client.getStringDetails(
            flag.key,
            flag.defaultValue,
            context,
          );
        }
        const result = await withinDeadline(request, budget);
        if (
          result.errorCode ||
          result.reason === OpenFeatureReasons.ERROR ||
          result.reason === OpenFeatureReasons.STALE
        ) {
          reason = EvaluationReasons.ProviderError;
          decision = {
            value: flag.defaultValue,
            status: DecisionStatuses.Error,
          };
        } else if (!isFlagValue(flag, result.value)) {
          reason = EvaluationReasons.InvalidValue;
          decision = {
            value: flag.defaultValue,
            status: DecisionStatuses.Error,
          };
        } else if (
          result.reason === OpenFeatureReasons.DEFAULT ||
          result.reason === OpenFeatureReasons.DISABLED
        ) {
          reason = EvaluationReasons.ProviderDefault;
          decision = { value: result.value, status: DecisionStatuses.Default };
        } else {
          reason = EvaluationReasons.Provider;
          decision = { value: result.value, status: DecisionStatuses.Resolved };
        }
      } catch (error) {
        reason = EvaluationReasons.ProviderError;
        if (error instanceof DeadlineError) {
          reason = EvaluationReasons.Timeout;
        }
        decision = { value: flag.defaultValue, status: DecisionStatuses.Error };
      }
    }
    report(options.onEvaluation, {
      flagKey: flag.key,
      status: decision.status as EvaluationDiagnostic["status"],
      reason,
      durationMs: Date.now() - started,
    });
    return Object.freeze(decision);
  }

  return Object.freeze({
    enabled: options.client !== null,
    evaluateDetails: details,
    async evaluate<F extends FlagDefinition>(
      flag: F,
      context: EvaluationContext = {},
    ): Promise<FlagValue<F>> {
      return (await details(flag, context)).value;
    },
    async snapshot(
      catalog: FlagCatalog,
      { scope, context }: SnapshotContext,
    ): Promise<FlagSnapshot> {
      if (!scope.trim()) throw new Error("Snapshot scope must be nonempty");
      const flags = clientFlags(catalog);
      if (flags.length > maxFlags)
        throw new Error(`Snapshot exceeds ${maxFlags} client-visible flags`);
      if (!options.client) return defaultSnapshot(catalog, scope);
      const deadline = Date.now() + timeoutMs;
      const entries: [string, FlagDecision][] = [];
      let cursor = 0;

      async function evaluateRemainingFlags(): Promise<void> {
        while (cursor < flags.length) {
          const flag = flags[cursor++];
          const decision = await details(flag, context, deadline - Date.now());
          entries.push([flag.key, decision]);
        }
      }

      const workers: Promise<void>[] = [];
      const workerCount = Math.min(concurrency, flags.length);
      for (let worker = 0; worker < workerCount; worker++) {
        workers.push(evaluateRemainingFlags());
      }
      await Promise.all(workers);
      return Object.freeze({
        version: SNAPSHOT_VERSION,
        scope,
        mode: SnapshotModes.Enabled,
        evaluatedAt: Date.now(),
        flags: Object.freeze(Object.fromEntries(entries)),
      });
    },
  });
}

export type FlagEvaluator = ReturnType<typeof createFlagEvaluator>;

export const SNAPSHOT_CACHE_CONTROL = "private, no-store";

/** A standard Request/Response handler; directly usable as a Next GET route. */
export function createSnapshotHandler(options: {
  evaluator: FlagEvaluator;
  catalog: FlagCatalog;
  /** Verify identity here. null returns 401; thrown auth errors remain host errors. */
  resolveContext: (request: Request) => Promise<SnapshotContext | null>;
}) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      "Cache-Control": SNAPSHOT_CACHE_CONTROL,
      Vary: "Authorization, Cookie",
    };
    if (request.method !== "GET")
      return new Response(null, {
        status: 405,
        headers: { ...headers, Allow: "GET" },
      });
    const context = await options.resolveContext(request);
    if (!context) return new Response(null, { status: 401, headers });
    return Response.json(
      await options.evaluator.snapshot(options.catalog, context),
      { headers },
    );
  };
}
