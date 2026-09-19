import {
  booleanFlag,
  defineFlags,
  variantFlag,
  DecisionStatuses,
  SnapshotModes,
  SNAPSHOT_VERSION,
} from "../src/index.js";
import type { FlagSnapshot } from "../src/index.js";

export const flags = defineFlags({
  dashboard: booleanFlag({
    key: "new-dashboard",
    description: "New dashboard",
    defaultValue: false,
    clientVisible: true,
  }),
  layout: variantFlag({
    key: "layout",
    description: "Layout experiment",
    variants: ["control", "compact"],
    defaultValue: "control",
    clientVisible: true,
  }),
  worker: booleanFlag({
    key: "private-worker",
    description: "Backend worker",
    defaultValue: true,
  }),
});

export function snapshot(scope = "user-a", enabled = true): FlagSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    scope,
    mode: SnapshotModes.Enabled,
    evaluatedAt: 100,
    flags: {
      "new-dashboard": { value: enabled, status: DecisionStatuses.Resolved },
      layout: { value: "compact", status: DecisionStatuses.Resolved },
    },
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
