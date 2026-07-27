import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { createOptimisticStore } from "../../src/core/OptimisticStore";
import type { ObservableUIData } from "../../src/core/ObservableUIData";
import type { RealtimeEvent } from "../../src/realtime/types";

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

  it("synchronizes default realtime events into the scoped query cache", () => {
    const queryClient = createQueryClient();
    const queryKey = ["items", "tenant-a"] as const;
    queryClient.setQueryData<Item[]>(queryKey, [
      { id: "1", title: "base", revision: 0 },
    ]);
    let listener: ((event: RealtimeEvent<Item>) => void) | undefined;

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
        realtime: {
          eventType: "item_update",
        },
      },
      queryClient,
    );

    store.realtime?.connect({
      connected: true,
      on: (_eventType, registeredListener) => {
        listener = registeredListener;
      },
      off: () => undefined,
    });

    listener?.({
      type: "item_update",
      event: "UPDATE",
      data: { id: "1", title: "remote", revision: 2 },
    });
    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([
      { id: "1", title: "remote", revision: 2 },
    ]);

    listener?.({
      type: "item_update",
      event: "DELETE",
      data: { id: "1", title: "remote", revision: 2 },
    });
    expect(queryClient.getQueryData<Item[]>(queryKey)).toEqual([]);
  });
});
