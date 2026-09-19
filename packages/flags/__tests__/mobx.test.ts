import { afterEach, describe, expect, it, vi } from "vitest";
import { autorun } from "mobx";
import {
  FeatureFlagStore,
  FeatureFlagStoreStatuses,
  SnapshotFailureReasons,
} from "../src/mobx.js";
import { createFixtureLoader } from "../src/testing.js";
import {
  DecisionStatuses,
  defaultSnapshot,
  type FlagSnapshot,
  type SnapshotLoadRequest,
} from "../src/index.js";
import { deferred, flags, snapshot } from "./fixtures.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("FeatureFlagStore lifecycle", () => {
  it("constructs inertly, exposes observable synchronous reads, and coalesces demand", async () => {
    const loadSnapshot = vi.fn(() => Promise.resolve(snapshot()));
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "user-a",
      loadSnapshot,
    });
    const reads: boolean[] = [];
    const stop = autorun(() => {
      reads.push(store.get(flags.dashboard));
    });
    expect(loadSnapshot).not.toHaveBeenCalled();
    const release = store.acquire();
    const first = store.refresh();
    expect(store.refresh()).toBe(first);
    await first;
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
    expect(reads).toEqual([false, true]);
    for (let i = 0; i < 20; i++) store.get(flags.dashboard);
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
    release();
    stop();
    store.dispose();
  });

  it("clears prior-user values immediately and discards a late response after switching accounts", async () => {
    const old = deferred<FlagSnapshot>();
    const next = deferred<FlagSnapshot>();
    const requests: SnapshotLoadRequest[] = [];
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "user-a",
      initialSnapshot: snapshot(),
      loadSnapshot: (request) => {
        requests.push(request);
        if (request.scope === "user-a") return old.promise;
        return next.promise;
      },
    });
    store.acquire();
    await Promise.resolve();
    store.setScope("user-b");
    expect(store.get(flags.dashboard)).toBe(false);
    expect(store.ready).toBe(false);
    expect(requests[0].signal.aborted).toBe(true);
    await Promise.resolve();
    old.resolve(snapshot());
    next.resolve(snapshot("user-b", false));
    await store.refresh();
    expect(store.snapshot?.scope).toBe("user-b");
    expect(store.get(flags.dashboard)).toBe(false);
    store.setScope(null);
    expect(store.snapshot).toBeNull();
    expect(store.get(flags.layout)).toBe("control");
    store.dispose();
  });

  it("keeps token rotations inert but refreshes on targeting revisions", async () => {
    const loadSnapshot = vi.fn(({ scope }: SnapshotLoadRequest) =>
      Promise.resolve(snapshot(scope)),
    );
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "user-a:v1",
      loadSnapshot,
    });
    store.acquire();
    await store.refresh();
    store.setScope("user-a:v1");
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
    store.setScope("user-a:v2");
    await store.refresh();
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
    store.dispose();
  });

  it("handles lifecycle replay and cancels final release and disposal", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const loadSnapshot = vi.fn(() => Promise.resolve(snapshot()));
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "user-a",
      loadSnapshot,
      refreshIntervalMs: 100,
    });
    const release = store.acquire();
    release();
    release();
    const releaseAgain = store.acquire();
    await store.refresh();
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
    releaseAgain();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    await store.refresh();
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
    store.dispose();
    store.dispose();
    expect(() => store.acquire()).toThrow("disposed");
  });

  it("reverts to defaults on a failed refresh instead of retaining stale success", async () => {
    const loadSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new Error("offline"));
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "user-a",
      loadSnapshot,
    });
    store.acquire();
    await store.refresh();
    expect(store.get(flags.dashboard)).toBe(true);
    await store.refresh();
    expect(store.get(flags.dashboard)).toBe(false);
    expect(store.status).toBe(FeatureFlagStoreStatuses.Degraded);
    store.dispose();
  });

  it("bounds hung loaders, aborts them, and ignores results even if they ignore cancellation", async () => {
    vi.useFakeTimers();
    const result = deferred<FlagSnapshot>();
    let signal: AbortSignal | undefined;
    const onError = vi.fn();
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "user-a",
      timeoutMs: 25,
      onError,
      loadSnapshot: (request) => {
        signal = request.signal;
        return result.promise;
      },
    });
    store.acquire();
    await vi.advanceTimersByTimeAsync(25);
    expect(signal?.aborted).toBe(true);
    expect(onError).toHaveBeenCalledWith({
      reason: SnapshotFailureReasons.Timeout,
    });
    expect(store.status).toBe(FeatureFlagStoreStatuses.Degraded);
    result.resolve(snapshot());
    await Promise.resolve();
    expect(store.get(flags.dashboard)).toBe(false);
    store.dispose();
  });

  it("keeps disabled mode ready without identity, credentials, polling, or loader calls", async () => {
    const loadSnapshot = vi.fn();
    const store = new FeatureFlagStore({
      catalog: flags,
      loadSnapshot,
      refreshIntervalMs: 10,
    });
    store.acquire();
    await store.refresh();
    expect(store.ready).toBe(true);
    expect(store.status).toBe(FeatureFlagStoreStatuses.Disabled);
    expect(store.get(flags.worker)).toBe(true);
    expect(loadSnapshot).not.toHaveBeenCalled();
    store.dispose();
  });

  it("accepts server disablement, resets values, and stops further refreshes", async () => {
    const loadSnapshot = vi.fn(() =>
      Promise.resolve(defaultSnapshot(flags, "user-a")),
    );
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "user-a",
      initialSnapshot: snapshot(),
      loadSnapshot,
      refreshIntervalMs: 100,
    });
    store.acquire();
    await store.refresh();
    expect(store.status).toBe(FeatureFlagStoreStatuses.Disabled);
    expect(store.get(flags.dashboard)).toBe(false);
    await store.refresh();
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it("supports SSR bootstrap and frontend fixtures without Supabase", async () => {
    const store = new FeatureFlagStore({
      catalog: flags,
      enabled: true,
      scope: "draft",
      initialSnapshot: snapshot("draft"),
      loadSnapshot: createFixtureLoader(flags, { layout: "compact" }),
    });
    expect(store.get(flags.dashboard)).toBe(true);
    store.acquire();
    await store.refresh();
    expect(store.getDecision(flags.layout)).toEqual({
      value: "compact",
      status: DecisionStatuses.Fixture,
    });
    expect(
      () =>
        new FeatureFlagStore({
          catalog: flags,
          enabled: true,
          scope: "another",
          initialSnapshot: snapshot(),
          loadSnapshot: createFixtureLoader(flags),
        }),
    ).toThrow("scope");
    store.dispose();
  });
});
