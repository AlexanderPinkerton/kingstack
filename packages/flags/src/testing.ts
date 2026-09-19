import {
  isFlagValue,
  type FlagCatalog,
  type FlagValue,
} from "./definitions.js";
import {
  DecisionStatuses,
  SnapshotModes,
  SNAPSHOT_VERSION,
  clientFlags,
  type FlagDecision,
  type FlagSnapshot,
  type SnapshotLoader,
} from "./snapshot.js";

export type FixtureValues<C extends FlagCatalog> = {
  [K in keyof C]?: FlagValue<C[K]>;
};

/** Overrides use catalog property names. Fixture decisions are never production assignments. */
export function createFixtureSnapshot<C extends FlagCatalog>(
  catalog: C,
  scope: string,
  values: FixtureValues<C> = {},
): FlagSnapshot {
  const byKey = new Map<string, boolean | string>();
  for (const name of Object.keys(values)) {
    if (
      !Object.hasOwn(catalog, name) ||
      !isFlagValue(catalog[name], values[name])
    ) {
      throw new Error(`Invalid flag fixture: ${name}`);
    }
    byKey.set(catalog[name].key, values[name]);
  }
  const entries: [string, FlagDecision][] = [];
  for (const flag of clientFlags(catalog)) {
    entries.push([
      flag.key,
      Object.freeze({
        value: byKey.get(flag.key) ?? flag.defaultValue,
        status: DecisionStatuses.Fixture,
      }),
    ]);
  }
  return Object.freeze({
    version: SNAPSHOT_VERSION,
    scope,
    mode: SnapshotModes.Fixture,
    evaluatedAt: Date.now(),
    flags: Object.freeze(Object.fromEntries(entries)),
  });
}

export function createFixtureLoader<C extends FlagCatalog>(
  catalog: C,
  values: FixtureValues<C> = {},
): SnapshotLoader {
  return ({ scope }) =>
    Promise.resolve(createFixtureSnapshot(catalog, scope, values));
}
