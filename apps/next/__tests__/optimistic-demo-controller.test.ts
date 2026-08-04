import { QueryClient } from "@tanstack/react-query";
import { reaction } from "mobx";
import { describe, expect, it, vi } from "vitest";
import type { PostRepositoryContext } from "@/repositories/posts/types";
import { AdvancedPostStore } from "@/stores/userApp/postStore";
import { OptimisticPostDemoController } from "@/stores/userApp/optimisticPostDemoController";

const context: PostRepositoryContext = {
  scope: "demo-user",
  enabled: true,
  accessToken: "token",
  currentUser: {
    id: "demo-user",
    email: "demo@example.com",
  },
};

const confirmedPost = {
  id: "post-1",
  title: "Immediate interface",
  content: "Confirmed content",
  published: false,
  author_id: "demo-user",
  created_at: "2026-08-03T12:00:00.000Z",
  author: {
    id: "demo-user",
    username: "demo",
    email: "demo@example.com",
  },
};

function createHarness() {
  const create = vi.fn(() => Promise.resolve(confirmedPost));
  const source = {
    list: vi.fn(() => Promise.resolve([])),
    create,
    update: vi.fn(() => Promise.resolve(confirmedPost)),
    remove: vi.fn((id: string) => Promise.resolve({ id })),
  };
  const controller = new OptimisticPostDemoController(source);
  controller.setNetworkDelay(0);
  controller.attachStore({
    api: {
      create: (data) => controller.repository.create(data, context),
      update: (id, data) => controller.repository.update({ id, data }, context),
      remove: (id) => controller.repository.remove(id, context),
    },
  } as AdvancedPostStore);

  return { controller, create };
}

/** Every edge on the way out, then every edge on the way back. */
const ROUND_TRIP_EDGES = [
  "outbound:0",
  "outbound:1",
  "outbound:2",
  "outbound:3",
  "return:3",
  "return:2",
  "return:1",
  "return:0",
];

function trackEdges(controller: OptimisticPostDemoController) {
  const edges: string[] = [];
  const stopTracking = reaction(
    () => {
      const run = controller.pipelineRun;
      return run ? `${run.direction}:${run.edgeIndex}` : null;
    },
    (edge) => {
      if (edge) edges.push(edge);
    },
    { fireImmediately: true },
  );

  return { edges, stopTracking };
}

describe("OptimisticPostDemoController", () => {
  it("reaches the source and confirms", async () => {
    const { controller, create } = createHarness();

    controller.create({ title: "Immediate interface" });

    await vi.waitFor(() => {
      expect(controller.pipelineRun?.status).toBe("confirmed");
    });
    expect(create).toHaveBeenCalledOnce();
    expect(controller.pipelineRun).toMatchObject({
      status: "confirmed",
      result: "confirmed",
      willReject: false,
    });
    expect(controller.isMutationPending).toBe(false);
    controller.dispose();
  });

  it("rejects one mutation before the source and records rollback", async () => {
    const { controller, create } = createHarness();
    controller.toggleFailure();

    controller.create({ title: "Rollback me" });

    await vi.waitFor(() => {
      expect(controller.pipelineRun?.status).toBe("rolled_back");
    });
    expect(create).not.toHaveBeenCalled();
    expect(controller.failureArmed).toBe(false);
    expect(controller.pipelineRun).toMatchObject({
      status: "rolled_back",
      result: "rolled_back",
      willReject: true,
    });
    controller.dispose();
  });

  it("spans the pipeline visualisation across the configured latency", () => {
    const { controller } = createHarness();
    controller.setNetworkDelay(1000);

    controller.create({ title: "Slow path" });

    // Four edges each way across 1s of latency.
    expect(controller.pipelineRun?.stepMs).toBe(125);
    controller.dispose();
  });

  it("runs the pipeline with no visible travel at zero latency", async () => {
    const { controller } = createHarness();
    const startedAt = Date.now();

    controller.create({ title: "Instant" });

    expect(controller.pipelineRun?.stepMs).toBe(0);
    await vi.waitFor(() => {
      expect(controller.pipelineRun?.status).toBe("confirmed");
    });
    // Previously the animation held a fixed ~1.8s regardless of latency.
    expect(Date.now() - startedAt).toBeLessThan(200);
    controller.dispose();
  });

  it("reserves rejection for the mutation that starts while armed", async () => {
    const { controller, create } = createHarness();
    controller.setNetworkDelay(20);
    controller.toggleFailure();

    controller.create({ title: "Reserved rejection" });
    controller.toggleFailure();

    await vi.waitFor(() => {
      expect(controller.pipelineRun?.status).toBe("rolled_back");
    });
    expect(create).not.toHaveBeenCalled();
    expect(controller.failureArmed).toBe(true);
    controller.dispose();
  });

  it("moves down every edge and back up again serially", async () => {
    const { controller } = createHarness();
    controller.setNetworkDelay(80);
    const { edges, stopTracking } = trackEdges(controller);

    controller.create({ title: "Serial round trip" });

    await vi.waitFor(() => {
      expect(controller.pipelineRun?.status).toBe("confirmed");
    });
    expect(edges).toEqual(ROUND_TRIP_EDGES);
    stopTracking();
    controller.dispose();
  });

  it("uses the same serial return edges for rollback", async () => {
    const { controller, create } = createHarness();
    controller.setNetworkDelay(80);
    controller.toggleFailure();
    const { edges, stopTracking } = trackEdges(controller);

    controller.create({ title: "Serial rollback" });

    await vi.waitFor(() => {
      expect(controller.pipelineRun?.status).toBe("rolled_back");
    });
    expect(edges).toEqual(ROUND_TRIP_EDGES);
    expect(create).not.toHaveBeenCalled();
    stopTracking();
    controller.dispose();
  });

  it("rolls real optimistic UI data back without calling the source", async () => {
    const create = vi.fn(() => Promise.resolve(confirmedPost));
    const source = {
      list: vi.fn(() => Promise.resolve([])),
      create,
      update: vi.fn(() => Promise.resolve(confirmedPost)),
      remove: vi.fn((id: string) => Promise.resolve({ id })),
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const controller = new OptimisticPostDemoController(source);
    const store = new AdvancedPostStore(
      queryClient,
      controller.repository,
      context,
    );
    controller.attachStore(store);
    const release = store.activate();

    try {
      await store.api.refetch();
      controller.setNetworkDelay(50);
      controller.toggleFailure();

      controller.create({
        title: "Rollback through the real store",
        author_id: context.currentUser?.id,
      });

      await vi.waitFor(
        () => {
          expect(
            store.ui.list.some((post) => post.id.startsWith("temp-")),
          ).toBe(true);
        },
        { interval: 5 },
      );
      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("rolled_back");
      });

      expect(store.ui.list).toHaveLength(0);
      expect(store.api.status.hasPendingMutations).toBe(false);
      expect(create).not.toHaveBeenCalled();
    } finally {
      release();
      controller.dispose();
      store.dispose();
      queryClient.clear();
    }
  });

  it("keeps the rejection armed across a mutation retry", async () => {
    const create = vi.fn(() => Promise.resolve(confirmedPost));
    const source = {
      list: vi.fn(() => Promise.resolve([])),
      create,
      update: vi.fn(() => Promise.resolve(confirmedPost)),
      remove: vi.fn((id: string) => Promise.resolve({ id })),
    };
    // Mirrors the app's client (components/providers/QueryClientProvider.tsx):
    // a retried mutation must not slip past the armed rejection.
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 1 },
        mutations: { retry: 1 },
      },
    });
    const controller = new OptimisticPostDemoController(source);
    const store = new AdvancedPostStore(
      queryClient,
      controller.repository,
      context,
    );
    controller.attachStore(store);
    const release = store.activate();

    try {
      await store.api.refetch();
      controller.setNetworkDelay(0);
      controller.toggleFailure();

      controller.create({
        title: "Rejected on every attempt",
        author_id: context.currentUser?.id,
      });

      // React Query backs off ~1s before the retry, so allow for that here.
      await vi.waitFor(
        () => {
          expect(controller.pipelineRun?.status).toBe("rolled_back");
        },
        { timeout: 5000 },
      );
      expect(create).not.toHaveBeenCalled();
      expect(store.ui.list).toHaveLength(0);

      // The one-shot rejection is spent; the next mutation reaches the source.
      controller.create({
        title: "Allowed through",
        author_id: context.currentUser?.id,
      });
      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("confirmed");
      });
      expect(create).toHaveBeenCalledOnce();
    } finally {
      release();
      controller.dispose();
      store.dispose();
      queryClient.clear();
    }
  });

  it("rolls real update and delete UI data back without calling the source", async () => {
    const update = vi.fn(() => Promise.resolve(confirmedPost));
    const remove = vi.fn((id: string) => Promise.resolve({ id }));
    const source = {
      list: vi.fn(() => Promise.resolve([confirmedPost])),
      create: vi.fn(() => Promise.resolve(confirmedPost)),
      update,
      remove,
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const controller = new OptimisticPostDemoController(source);
    const store = new AdvancedPostStore(
      queryClient,
      controller.repository,
      context,
    );
    controller.attachStore(store);
    const release = store.activate();

    try {
      await store.api.refetch();
      controller.setNetworkDelay(50);

      controller.toggleFailure();
      controller.update(
        confirmedPost.id,
        { published: true },
        confirmedPost.title,
      );
      await vi.waitFor(
        () => {
          expect(store.ui.get(confirmedPost.id)?.published).toBe(true);
        },
        { interval: 5 },
      );
      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("rolled_back");
      });
      expect(store.ui.get(confirmedPost.id)?.published).toBe(false);
      expect(update).not.toHaveBeenCalled();

      controller.toggleFailure();
      controller.remove(confirmedPost.id, confirmedPost.title);
      await vi.waitFor(
        () => {
          expect(store.ui.get(confirmedPost.id)).toBeUndefined();
        },
        { interval: 5 },
      );
      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("rolled_back");
      });
      expect(store.ui.get(confirmedPost.id)?.title).toBe(confirmedPost.title);
      expect(remove).not.toHaveBeenCalled();
      expect(store.api.status.hasPendingMutations).toBe(false);
    } finally {
      release();
      controller.dispose();
      store.dispose();
      queryClient.clear();
    }
  });
});
