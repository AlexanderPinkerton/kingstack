import {
  defineFlags,
  isFlagValue,
  type FlagCatalog,
  type FlagDefinition,
  type FlagValue,
} from "./definitions.js";

export const DecisionStatuses = {
  Resolved: "resolved",
  Default: "default",
  Error: "error",
  Fixture: "fixture",
} as const;

export type DecisionStatus =
  (typeof DecisionStatuses)[keyof typeof DecisionStatuses];

export const SnapshotModes = {
  Enabled: "enabled",
  Disabled: "disabled",
  Fixture: "fixture",
} as const;

export type SnapshotMode = (typeof SnapshotModes)[keyof typeof SnapshotModes];

export const SNAPSHOT_VERSION = 1;

export interface FlagDecision<T extends boolean | string = boolean | string> {
  readonly value: T;
  readonly status: DecisionStatus;
}
export interface FlagSnapshot {
  readonly version: typeof SNAPSHOT_VERSION;
  /** A browser-safe identifier for the identity AND relevant targeting revision. Not an auth credential. */
  readonly scope: string;
  readonly mode: SnapshotMode;
  readonly evaluatedAt: number;
  readonly flags: Readonly<Record<string, FlagDecision>>;
}
export interface SnapshotLoadRequest {
  readonly scope: string;
  readonly signal: AbortSignal;
}
export type SnapshotLoader = (request: SnapshotLoadRequest) => Promise<unknown>;

export function defaultSnapshot(
  catalog: FlagCatalog,
  scope: string,
  mode: SnapshotMode = SnapshotModes.Disabled,
  status: DecisionStatus = DecisionStatuses.Default,
): FlagSnapshot {
  const entries: [string, FlagDecision][] = [];
  for (const flag of clientFlags(catalog)) {
    entries.push([
      flag.key,
      Object.freeze({ value: flag.defaultValue, status }),
    ]);
  }
  return Object.freeze({
    version: SNAPSHOT_VERSION,
    scope,
    mode,
    evaluatedAt: Date.now(),
    flags: Object.freeze(Object.fromEntries(entries)),
  });
}

/** Validate the envelope, sanitize each assignment, and strip unknown/server-only keys. */
export function parseSnapshot(
  raw: unknown,
  catalog: FlagCatalog,
  scope: string,
): FlagSnapshot {
  if (
    !record(raw) ||
    raw.version !== SNAPSHOT_VERSION ||
    raw.scope !== scope ||
    (raw.mode !== SnapshotModes.Enabled &&
      raw.mode !== SnapshotModes.Disabled &&
      raw.mode !== SnapshotModes.Fixture) ||
    typeof raw.evaluatedAt !== "number" ||
    !Number.isFinite(raw.evaluatedAt) ||
    raw.evaluatedAt < 0 ||
    !record(raw.flags)
  ) {
    throw new Error("Invalid feature flag snapshot or scope mismatch");
  }
  const mode = raw.mode;
  const values = raw.flags;
  const entries: [string, FlagDecision][] = [];
  for (const flag of clientFlags(catalog)) {
    let candidate: unknown;
    if (Object.hasOwn(values, flag.key)) {
      candidate = values[flag.key];
    }
    let decision: FlagDecision = {
      value: flag.defaultValue,
      status: DecisionStatuses.Error,
    };
    if (mode === SnapshotModes.Disabled) {
      decision = {
        value: flag.defaultValue,
        status: DecisionStatuses.Default,
      };
    } else if (record(candidate) && isFlagValue(flag, candidate.value)) {
      if (mode === SnapshotModes.Fixture) {
        decision = {
          value: candidate.value,
          status: DecisionStatuses.Fixture,
        };
      } else if (candidate.status === DecisionStatuses.Resolved) {
        decision = {
          value: candidate.value,
          status: DecisionStatuses.Resolved,
        };
      } else if (candidate.status === DecisionStatuses.Default) {
        decision = {
          value: candidate.value,
          status: DecisionStatuses.Default,
        };
      }
    }
    entries.push([flag.key, Object.freeze(decision)]);
  }
  return Object.freeze({
    version: SNAPSHOT_VERSION,
    scope,
    mode,
    evaluatedAt: raw.evaluatedAt,
    flags: Object.freeze(Object.fromEntries(entries)),
  });
}

export function snapshotDecision<F extends FlagDefinition>(
  snapshot: FlagSnapshot | null,
  flag: F,
): FlagDecision<FlagValue<F>> {
  const fallback = {
    value: flag.defaultValue,
    status: DecisionStatuses.Default,
  };
  if (
    !flag.clientVisible ||
    !snapshot ||
    !Object.hasOwn(snapshot.flags, flag.key)
  ) {
    return fallback;
  }

  const decision = snapshot.flags[flag.key];
  if (!decision || !isFlagValue(flag, decision.value)) {
    return fallback;
  }
  return decision;
}

export function clientFlags(catalog: FlagCatalog): FlagDefinition[] {
  const flags: FlagDefinition[] = [];
  for (const flag of Object.values(defineFlags(catalog))) {
    if (flag.clientVisible) flags.push(flag);
  }
  return flags;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
