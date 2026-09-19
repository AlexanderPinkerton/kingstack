import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ErrorCode,
  OpenFeature,
  StandardResolutionReasons,
  TypedInMemoryProvider,
  type Client,
} from "@openfeature/server-sdk";
import { createFlagEvaluator } from "../src/server.js";
import {
  booleanFlag,
  defineFlags,
  DecisionStatuses,
  SnapshotModes,
} from "../src/index.js";
import { flags } from "./fixtures.js";

afterEach(async () => {
  vi.useRealTimers();
  await OpenFeature.close();
});

function client(
  overrides: Partial<
    Pick<Client, "getBooleanDetails" | "getStringDetails">
  > = {},
): Pick<Client, "getBooleanDetails" | "getStringDetails"> {
  return {
    getBooleanDetails: (flagKey, value) =>
      Promise.resolve({
        flagKey,
        value,
        reason: StandardResolutionReasons.STATIC,
        flagMetadata: {},
      }),
    getStringDetails: <T extends string>(flagKey: string, value: T) =>
      Promise.resolve({
        flagKey,
        value,
        reason: StandardResolutionReasons.STATIC,
        flagMetadata: {},
      }),
    ...overrides,
  };
}

describe("OpenFeature evaluation", () => {
  it("substitutes an actual in-memory provider and isolates concurrent users", async () => {
    await OpenFeature.setProviderAndWait(
      "flags-test",
      new TypedInMemoryProvider({
        "new-dashboard": {
          disabled: false,
          variants: { on: true, off: false },
          defaultVariant: "off",
          contextEvaluator: (ctx) => {
            if (ctx.targetingKey === "a") return "on";
            return "off";
          },
        },
        layout: {
          disabled: false,
          variants: { control: "control", compact: "compact" },
          defaultVariant: "compact",
        },
      }),
    );
    const evaluator = createFlagEvaluator({
      client: OpenFeature.getClient("flags-test"),
    });
    const [a, b] = await Promise.all([
      evaluator.snapshot(flags, { scope: "a", context: { targetingKey: "a" } }),
      evaluator.snapshot(flags, { scope: "b", context: { targetingKey: "b" } }),
    ]);
    expect(a.flags["new-dashboard"].value).toBe(true);
    expect(b.flags["new-dashboard"].value).toBe(false);
    expect(a.flags.layout.value).toBe("compact");
    expect(a.flags).not.toHaveProperty("private-worker");
    expect(await evaluator.evaluate(flags.worker, { targetingKey: "a" })).toBe(
      true,
    );
  });

  it("uses declared defaults without constructing or calling a provider", async () => {
    const evaluator = createFlagEvaluator({ client: null });
    expect(await evaluator.evaluate(flags.worker)).toBe(true);
    expect(
      (await evaluator.snapshot(flags, { scope: "draft", context: {} })).mode,
    ).toBe(SnapshotModes.Disabled);
  });

  it("preserves provider default values, including false for a default-true boolean", async () => {
    const evaluator = createFlagEvaluator({
      client: client({
        getBooleanDetails: (flagKey) =>
          Promise.resolve({
            flagKey,
            value: false,
            reason: StandardResolutionReasons.DEFAULT,
            flagMetadata: {},
          }),
      }),
    });
    expect(await evaluator.evaluateDetails(flags.worker, {})).toEqual({
      value: false,
      status: DecisionStatuses.Default,
    });
  });

  it("uses per-flag fallbacks for invalid values, SDK errors, and thrown errors", async () => {
    const onEvaluation = vi.fn();
    const evaluator = createFlagEvaluator({
      client: client({
        getBooleanDetails: (flagKey) =>
          Promise.resolve({
            flagKey,
            value: true,
            reason: StandardResolutionReasons.ERROR,
            errorCode: ErrorCode.GENERAL,
            flagMetadata: {},
          }),
        getStringDetails: vi.fn().mockResolvedValue({
          flagKey: "layout",
          value: "unrecognized",
          reason: StandardResolutionReasons.STATIC,
          flagMetadata: {},
        }),
      }),
      onEvaluation,
    });
    expect(
      (
        await evaluator.snapshot(flags, {
          scope: "a",
          context: { targetingKey: "a", token: "secret" },
        })
      ).flags,
    ).toEqual({
      "new-dashboard": { value: false, status: DecisionStatuses.Error },
      layout: { value: "control", status: DecisionStatuses.Error },
    });
    expect(JSON.stringify(onEvaluation.mock.calls)).not.toContain("secret");
    const throwing = createFlagEvaluator({
      client: client({
        getBooleanDetails: () =>
          Promise.reject(new Error("private provider detail")),
      }),
    });
    expect(await throwing.evaluateDetails(flags.dashboard, {})).toEqual({
      value: false,
      status: DecisionStatuses.Error,
    });
  });

  it("bounds snapshot size, concurrency, and the entire snapshot deadline", async () => {
    vi.useFakeTimers();
    const getBooleanDetails = vi.fn(() => new Promise<never>(() => {}));
    const evaluator = createFlagEvaluator({
      client: client({ getBooleanDetails }),
      timeoutMs: 25,
      concurrency: 1,
    });
    const catalog = defineFlags(
      Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          String(i),
          booleanFlag({ ...flags.dashboard, key: `flag-${i}` }),
        ]),
      ),
    );
    const request = evaluator.snapshot(catalog, { scope: "a", context: {} });
    await vi.advanceTimersByTimeAsync(25);
    const result = await request;
    expect(
      Object.values(result.flags).every(
        (value) => value.status === DecisionStatuses.Error,
      ),
    ).toBe(true);
    expect(getBooleanDetails).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await expect(
      createFlagEvaluator({ client: client(), maxSnapshotFlags: 1 }).snapshot(
        flags,
        { scope: "a", context: {} },
      ),
    ).rejects.toThrow("exceeds");
  });

  it("does not let a logger failure change the flag decision", async () => {
    const evaluator = createFlagEvaluator({
      client: client(),
      onEvaluation: () => {
        throw new Error("logger");
      },
    });
    expect(await evaluator.evaluate(flags.worker)).toBe(true);
  });
});
