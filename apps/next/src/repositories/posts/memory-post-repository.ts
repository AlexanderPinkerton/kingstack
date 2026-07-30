import type {
  PostApiData,
  PostCreateInput,
  PostRepository,
  PostRepositoryContext,
  PostUpdateInput,
} from "./types";

export interface MemoryPostRepositoryOptions {
  seed?: PostApiData[];
  latencyMs?: number;
  createId?: () => string;
  now?: () => Date;
}

export interface MemoryPostRepository extends PostRepository {
  reset(): void;
}

function clonePost(post: PostApiData): PostApiData {
  return {
    ...post,
    author: { ...post.author },
  };
}

function defaultId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}`;
}

function authorFromContext(context: PostRepositoryContext) {
  const user = context.currentUser;
  const email = user?.email ?? "designer@local.test";
  const username =
    user?.user_metadata?.username ?? email.split("@")[0] ?? "Designer";

  return {
    id: user?.id ?? "draft-user",
    username,
    email,
  };
}

/**
 * Stateful browser-local adapter with the same async contract as the HTTP
 * repository. Its state intentionally resets on page reload.
 */
export function createMemoryPostRepository(
  options: MemoryPostRepositoryOptions = {},
): MemoryPostRepository {
  const seed = (options.seed ?? []).map(clonePost);
  const latencyMs = options.latencyMs ?? 250;
  const createId = options.createId ?? defaultId;
  const now = options.now ?? (() => new Date());
  let posts = new Map(seed.map((post) => [post.id, post]));

  const delay = async () => {
    if (latencyMs <= 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, latencyMs);
    });
  };

  return {
    async list() {
      await delay();
      return [...posts.values()].map(clonePost);
    },

    async create(data: PostCreateInput, context) {
      await delay();
      const author = authorFromContext(context);
      const post: PostApiData = {
        id: createId(),
        title: data.title,
        content: data.content ?? "",
        published: data.published ?? false,
        author_id: context.currentUser?.id ?? data.author_id ?? author.id,
        created_at: now().toISOString(),
        author,
      };
      posts.set(post.id, post);
      return clonePost(post);
    },

    async update(
      { id, data }: { id: string; data: PostUpdateInput },
      _context,
    ) {
      await delay();
      const existing = posts.get(id);
      if (!existing) {
        throw new Error(`Post ${id} does not exist`);
      }

      const post: PostApiData = {
        ...existing,
        title: data.title ?? existing.title,
        content: data.content ?? existing.content,
        published: data.published ?? existing.published,
      };
      posts.set(id, post);
      return clonePost(post);
    },

    async remove(id) {
      await delay();
      if (!posts.delete(id)) {
        throw new Error(`Post ${id} does not exist`);
      }
      return { id };
    },

    reset() {
      posts = new Map(seed.map((post) => [post.id, clonePost(post)]));
    },
  };
}
