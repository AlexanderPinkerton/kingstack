import { QueryClient } from "@tanstack/react-query";
import { reaction } from "mobx";
import { describe, expect, it, vi } from "vitest";
import type {
  PostCreateInput,
  PostRepositoryContext,
} from "@/repositories/posts/types";
import { AdvancedPostStore } from "@/stores/userApp/postStore";
import { OptimisticPostDemoController } from "@/stores/userApp/optimisticPostDemoController";
import { OptimisticPostsViewModel } from "@/stores/userApp/optimisticPostsViewModel";

const context: PostRepositoryContext = {
  scope: "demo-user",
  enabled: true,
  accessToken: "token",
  currentUser: { id: "demo-user", email: "demo@example.com" },
};

const serverPost = {
  id: "post-1",
  title: "Existing post",
  content: "Confirmed content",
  published: false,
  author_id: "demo-user",
  created_at: "2026-08-03T12:00:00.000Z",
  author: { id: "demo-user", username: "demo", email: "demo@example.com" },
};

function createHarness() {
  const source = {
    list: vi.fn(() => Promise.resolve([serverPost])),
    create: vi.fn((data: PostCreateInput) =>
      Promise.resolve({ ...serverPost, ...data, id: "post-2" }),
    ),
    update: vi.fn(() => Promise.resolve({ ...serverPost, published: true })),
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
  const viewModel = new OptimisticPostsViewModel(
    store,
    "demo-user",
    controller,
  );

  /** Mirrors the query-cache subscription the view wires up. */
  const syncConfirmed = () => {
    viewModel.setConfirmedPosts(store.confirmedApiData);
  };

  const dispose = () => {
    release();
    controller.dispose();
    store.dispose();
    queryClient.clear();
  };

  return { source, controller, store, viewModel, syncConfirmed, dispose };
}

describe("optimistic vs confirmed data", () => {
  it("keeps optimistic records out of the confirmed cache until the server agrees", async () => {
    const { controller, store, viewModel, syncConfirmed, dispose } =
      createHarness();

    try {
      await store.api.refetch();
      syncConfirmed();
      expect(viewModel.divergence.inSync).toBe(true);

      controller.setNetworkDelay(60);
      viewModel.setNewTitle("Written optimistically");
      viewModel.createPost();

      // Mid-flight: the interface shows the record, the cache does not.
      await vi.waitFor(
        () => {
          expect(
            store.ui.list.some((post) => post.id.startsWith("temp-")),
          ).toBe(true);
        },
        { interval: 5 },
      );
      syncConfirmed();
      expect(store.confirmedApiData).toHaveLength(1);
      expect(viewModel.divergence).toMatchObject({
        ahead: 1,
        behind: 0,
        changed: 0,
        inSync: false,
      });

      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("confirmed");
      });
      syncConfirmed();
      expect(store.confirmedApiData).toHaveLength(2);
      expect(viewModel.divergence.inSync).toBe(true);
    } finally {
      dispose();
    }
  });

  it("returns to a synced state after a rejected create", async () => {
    const { source, controller, store, viewModel, syncConfirmed, dispose } =
      createHarness();

    try {
      await store.api.refetch();
      controller.setNetworkDelay(60);
      controller.toggleFailure();

      viewModel.setNewTitle("Never confirmed");
      viewModel.createPost();

      await vi.waitFor(
        () => {
          expect(
            store.ui.list.some((post) => post.id.startsWith("temp-")),
          ).toBe(true);
        },
        { interval: 5 },
      );
      syncConfirmed();
      expect(viewModel.divergence.ahead).toBe(1);

      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("rolled_back");
      });
      syncConfirmed();
      expect(source.create).not.toHaveBeenCalled();
      expect(store.ui.list).toHaveLength(1);
      expect(store.confirmedApiData).toHaveLength(1);
      expect(viewModel.divergence.inSync).toBe(true);
    } finally {
      dispose();
    }
  });

  it("reports an edited record as changed while the update is in flight", async () => {
    const { controller, store, viewModel, syncConfirmed, dispose } =
      createHarness();

    try {
      await store.api.refetch();
      syncConfirmed();
      controller.setNetworkDelay(60);

      const post = store.ui.list[0];
      expect(viewModel.isDivergent(post)).toBe(false);

      viewModel.togglePublished(post);

      await vi.waitFor(
        () => {
          expect(store.ui.get("post-1")?.published).toBe(true);
        },
        { interval: 5 },
      );
      syncConfirmed();
      expect(viewModel.divergence).toMatchObject({ changed: 1, inSync: false });
      expect(viewModel.isDivergent(store.ui.get("post-1")!)).toBe(true);

      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("confirmed");
      });
      syncConfirmed();
      expect(viewModel.divergence.inSync).toBe(true);
    } finally {
      dispose();
    }
  });

  it("reports a record the interface removed as still held by the server", async () => {
    const { controller, store, viewModel, syncConfirmed, dispose } =
      createHarness();

    try {
      await store.api.refetch();
      syncConfirmed();
      controller.setNetworkDelay(60);

      viewModel.removePost(store.ui.list[0]);

      await vi.waitFor(
        () => {
          expect(store.ui.get("post-1")).toBeUndefined();
        },
        { interval: 5 },
      );
      syncConfirmed();
      expect(viewModel.divergence).toMatchObject({ behind: 1, inSync: false });

      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("confirmed");
      });
      syncConfirmed();
      expect(store.confirmedApiData).toHaveLength(0);
      expect(viewModel.divergence.inSync).toBe(true);
    } finally {
      dispose();
    }
  });

  it("holds the optimistic layer until the return trip reaches the store", async () => {
    const { controller, store, viewModel, dispose } = createHarness();

    try {
      await store.api.refetch();
      controller.setNetworkDelay(80);

      // Where the pipeline was when the confirmed row first appeared in MobX.
      let edgeAtReconcile: string | null = null;
      const stopTracking = reaction(
        () => store.ui.list.some((post) => post.id === "post-2"),
        (arrived) => {
          if (!arrived || edgeAtReconcile) return;
          const run = controller.pipelineRun;
          edgeAtReconcile = run ? `${run.direction}:${run.edgeIndex}` : "none";
        },
      );

      viewModel.setNewTitle("Confirmed on arrival");
      viewModel.createPost();

      await vi.waitFor(() => {
        expect(controller.pipelineRun?.status).toBe("confirmed");
      });

      // Not "return:3" — the response must travel back down to MobX before the
      // store writes it, so the optimistic badge survives the whole return leg.
      expect(edgeAtReconcile).toBe("return:1");
      stopTracking();
    } finally {
      dispose();
    }
  });

  it("keeps the store ledgers independent of the app's search and filter", async () => {
    const { store, viewModel, syncConfirmed, dispose } = createHarness();

    try {
      await store.api.refetch();
      syncConfirmed();
      expect(viewModel.uiRecords).toHaveLength(1);
      expect(viewModel.confirmedRecords).toHaveLength(1);

      // Narrowing the example app must not imply the store dropped records.
      viewModel.setSelectedFilter("published");
      viewModel.setSearchQuery("nothing matches this");

      expect(viewModel.filteredPosts).toHaveLength(0);
      expect(viewModel.uiRecords).toHaveLength(1);
      expect(viewModel.confirmedRecords).toHaveLength(1);
    } finally {
      dispose();
    }
  });
});
