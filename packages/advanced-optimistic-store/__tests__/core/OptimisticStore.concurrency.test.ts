import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { createOptimisticStore } from "../../src/core/OptimisticStore";
import type { ObservableUIData } from "../../src/core/ObservableUIData";

interface Item {
  id: string;
  title: string;
  revision: number;
}

interface CreateInput {
  title: string;
}

interface UpdateInput {
  title: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("OptimisticStore deterministic concurrency", () => {
  it("does not fetch while disabled or bypass fresh cache on activation", async () => {
    const queryClient = createQueryClient();
    const queryKey = ["items", "tenant-a"] as const;
    const cachedItem = { id: "1", title: "cached", revision: 1 };
    const queryFn = vi.fn(async () => [cachedItem]);
    let active = false;

    queryClient.setQueryData<Item[]>(queryKey, [cachedItem]);
    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        queryKey,
        enabled: () => active,
        staleTime: 60_000,
        queryFn,
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );

    expect(queryFn).not.toHaveBeenCalled();
    expect(
      queryClient.getQueryCache().find({ queryKey })?.getObserversCount(),
    ).toBe(0);

    active = true;
    store.updateOptions();
    await Promise.resolve();

    expect(queryFn).not.toHaveBeenCalled();
    expect(store.ui.list).toEqual([cachedItem]);
    expect(
      queryClient.getQueryCache().find({ queryKey })?.getObserversCount(),
    ).toBe(1);

    active = false;
    store.updateOptions();
    expect(
      queryClient.getQueryCache().find({ queryKey })?.getObserversCount(),
    ).toBe(0);
  });

  it("reconciles a completed query when staleTime is zero", async () => {
    const queryClient = createQueryClient();
    const item = { id: "1", title: "always stale", revision: 1 };

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "always-stale-items",
        staleTime: 0,
        queryFn: async () => [item],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );

    await vi.waitFor(() => {
      expect(store.ui.list).toEqual([item]);
    });

    store.destroy();
  });

  it("rolls back only the failed create and tracks every pending create", async () => {
    const first = deferred<Item>();
    const second = deferred<Item>();
    const create = vi.fn((input: CreateInput) =>
      input.title === "first" ? first.promise : second.promise,
    );
    const queryClient = createQueryClient();

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create,
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: async (id) => ({ id }),
        },
        transformer: false,
        optimisticDefaults: {
          createOptimisticUiData: (input) => ({
            id: `optimistic-${input.title}`,
            title: input.title,
            revision: 0,
          }),
        },
      },
      queryClient,
    );

    const firstMutation = store.api.create({ title: "first" });
    const secondMutation = store.api.create({ title: "second" });

    await vi.waitFor(() => {
      expect(store.ui.count).toBe(2);
      expect(store.api.status.createPending).toBe(true);
    });

    first.resolve({ id: "server-first", title: "first", revision: 1 });
    await firstMutation;

    expect(store.api.status.createPending).toBe(true);
    expect(store.ui.get("server-first")).toBeDefined();
    expect(store.ui.get("optimistic-second")).toBeDefined();

    second.reject(new Error("second failed"));
    await expect(secondMutation).rejects.toThrow("second failed");

    expect(store.api.status.createPending).toBe(false);
    expect(store.ui.list).toEqual([
      { id: "server-first", title: "first", revision: 1 },
    ]);
  });

  it("keeps the newest update when server responses arrive out of order", async () => {
    const first = deferred<Item>();
    const second = deferred<Item>();
    const queryClient = createQueryClient();
    const update = vi.fn(({ data }: { id: string; data: UpdateInput }) =>
      data.title === "first" ? first.promise : second.promise,
    );

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update,
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert({ id: "1", title: "base", revision: 0 });

    const firstMutation = store.api.update("1", { title: "first" });
    const secondMutation = store.api.update("1", { title: "second" });

    await vi.waitFor(() => {
      expect(store.ui.get("1")?.title).toBe("second");
    });

    second.resolve({ id: "1", title: "second", revision: 2 });
    await secondMutation;
    expect(store.api.status.updatePending).toBe(true);

    first.resolve({ id: "1", title: "first", revision: 1 });
    await firstMutation;

    expect(store.api.status.updatePending).toBe(false);
    expect(store.ui.get("1")).toEqual({
      id: "1",
      title: "second",
      revision: 2,
    });
  });

  it("restores the latest confirmed update when a newer update fails", async () => {
    const first = deferred<Item>();
    const second = deferred<Item>();
    const queryClient = createQueryClient();

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: ({ data }) =>
            data.title === "first" ? first.promise : second.promise,
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert({ id: "1", title: "base", revision: 0 });

    const firstMutation = store.api.update("1", { title: "first" });
    const secondMutation = store.api.update("1", { title: "second" });

    first.resolve({ id: "1", title: "first-confirmed", revision: 1 });
    await firstMutation;
    expect(store.ui.get("1")?.title).toBe("second");

    second.reject(new Error("second failed"));
    await expect(secondMutation).rejects.toThrow("second failed");

    expect(store.ui.get("1")).toEqual({
      id: "1",
      title: "first-confirmed",
      revision: 1,
    });
  });

  it("synchronizes successful updates and deletes into the scoped query cache", async () => {
    const queryClient = createQueryClient();
    const queryKey = ["items", "tenant-a"] as const;
    queryClient.setQueryData<Item[]>(queryKey, [
      { id: "1", title: "base", revision: 0 },
    ]);

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        queryKey,
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert({ id: "1", title: "base", revision: 0 });

    await store.api.update("1", { title: "updated" });
    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([
      { id: "1", title: "updated", revision: 1 },
    ]);

    await store.api.remove("1");
    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([]);
  });

  it("commits an old in-flight mutation to its cache without touching the new scope UI", async () => {
    const queryClient = createQueryClient();
    const updateResult = deferred<Item>();
    let scope = "tenant-a";
    const firstKey = ["items", "tenant-a"] as const;
    const secondKey = ["items", "tenant-b"] as const;
    const firstItem = { id: "1", title: "tenant-a", revision: 0 };
    const secondItem = { id: "1", title: "tenant-b", revision: 0 };

    queryClient.setQueryData<Item[]>(firstKey, [firstItem]);
    queryClient.setQueryData<Item[]>(secondKey, [secondItem]);

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        queryKey: () => ["items", scope],
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: () => updateResult.promise,
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert(firstItem);

    const mutation = store.api.update("1", { title: "optimistic-a" });
    await vi.waitFor(() => {
      expect(store.ui.get("1")?.title).toBe("optimistic-a");
    });

    scope = "tenant-b";
    store.updateOptions();
    store.ui.upsert(secondItem);

    updateResult.resolve({
      id: "1",
      title: "confirmed-a",
      revision: 1,
    });
    await mutation;

    expect(queryClient.getQueryData<Item[]>(firstKey)).toEqual([
      { id: "1", title: "confirmed-a", revision: 1 },
    ]);
    expect(queryClient.getQueryData<Item[]>(secondKey)).toEqual([secondItem]);
    expect(store.ui.list).toEqual([secondItem]);
  });

  it("applies normalized remote changes to the UI and scoped cache", () => {
    const queryClient = createQueryClient();
    const queryKey = ["items", "tenant-a"] as const;
    const base = { id: "1", title: "base", revision: 0 };
    queryClient.setQueryData<Item[]>(queryKey, [base]);

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        queryKey,
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert(base);

    const updateResult = store.applyRemote({
      operation: "update",
      entity: { id: "1", title: "remote", revision: 2 },
      membership: "include",
    });

    expect(updateResult).toMatchObject({ applied: true, scope: "current" });
    expect(store.ui.get("1")).toEqual({
      id: "1",
      title: "remote",
      revision: 2,
    });
    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([
      { id: "1", title: "remote", revision: 2 },
    ]);

    store.applyRemote({
      operation: "delete",
      id: "1",
    });
    expect(store.ui.get("1")).toBeUndefined();
    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([]);
  });

  it("removes an entity when a remote upsert is excluded from the collection", () => {
    const queryClient = createQueryClient();
    const queryKey = ["items", { status: "open" }] as const;
    const base = { id: "1", title: "base", revision: 0 };
    queryClient.setQueryData<Item[]>(queryKey, [base]);

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        queryKey,
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert(base);

    store.applyRemote({
      operation: "update",
      entity: { id: "1", title: "closed", revision: 1 },
      membership: "exclude",
    });

    expect(store.ui.get("1")).toBeUndefined();
    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([]);
  });

  it("uses a remote update as the confirmed base beneath a local optimistic layer", async () => {
    const queryClient = createQueryClient();
    const updateResult = deferred<Item>();
    const base = { id: "1", title: "base", revision: 0 };

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: () => updateResult.promise,
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert(base);

    const mutation = store.api.update("1", { title: "local" });
    await vi.waitFor(() => {
      expect(store.ui.get("1")?.title).toBe("local");
    });

    store.applyRemote({
      operation: "update",
      entity: { id: "1", title: "remote", revision: 2 },
      membership: "include",
    });

    expect(store.ui.get("1")).toEqual({
      id: "1",
      title: "local",
      revision: 2,
    });

    updateResult.reject(new Error("local failed"));
    await expect(mutation).rejects.toThrow("local failed");
    expect(store.ui.get("1")).toEqual({
      id: "1",
      title: "remote",
      revision: 2,
    });
  });

  it("keeps remote changes for another query scope out of the visible projection", () => {
    const queryClient = createQueryClient();
    const tenantAKey = ["items", "tenant-a"] as const;
    const tenantBKey = ["items", "tenant-b"] as const;
    const tenantAItem = { id: "1", title: "tenant-a", revision: 0 };
    const tenantBItem = { id: "1", title: "tenant-b", revision: 0 };
    queryClient.setQueryData<Item[]>(tenantAKey, [tenantAItem]);
    queryClient.setQueryData<Item[]>(tenantBKey, [tenantBItem]);

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        queryKey: tenantBKey,
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert(tenantBItem);

    const result = store.applyRemote({
      operation: "update",
      entity: { id: "1", title: "remote-a", revision: 2 },
      membership: "include",
      queryKey: tenantAKey,
    });

    expect(result).toMatchObject({ applied: true, scope: "background" });
    expect(queryClient.getQueryData<Item[]>(tenantAKey)?.[0]?.title).toBe(
      "remote-a",
    );
    expect(store.ui.list).toEqual([tenantBItem]);
  });

  it("does not append unknown collection members and supports origin and domain filtering", () => {
    const queryClient = createQueryClient();
    const queryKey = ["items", { status: "open" }] as const;
    queryClient.setQueryData<Item[]>(queryKey, []);

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        queryKey,
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: async (id) => ({ id }),
        },
        transformer: false,
        remote: {
          localOriginId: "local-client",
          shouldApply: (change) => change.revision !== 1,
        },
      },
      queryClient,
    );

    store.applyRemote({
      operation: "insert",
      entity: { id: "1", title: "unknown", revision: 2 },
    });
    expect(store.ui.count).toBe(0);
    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([]);
    expect(
      queryClient.getQueryCache().find({ queryKey })?.state.isInvalidated,
    ).toBe(true);

    expect(
      store.applyRemote({
        operation: "insert",
        entity: { id: "1", title: "self", revision: 3 },
        membership: "include",
        originId: "local-client",
      }),
    ).toMatchObject({ applied: false, reason: "self-origin" });

    expect(
      store.applyRemote({
        operation: "insert",
        entity: { id: "1", title: "rejected", revision: 1 },
        membership: "include",
        revision: 1,
      }),
    ).toMatchObject({ applied: false, reason: "rejected" });

    store.applyRemote({
      operation: "insert",
      entity: { id: "1", title: "included", revision: 3 },
      membership: "include",
    });
    expect(store.ui.get("1")?.title).toBe("included");
  });

  it("preserves a remote delete when a pending local update fails", async () => {
    const queryClient = createQueryClient();
    const updateResult = deferred<Item>();
    const base = { id: "1", title: "base", revision: 0 };

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: () => updateResult.promise,
          remove: async (id) => ({ id }),
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert(base);

    const mutation = store.api.update("1", { title: "local" });
    await vi.waitFor(() => {
      expect(store.ui.get("1")?.title).toBe("local");
    });

    store.applyRemote({ operation: "delete", id: "1" });
    expect(store.ui.get("1")).toBeUndefined();

    updateResult.reject(new Error("deleted remotely"));
    await expect(mutation).rejects.toThrow("deleted remotely");
    expect(store.ui.get("1")).toBeUndefined();
  });

  it("preserves a remote delete when a pending local delete fails", async () => {
    const queryClient = createQueryClient();
    const removeResult = deferred<{ id: string }>();
    const base = { id: "1", title: "base", revision: 0 };

    const store = createOptimisticStore<
      Item,
      Item,
      ObservableUIData<Item>,
      CreateInput,
      UpdateInput
    >(
      {
        name: "items",
        enabled: () => false,
        queryFn: async () => [],
        mutations: {
          create: async (data) => ({
            id: "created",
            title: data.title,
            revision: 1,
          }),
          update: async ({ id, data }) => ({
            id,
            title: data.title,
            revision: 1,
          }),
          remove: () => removeResult.promise,
        },
        transformer: false,
      },
      queryClient,
    );
    store.ui.upsert(base);

    const mutation = store.api.remove("1");
    await vi.waitFor(() => {
      expect(store.ui.get("1")).toBeUndefined();
    });

    store.applyRemote({ operation: "delete", id: "1" });
    removeResult.reject(new Error("already deleted remotely"));

    await expect(mutation).rejects.toThrow("already deleted remotely");
    expect(store.ui.get("1")).toBeUndefined();
  });
});
