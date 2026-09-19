import { describe, expect, it } from "vitest";
import {
  DecisionStatuses,
  SnapshotModes,
  booleanFlag,
  defineFlags,
  parseSnapshot,
  variantFlag,
} from "../src/index.js";
import { createFixtureSnapshot } from "../src/testing.js";
import { flags, snapshot } from "./fixtures.js";

describe("catalog and snapshot boundary", () => {
  it("rejects duplicate provider keys and malformed runtime definitions", () => {
    expect(() =>
      defineFlags({ a: flags.dashboard, b: flags.dashboard }),
    ).toThrow("Duplicate");
    expect(() =>
      variantFlag({
        key: "a",
        description: "a",
        variants: ["a", "a"],
        defaultValue: "a",
      }),
    ).toThrow("variants");
    expect(() =>
      defineFlags({ bad: { ...flags.layout, defaultValue: "unknown" } }),
    ).toThrow("default");
    expect(() =>
      booleanFlag({ key: "", description: "x", defaultValue: false }),
    ).toThrow("keys");
    expect(Object.isFrozen(flags.layout.variants)).toBe(true);
  });

  it("removes private keys, unknown fields, and targeting data", () => {
    const raw = {
      ...snapshot(),
      secret: "credential",
      context: { email: "private" },
      flags: {
        ...snapshot().flags,
        "private-worker": { value: false, status: DecisionStatuses.Resolved },
        unknown: { value: true, status: DecisionStatuses.Resolved },
      },
    };
    expect(parseSnapshot(raw, flags, "user-a")).toEqual(snapshot());
  });

  it("falls back per invalid or missing flag while preserving valid assignments", () => {
    const raw = {
      ...snapshot(),
      flags: {
        ...snapshot().flags,
        layout: { value: "invalid", status: DecisionStatuses.Resolved },
      },
    };
    expect(parseSnapshot(raw, flags, "user-a").flags).toEqual({
      "new-dashboard": { value: true, status: DecisionStatuses.Resolved },
      layout: { value: "control", status: DecisionStatuses.Error },
    });
    expect(
      parseSnapshot({ ...snapshot(), flags: {} }, flags, "user-a").flags[
        "new-dashboard"
      ].status,
    ).toBe(DecisionStatuses.Error);
  });

  it("rejects incompatible envelopes and mismatched bootstrap identities", () => {
    for (const raw of [
      null,
      [],
      { ...snapshot(), version: 2 },
      { ...snapshot(), evaluatedAt: NaN },
      { ...snapshot(), mode: { toString: () => SnapshotModes.Enabled } },
      snapshot("user-b"),
    ]) {
      expect(() => parseSnapshot(raw, flags, "user-a")).toThrow();
    }
  });

  it("forces catalog defaults for disabled snapshots and keeps fixtures distinguishable", () => {
    expect(
      parseSnapshot(
        { ...snapshot(), mode: SnapshotModes.Disabled },
        flags,
        "user-a",
      ).flags.layout,
    ).toEqual({ value: "control", status: DecisionStatuses.Default });
    const fixture = createFixtureSnapshot(flags, "draft", {
      layout: "compact",
    });
    expect(fixture.flags.layout).toEqual({
      value: "compact",
      status: DecisionStatuses.Fixture,
    });
    expect(fixture.flags).not.toHaveProperty("private-worker");
  });

  it("handles prototype-like flag keys without reading inherited values", () => {
    const catalog = defineFlags({
      special: booleanFlag({ ...flags.dashboard, key: "__proto__" }),
    });
    const raw = { ...snapshot(), flags: {} };
    expect(parseSnapshot(raw, catalog, "user-a").flags["__proto__"]).toEqual({
      value: false,
      status: DecisionStatuses.Error,
    });
  });
});
