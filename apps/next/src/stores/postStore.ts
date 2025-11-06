import {
  createOptimisticStore,
  OptimisticStore,
  DataTransformer,
  OptimisticDefaults,
} from "@kingstack/advanced-optimistic-store";
import { fetchWithAuth } from "@/lib/utils";
import { getMockData, isPlaygroundMode } from "@kingstack/shapes";

// API data structure (what comes from the server)
export interface PostApiData {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  author_id: string;
  created_at: string; // ISO string from server
  author: {
    id: string;
    username: string;
    email: string;
  };
}

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
class PostTransformer implements DataTransformer<PostApiData, PostUiData> {
  // Memoization cache for expensive calculations
  private calculationCache = new Map<string, any>();
  optimisticDefaults: OptimisticDefaults<PostUiData> = {
    createOptimisticUiData: (userInput: any, context?: any) => {
      const currentUser = context?.currentUser;
      const content = userInput.content || "";

      // Calculate UI fields immediately
      const wordCount = this.calculateWordCount(content);
      const readingTime = this.calculateReadingTime(wordCount);
      const excerpt = this.generateExcerpt(content);
      const tags = this.extractTags(content);

      // Use existing ID if available (for updates), otherwise generate temp ID
      const id = userInput.id || `temp-${Date.now()}`;

      // Use existing created_at if available (for updates), otherwise use current time
      const createdAt =
        userInput.created_at instanceof Date
          ? userInput.created_at
          : userInput.created_at
            ? new Date(userInput.created_at)
            : new Date();

      // Determine if this is a new post using the same logic as the transformer
      const isNew = this.isPostNew(createdAt.toISOString());

      return {
        id,
        title: userInput.title || "",
        content,
        published: userInput.published ?? false,
        author_id: userInput.author_id || currentUser?.id || "unknown",
        created_at: createdAt,
        author: userInput.author || {
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
      } as PostUiData;
    },
    pendingFields: [],
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
    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
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
    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
    }

    // Average reading speed: 200 words per minute
    const result = Math.max(1, Math.ceil(wordCount / 200));
    this.calculationCache.set(cacheKey, result);
    return result;
  }

  private generateExcerpt(content: string, maxLength: number = 150): string {
    const cacheKey = `excerpt-${content}-${maxLength}`;
    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
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
    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
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
  private optimisticStore: OptimisticStore<PostApiData, PostUiData> | null =
    null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Store is created but not enabled until auth is available
    this.initialize();
  }

  private initialize() {
    const transformer = new PostTransformer();

    this.optimisticStore = createOptimisticStore<PostApiData, PostUiData>({
      name: "advanced-posts",
      queryFn: this.getQueryFn(),
      mutations: {
        create: this.getCreateMutation(),
        update: this.getUpdateMutation(),
        remove: this.getDeleteMutation(),
      },
      transformer: transformer,
      optimisticContext: () => ({ currentUser: null }), // Will be set by the component
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: () => this.isEnabled && !!this.authToken, // Only run when enabled and we have a token
    });
  }

  // Enable the store with auth token
  enable(authToken: string) {
    this.authToken = authToken;
    this.isEnabled = true;
    // Update the store manager options to enable the query
    this.optimisticStore?.updateOptions();
  }

  // Disable the store
  disable() {
    this.isEnabled = false;
    this.authToken = null;
    // Update the store manager options to disable the query
    this.optimisticStore?.updateOptions();
  }

  // Expose UI data (observable MobX state)
  get ui() {
    return this.optimisticStore?.ui || null;
  }

  // Expose API methods (mutations + query control)
  get api() {
    return this.optimisticStore?.api || null;
  }

  // Legacy getters for backward compatibility (deprecated)
  get store() {
    return this.ui;
  }

  get actions() {
    return this.api;
  }

  get status() {
    return this.api?.status || null;
  }

  // Check if store is ready and enabled
  get isReady() {
    return this.optimisticStore !== null && this.isEnabled;
  }

  // ============================================================================
  // PLAYGROUND CONFIGURATION
  // ============================================================================
  // All playground logic is centralized here for easy maintenance

  private getQueryFn() {
    return isPlaygroundMode() ? this.playgroundQueryFn : this.apiQueryFn;
  }

  private getCreateMutation() {
    return isPlaygroundMode()
      ? this.playgroundCreateMutation
      : this.apiCreateMutation;
  }

  private getUpdateMutation() {
    return isPlaygroundMode()
      ? this.playgroundUpdateMutation
      : this.apiUpdateMutation;
  }

  private getDeleteMutation() {
    return isPlaygroundMode()
      ? this.playgroundDeleteMutation
      : this.apiDeleteMutation;
  }

  // API Implementations
  private apiQueryFn = async (): Promise<PostApiData[]> => {
    const token = this.authToken || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/posts`).then((res) => res.json());
  };

  private apiCreateMutation = async (data: any): Promise<PostApiData> => {
    const token = this.authToken || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/posts`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => res.json());
  };

  private apiUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: any;
  }): Promise<PostApiData> => {
    const token = this.authToken || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((res) => res.json());
  };

  private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
    const token = this.authToken || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/posts/${id}`, {
      method: "DELETE",
    }).then(() => ({ id }));
  };

  // Playground Implementations
  private playgroundQueryFn = async (): Promise<PostApiData[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate delay
    return getMockData("posts") as PostApiData[];
  };

  private playgroundCreateMutation = async (
    data: any,
  ): Promise<PostApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: data.title || "New Post",
      content: data.content || "",
      published: data.published || false,
      author_id: "playground-user",
      created_at: new Date().toISOString(),
      author: {
        id: "playground-user",
        username: "playground-user",
        email: "playground@example.com",
      },
    };
  };

  private playgroundUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: any;
  }): Promise<PostApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Get existing post from mock data to preserve unchanged fields
    const existingPosts = getMockData("posts") as PostApiData[];
    const existingPost = existingPosts.find((p) => p.id === id);

    // If we have an existing post, merge it with the updates
    if (existingPost) {
      return {
        ...existingPost,
        ...data, // This will override only the fields that were updated
        updated_at: new Date().toISOString(), // Always update the timestamp
      };
    }

    // Fallback if no existing post found
    return {
      id,
      title: data.title || "Updated Post",
      content: data.content || "",
      published: data.published || false,
      author_id: "playground-user",
      created_at: new Date().toISOString(),
      author: {
        id: "playground-user",
        username: "playground-user",
        email: "playground@example.com",
      },
      ...data,
    };
  };

  private playgroundDeleteMutation = async (
    id: string,
  ): Promise<{ id: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { id };
  };
}
