import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { createMemoryPostRepository } from "../src/repositories/posts/memory-post-repository";
import type {
  PostApiData,
  PostRepositoryContext,
} from "../src/repositories/posts/types";
import { AdvancedPostStore } from "../src/stores/userApp/postStore";

const context: PostRepositoryContext = {
  scope: "test-draft",
  enabled: true,
  currentUser: {
    id: "user-1",
    email: "designer@example.com",
    user_metadata: { username: "Designer" },
  },
};

const seed: PostApiData = {
  id: "post-1",
  title: "First concept",
  content: "A #draft concept",
  published: false,
  author_id: "user-1",
  created_at: "2026-07-29T12:00:00.000Z",
  author: {
    id: "user-1",
    username: "Designer",
    email: "designer@example.com",
  },
};

async function waitFor(assertion: () => void): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
  }

  throw lastError;
}

describe("memory post repository", () => {
  it("implements the same async CRUD contract as the HTTP adapter", async () => {
    const repository = createMemoryPostRepository({
      seed: [seed],
      latencyMs: 0,
      createId: () => "post-2",
      now: () => new Date("2026-07-29T13:00:00.000Z"),
    });

    const initial = await repository.list(context);
    initial[0].author.username = "Changed outside repository";
    expect((await repository.list(context))[0].author.username).toBe(
      "Designer",
    );

    const created = await repository.create(
      {
        title: "Second concept",
        content: "No server involved",
        published: true,
      },
      context,
    );
    expect(created).toMatchObject({
      id: "post-2",
      author_id: "user-1",
      author: { username: "Designer" },
    });

    const updated = await repository.update(
      {
        id: created.id,
        data: { title: "Refined concept", published: false },
      },
      context,
    );
    expect(updated).toMatchObject({
      title: "Refined concept",
      content: "No server involved",
      published: false,
    });

    await repository.remove(created.id, context);
    expect(await repository.list(context)).toHaveLength(1);
  });

  it("drives AdvancedPostStore's real optimistic pipeline", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const repository = createMemoryPostRepository({
      seed: [seed],
      latencyMs: 20,
      createId: () => "post-2",
      now: () => new Date("2026-07-29T13:00:00.000Z"),
    });
    const store = new AdvancedPostStore(queryClient, repository, context);
    const release = store.activate();

    await waitFor(() => expect(store.ui.list).toHaveLength(1));

    const createPromise = store.api.create({
      title: "Optimistic concept",
      content: "Visible before persistence #optimistic",
      published: false,
    });

    await waitFor(() =>
      expect(
        store.ui.list.some(
          (post) =>
            post.title === "Optimistic concept" &&
            post.id.startsWith("temp-") &&
            post.tags.includes("optimistic"),
        ),
      ).toBe(true),
    );

    await createPromise;
    await waitFor(() =>
      expect(store.ui.list.some((post) => post.id === "post-2")).toBe(true),
    );

    release();
    store.dispose();
    queryClient.clear();
  });
});
