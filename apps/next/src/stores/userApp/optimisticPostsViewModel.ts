import { makeAutoObservable, observable } from "mobx";
import type {
  PostApiData,
  PostCreateInput,
  PostUpdateInput,
} from "@/repositories/posts/types";
import type { AdvancedPostStore, PostUiData } from "./postStore";
import type { OptimisticPostDemoController } from "./optimisticPostDemoController";

export type PostListFilter = "all" | "published" | "draft";

/** Prefilled so the demo is one click away from a mutation. */
const DEFAULT_NEW_TITLE = "New Post";

/**
 * How the optimistic projection currently differs from server-confirmed data.
 *
 * `ahead` counts records the interface shows that the server has not confirmed,
 * `behind` counts records the server still has that the interface has already
 * removed, and `changed` counts records present on both sides with different
 * field values.
 */
export interface PostDivergence {
  ahead: number;
  behind: number;
  changed: number;
  total: number;
  inSync: boolean;
}

export class OptimisticPostsViewModel {
  searchQuery = "";
  selectedFilter: PostListFilter = "all";
  newTitle = DEFAULT_NEW_TITLE;
  newContent =
    "Ship the interface immediately, then reconcile with the server. #optimistic #typescript";
  newPublished = false;
  editingPostId: string | null = null;
  editTitle = "";
  editContent = "";
  editPublished = false;
  currentUserId: string;
  confirmedPosts: readonly PostApiData[] = [];

  constructor(
    private readonly postStore: AdvancedPostStore,
    currentUserId: string,
    private readonly demoController?: OptimisticPostDemoController,
  ) {
    this.currentUserId = currentUserId;
    makeAutoObservable<
      OptimisticPostsViewModel,
      "postStore" | "demoController"
    >(this, {
      postStore: false,
      demoController: false,
      // Held by reference: the array comes straight from the query cache and is
      // replaced wholesale, so deep observability would only add overhead.
      confirmedPosts: observable.ref,
    });
  }

  get filteredPosts(): PostUiData[] {
    const query = this.searchQuery.trim().toLowerCase();

    return this.postStore.ui.list
      .filter((post) => {
        if (this.selectedFilter === "published" && !post.published)
          return false;
        if (this.selectedFilter === "draft" && post.published) return false;
        if (!query) return true;

        return (
          post.title.toLowerCase().includes(query) ||
          post.content.toLowerCase().includes(query) ||
          post.author.displayName.toLowerCase().includes(query) ||
          post.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  get visiblePosts(): PostUiData[] {
    return this.filteredPosts.slice(0, 8);
  }

  get stats() {
    const posts = this.postStore.ui.list;
    return {
      total: posts.length,
      published: posts.filter((post) => post.published).length,
      draft: posts.filter((post) => !post.published).length,
      optimistic: posts.filter((post) => post.id.startsWith("temp-")).length,
    };
  }

  /** Server-confirmed rows keyed by id, for side-by-side comparison. */
  get confirmedById(): Map<string, PostApiData> {
    return new Map(this.confirmedPosts.map((post) => [post.id, post]));
  }

  /** Confirmed rows under the same search and filter as the optimistic list. */
  get visibleConfirmedPosts(): PostApiData[] {
    const query = this.searchQuery.trim().toLowerCase();

    return this.confirmedPosts
      .filter((post) => {
        if (this.selectedFilter === "published" && !post.published)
          return false;
        if (this.selectedFilter === "draft" && post.published) return false;
        if (!query) return true;

        return (
          post.title.toLowerCase().includes(query) ||
          (post.content ?? "").toLowerCase().includes(query)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }

  get divergence(): PostDivergence {
    const confirmed = this.confirmedById;
    const uiIds = new Set(this.postStore.ui.list.map((post) => post.id));

    let ahead = 0;
    let changed = 0;

    for (const post of this.postStore.ui.list) {
      const server = confirmed.get(post.id);
      if (!server) {
        ahead += 1;
      } else if (
        server.title !== post.title ||
        server.published !== post.published ||
        (server.content ?? "") !== post.content
      ) {
        changed += 1;
      }
    }

    const behind = this.confirmedPosts.filter(
      (post) => !uiIds.has(post.id),
    ).length;

    return {
      ahead,
      behind,
      changed,
      total: ahead + behind + changed,
      inSync: ahead + behind + changed === 0,
    };
  }

  /** True when this record's UI state has not been confirmed by the server. */
  isDivergent(post: PostUiData): boolean {
    const server = this.confirmedById.get(post.id);
    if (!server) return true;

    return (
      server.title !== post.title ||
      server.published !== post.published ||
      (server.content ?? "") !== post.content
    );
  }

  setConfirmedPosts(posts: readonly PostApiData[]): void {
    this.confirmedPosts = posts;
  }

  get editingPost(): PostUiData | null {
    if (!this.editingPostId) return null;
    return this.postStore.ui.get(this.editingPostId) ?? null;
  }

  get isMutationPending(): boolean {
    return this.demoController?.isMutationPending ?? false;
  }

  setCurrentUserId(currentUserId: string): void {
    this.currentUserId = currentUserId;
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
  }

  setSelectedFilter(filter: PostListFilter): void {
    this.selectedFilter = filter;
  }

  setNewTitle(title: string): void {
    this.newTitle = title;
  }

  setNewContent(content: string): void {
    this.newContent = content;
  }

  setNewPublished(published: boolean): void {
    this.newPublished = published;
  }

  createPost(): void {
    if (this.isMutationPending) return;
    const title = this.newTitle.trim();
    if (!title) return;

    const data: PostCreateInput = {
      title,
      content: this.newContent,
      published: this.newPublished,
      author_id: this.currentUserId,
    };

    if (this.demoController) {
      this.demoController.create(data);
    } else {
      void this.postStore.api.create(data).catch(() => undefined);
    }

    // Restored rather than cleared so the next mutation stays one click away.
    this.newTitle = DEFAULT_NEW_TITLE;
  }

  togglePublished(post: PostUiData): void {
    if (this.isMutationPending) return;
    const data: PostUpdateInput = { published: !post.published };
    if (this.demoController) {
      this.demoController.update(post.id, data, post.title);
    } else {
      void this.postStore.api.update(post.id, data).catch(() => undefined);
    }
  }

  removePost(post: PostUiData): void {
    if (this.isMutationPending) return;
    if (this.demoController) {
      this.demoController.remove(post.id, post.title);
    } else {
      void this.postStore.api.remove(post.id).catch(() => undefined);
    }
  }

  startEditing(post: PostUiData): void {
    if (this.isMutationPending) return;
    this.editingPostId = post.id;
    this.editTitle = post.title;
    this.editContent = post.content;
    this.editPublished = post.published;
  }

  setEditTitle(title: string): void {
    this.editTitle = title;
  }

  setEditContent(content: string): void {
    this.editContent = content;
  }

  setEditPublished(published: boolean): void {
    this.editPublished = published;
  }

  saveEdit(): void {
    if (this.isMutationPending) return;
    const post = this.editingPost;
    const title = this.editTitle.trim();
    if (!post || !title) return;

    const data: PostUpdateInput = {
      title,
      content: this.editContent,
      published: this.editPublished,
    };
    if (this.demoController) {
      this.demoController.update(post.id, data, post.title);
    } else {
      void this.postStore.api.update(post.id, data).catch(() => undefined);
    }
    this.cancelEditing();
  }

  cancelEditing(): void {
    this.editingPostId = null;
  }
}
