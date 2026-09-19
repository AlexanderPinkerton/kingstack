import { describe, expect, it, vi } from "vitest";
import { createFlagEvaluator, createSnapshotHandler } from "../src/server.js";
import { createHttpSnapshotLoader } from "../src/http.js";
import { FeatureFlagStore, FeatureFlagStoreStatuses } from "../src/mobx.js";
import { SnapshotModes } from "../src/index.js";
import { flags } from "./fixtures.js";

describe("snapshot transport", () => {
  it("rejects invalid identity before evaluation, including when the provider is disabled", async () => {
    const evaluator = {
      ...createFlagEvaluator({ client: null }),
      snapshot: vi.fn(),
    };
    const handler = createSnapshotHandler({
      evaluator,
      catalog: flags,
      resolveContext: () => Promise.resolve(null),
    });
    const response = await handler(
      new Request("https://next.test/api/feature-flags"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(evaluator.snapshot).not.toHaveBeenCalled();
  });

  it("keeps auth failures separate from provider fallback", async () => {
    const handler = createSnapshotHandler({
      evaluator: createFlagEvaluator({ client: null }),
      catalog: flags,
      resolveContext: () => Promise.reject(new Error("Invalid token")),
    });
    await expect(
      handler(new Request("https://next.test/api/feature-flags")),
    ).rejects.toThrow("Invalid token");
  });

  it("serves private GET snapshots and validates method before resolving identity", async () => {
    const resolveContext = vi.fn(() =>
      Promise.resolve({ scope: "user-a", context: { targetingKey: "a" } }),
    );
    const handler = createSnapshotHandler({
      evaluator: createFlagEvaluator({ client: null }),
      catalog: flags,
      resolveContext,
    });
    const response = await handler(
      new Request("https://next.test/api/feature-flags"),
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toContain("Authorization");
    expect(await response.json()).toMatchObject({
      scope: "user-a",
      mode: SnapshotModes.Disabled,
      flags: { layout: { value: "control" } },
    });
    expect(
      (
        await handler(
          new Request("https://next.test/api/feature-flags", {
            method: "POST",
          }),
        )
      ).status,
    ).toBe(405);
    expect(resolveContext).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://next.test/api/feature-flags",
    "https://nest.test/feature-flags",
  ])("injects direct delivery from %s", async (url) => {
    const handler = createSnapshotHandler({
      evaluator: createFlagEvaluator({ client: null }),
      catalog: flags,
      resolveContext: () =>
        Promise.resolve({ scope: "a", context: { targetingKey: "a" } }),
    });
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      handler(new Request(input, init)),
    );
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "a",
      loadSnapshot: createHttpSnapshotLoader({ url, fetch }),
    });
    store.acquire();
    await store.refresh();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(url);
    expect(fetch.mock.calls[0][1]?.cache).toBe("no-store");
    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(store.status).toBe(FeatureFlagStoreStatuses.Disabled);
    store.dispose();
  });

  it("does not interpret an HTTP failure as a successful default snapshot", async () => {
    const loader = createHttpSnapshotLoader({
      url: "/feature-flags",
      fetch: () => Promise.resolve(new Response(null, { status: 403 })),
    });
    await expect(
      loader({ scope: "a", signal: new AbortController().signal }),
    ).rejects.toThrow("403");
  });
});
