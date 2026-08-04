import {
  createOptimisticStore,
  type OptimisticStore,
  type DataTransformer,
  type OptimisticDefaults,
  type ObservableUIData,
} from "@kingstack/advanced-optimistic-store";
import type { QueryClient } from "@tanstack/react-query";
import { StoreDemand } from "@/lib/store-lifecycle";
import type {
  PostApiData,
  PostCreateInput,
  PostRepository,
  PostRepositoryContext,
  PostUpdateInput,
} from "@/repositories/posts/types";

export type { PostApiData } from "@/repositories/posts/types";

/** Stable empty result so cache reads can back a `useSyncExternalStore`. */
const NO_CONFIRMED_POSTS: readonly PostApiData[] = Object.freeze([]);

// UI data structure (enhanced for the frontend)
export interface PostUiData {
  id: string;
  title: string;
  content: string;
  published: boolean;
  author_id: string;
  created_at: Date;
  author: {
    id: string;
    username: string;
    email: string;
    displayName: string; // Computed field
  };
  // UI-only computed fields
  excerpt: string;
  readingTime: number; // in minutes
  wordCount: number;
  isNew: boolean; // Posts created in the last 24 hours
  publishStatus: "draft" | "published";
  tags: string[]; // Extracted from content
}

// Transformer to convert API data to UI data with computed fields
class PostTransformer implements DataTransformer<
  PostApiData,
  PostUiData,
  PostCreateInput,
  Pick<PostRepositoryContext, "currentUser">
> {
  // Memoization cache for expensive calculations
  private calculationCache = new Map<string, number | string | string[]>();
  optimisticDefaults: OptimisticDefaults<
    PostUiData,
    PostCreateInput,
    Pick<PostRepositoryContext, "currentUser">
  > = {
    createOptimisticUiData: (userInput, context) => {
      const currentUser = context?.currentUser;
      const content = userInput.content || "";

      // Calculate UI fields immediately
      const wordCount = this.calculateWordCount(content);
      const readingTime = this.calculateReadingTime(wordCount);
      const excerpt = this.generateExcerpt(content);
      const tags = this.extractTags(content);

      const id = `temp-${
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`
      }`;
      const createdAt = new Date();

      // Determine if this is a new post using the same logic as the transformer
      const isNew = this.isPostNew(createdAt.toISOString());

      return {
        id,
        title: userInput.title || "",
        content,
        published: userInput.published ?? false,
        author_id: userInput.author_id || currentUser?.id || "unknown",
        created_at: createdAt,
        author: {
          id: currentUser?.id || "unknown",
          username:
            currentUser?.user_metadata?.username ||
            currentUser?.email?.split("@")[0] ||
            "You",
          email: currentUser?.email || "unknown@example.com",
          displayName:
            currentUser?.user_metadata?.username ||
            currentUser?.email?.split("@")[0] ||
            "You",
        },
        // Computed UI fields - always recalculated
        excerpt,
        readingTime,
        wordCount,
        isNew,
        publishStatus: (userInput.published ?? false) ? "published" : "draft",
        tags,
      };
    },
  };

  toUi(apiData: PostApiData): PostUiData {
    const content = apiData.content || "";
    const wordCount = this.calculateWordCount(content);
    const readingTime = this.calculateReadingTime(wordCount);
    const excerpt = this.generateExcerpt(content);
    const tags = this.extractTags(content);
    const isNew = this.isPostNew(apiData.created_at);

    // Handle case where author data might be missing (optimistic updates)
    const author = apiData.author || {
      id: apiData.author_id || "unknown",
      username: "Unknown User",
      email: "unknown@example.com",
    };

    return {
      id: apiData.id,
      title: apiData.title,
      content,
      published: apiData.published,
      author_id: apiData.author_id,
      created_at: new Date(apiData.created_at),
      author: {
        ...author,
        displayName: author.username || author.email.split("@")[0],
      },
      // Computed fields
      excerpt,
      readingTime,
      wordCount,
      isNew,
      publishStatus: apiData.published ? "published" : "draft",
      tags,
    };
  }

  toApi(uiData: PostUiData): PostApiData {
    return {
      id: uiData.id,
      title: uiData.title,
      content: uiData.content,
      published: uiData.published,
      author_id: uiData.author_id,
      created_at: uiData.created_at.toISOString(),
      author: {
        id: uiData.author.id,
        username: uiData.author.username,
        email: uiData.author.email,
      },
    };
  }

  private calculateWordCount(content: string): number {
    const cacheKey = `wordCount-${content}`;
    const cached = this.calculationCache.get(cacheKey);
    if (typeof cached === "number") {
      return cached;
    }

    const result = content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    this.calculationCache.set(cacheKey, result);
    return result;
  }

  private calculateReadingTime(wordCount: number): number {
    const cacheKey = `readingTime-${wordCount}`;
    const cached = this.calculationCache.get(cacheKey);
    if (typeof cached === "number") {
      return cached;
    }

    // Average reading speed: 200 words per minute
    const result = Math.max(1, Math.ceil(wordCount / 200));
    this.calculationCache.set(cacheKey, result);
    return result;
  }

  private generateExcerpt(content: string, maxLength: number = 150): string {
    const cacheKey = `excerpt-${content}-${maxLength}`;
    const cached = this.calculationCache.get(cacheKey);
    if (typeof cached === "string") {
      return cached;
    }

    if (content.length <= maxLength) {
      this.calculationCache.set(cacheKey, content);
      return content;
    }

    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    const result =
      lastSpace > 0
        ? truncated.substring(0, lastSpace) + "..."
        : truncated + "...";

    this.calculationCache.set(cacheKey, result);
    return result;
  }

  private extractTags(content: string): string[] {
    const cacheKey = `tags-${content}`;
    const cached = this.calculationCache.get(cacheKey);
    if (Array.isArray(cached)) {
      return cached;
    }

    // Simple tag extraction - look for #hashtags
    const tagRegex = /#(\w+)/g;
    const matches = content.match(tagRegex);

    const result = !matches
      ? []
      : [...new Set(matches.map((tag) => tag.substring(1).toLowerCase()))];
    this.calculationCache.set(cacheKey, result);
    return result;
  }

  private isPostNew(createdAt: string): boolean {
    const postDate = new Date(createdAt);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    return postDate > oneDayAgo;
  }

  // Cleanup method to prevent memory leaks
  clearCache(): void {
    this.calculationCache.clear();
  }
}

export class AdvancedPostStore {
  private readonly optimisticStore: OptimisticStore<
    PostApiData,
    PostUiData,
    ObservableUIData<PostUiData>,
    PostCreateInput,
    PostUpdateInput
  >;
  private readonly transformer = new PostTransformer();
  private readonly demand: StoreDemand;
  private context: PostRepositoryContext;

  constructor(
    private readonly queryClient: QueryClient,
    private readonly repository: PostRepository,
    initialContext: PostRepositoryContext = {
      scope: "disabled",
      enabled: false,
      currentUser: null,
    },
  ) {
    this.context = initialContext;
    this.demand = new StoreDemand(() => this.optimisticStore.updateOptions());

    this.optimisticStore = createOptimisticStore<
      PostApiData,
      PostUiData,
      ObservableUIData<PostUiData>,
      PostCreateInput,
      PostUpdateInput,
      Pick<PostRepositoryContext, "currentUser">
    >(
      {
        name: "advanced-posts",
        queryKey: () => this.queryKey,
        queryFn: () => this.repository.list(this.context),
        mutations: {
          create: (data) => this.repository.create(data, this.context),
          update: (params) => this.repository.update(params, this.context),
          remove: (id) => this.repository.remove(id, this.context),
        },
        transformer: this.transformer,
        optimisticContext: () => ({
          currentUser: this.context.currentUser,
        }),
        staleTime: 5 * 60 * 1000,
        enabled: () => this.demand.isActive && this.context.enabled,
      },
      queryClient,
    );
  }

  activate(): () => void {
    return this.demand.activate();
  }

  setContext(context: PostRepositoryContext): void {
    const previousScope = this.context.scope;
    this.context = context;

    if (previousScope !== context.scope) {
      this.optimisticStore.ui.clear();
    }

    this.optimisticStore.updateOptions();
  }

  dispose(): void {
    this.demand.dispose();
    this.transformer.clearCache();
    this.optimisticStore.destroy();
  }

  // Expose UI data (observable MobX state)
  get ui() {
    return this.optimisticStore.ui;
  }

  // Expose API methods (mutations + query control)
  get api() {
    return this.optimisticStore.api;
  }

  // Check if store is ready and enabled
  get isReady() {
    return this.context.enabled;
  }

  get queryKey(): string[] {
    return ["advanced-posts", this.context.scope];
  }

  /**
   * Rows the server has actually confirmed.
   *
   * Optimistic layers are held in the MobX projection (`ui`) and never written
   * to the query cache — the cache is only updated when a mutation succeeds or
   * the list query resolves. Reading it therefore gives the pre-transformer,
   * server-truth counterpart to `ui.list`, which is what the demo contrasts.
   */
  get confirmedApiData(): readonly PostApiData[] {
    return (
      this.queryClient.getQueryData<PostApiData[]>(this.queryKey) ??
      NO_CONFIRMED_POSTS
    );
  }
}
