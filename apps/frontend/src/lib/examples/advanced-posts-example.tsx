"use client";

import { observer } from "mobx-react-lite";
import { useState, useContext } from "react";
import { RootStoreContext } from "@/context/rootStoreContext";
import {
  createOptimisticStore,
  OptimisticStore,
  DataTransformer,
  Entity,
  OptimisticDefaults,
} from "@/lib/optimistic-store-react";
import { fetchWithAuth } from "@/lib/utils";
import { makeObservable, observable, computed, action } from "mobx";

// ---------- Advanced Types ----------

// API data structure (what comes from the server)
export interface PostApiData extends Entity {
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
export interface PostUiData extends Entity {
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

// ---------- Custom Store ----------

export class PostStore extends OptimisticStore<PostUiData> {
  /*
   * All observables must be public or you must use this syntax to make them observable
   * ----OR----
   * This can be overcome by explicitly passing the relevant private fields as generic argument, like this:
   * makeObservable<MyStore, "privateField" | "privateField2">(this, { privateField: observable, privateField2: observable })
   */

  public _searchQuery = "";
  public _selectedCategory = "all";
  public _sortBy: "newest" | "oldest" | "title" = "newest";

  constructor() {
    super();
    // Use makeObservable for subclass with TypeScript fix
    makeObservable(this, {
      _searchQuery: observable,
      _selectedCategory: observable,
      _sortBy: observable,
      searchQuery: computed,
      selectedCategory: computed,
      sortBy: computed,
      setSearchQuery: action,
      setSelectedCategory: action,
      setSortBy: action,
      filteredPosts: computed,
      publishedCount: computed,
      draftCount: computed,
      recentCount: computed,
      totalWordCount: computed,
      averageReadingTime: computed,
      allTags: computed,
    });
  }

  // Search functionality
  get searchQuery() {
    return this._searchQuery;
  }
  setSearchQuery(query: string) {
    this._searchQuery = query;
  }

  get selectedCategory() {
    return this._selectedCategory;
  }
  setSelectedCategory(category: string) {
    this._selectedCategory = category;
  }

  get sortBy() {
    return this._sortBy;
  }
  setSortBy(sort: "newest" | "oldest" | "title") {
    this._sortBy = sort;
  }

  // Advanced computed properties
  get filteredPosts(): PostUiData[] {
    let posts = this.list;

    // Filter by search query
    if (this._searchQuery) {
      const query = this._searchQuery.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.content.toLowerCase().includes(query) ||
          post.author.displayName.toLowerCase().includes(query) ||
          post.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    // Filter by category
    if (this._selectedCategory !== "all") {
      posts = posts.filter((post) => {
        switch (this._selectedCategory) {
          case "published":
            return post.published;
          case "draft":
            return !post.published;
          case "recent":
            return post.isNew;
          default:
            return true;
        }
      });
    }

    // Sort posts
    posts.sort((a, b) => {
      switch (this._sortBy) {
        case "newest":
          return b.created_at.getTime() - a.created_at.getTime();
        case "oldest":
          return a.created_at.getTime() - b.created_at.getTime();
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return posts;
  }

  get publishedCount(): number {
    return this.filter((post) => post.published).length;
  }

  get draftCount(): number {
    return this.filter((post) => !post.published).length;
  }

  get recentCount(): number {
    return this.filter((post) => post.isNew).length;
  }

  get totalWordCount(): number {
    return this.list.reduce((total, post) => total + post.wordCount, 0);
  }

  get averageReadingTime(): number {
    const posts = this.list;
    if (posts.length === 0) return 0;
    return (
      posts.reduce((total, post) => total + post.readingTime, 0) / posts.length
    );
  }

  get allTags(): string[] {
    const tagSet = new Set<string>();
    this.list.forEach((post) => {
      post.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  // Advanced utility methods
  getPostsByAuthor(authorId: string): PostUiData[] {
    return this.filter((post) => post.author_id === authorId);
  }

  getPostsByTag(tag: string): PostUiData[] {
    return this.filter((post) => post.tags.includes(tag));
  }

  getRecentPosts(days: number = 7): PostUiData[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return this.filter((post) => post.created_at > cutoff);
  }
}

// ---------- Custom Transformer ----------

export class PostTransformer
  implements DataTransformer<PostApiData, PostUiData>
{
  constructor() {}

  // Define optimistic defaults - create UI data directly
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

    // Fields that should show loading/pending states
    pendingFields: [], // None for posts, but could include things like 'moderationStatus'
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
    return content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private calculateReadingTime(wordCount: number): number {
    // Average reading speed: 200 words per minute
    return Math.max(1, Math.ceil(wordCount / 200));
  }

  private generateExcerpt(content: string, maxLength: number = 150): string {
    if (content.length <= maxLength) return content;

    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    return lastSpace > 0
      ? truncated.substring(0, lastSpace) + "..."
      : truncated + "...";
  }

  private extractTags(content: string): string[] {
    // Simple tag extraction - look for #hashtags
    const tagRegex = /#(\w+)/g;
    const matches = content.match(tagRegex);

    if (!matches) return [];

    return [...new Set(matches.map((tag) => tag.substring(1).toLowerCase()))];
  }

  private isPostNew(createdAt: string): boolean {
    const postDate = new Date(createdAt);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    return postDate > oneDayAgo;
  }
}

// ---------- Hook ----------

function useAdvancedPosts() {
  const rootStore = useContext(RootStoreContext);

  return createOptimisticStore<PostApiData, PostUiData, PostStore>({
    name: "advanced-posts",
    queryFn: () => {
      const token = rootStore.session?.access_token || "";
      const baseUrl =
        process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
      return fetchWithAuth(token, `${baseUrl}/posts`).then((res) => res.json());
    },
    mutations: {
      create: (data) => {
        const token = rootStore.session?.access_token || "";
        const baseUrl =
          process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
        return fetchWithAuth(token, `${baseUrl}/posts`, {
          method: "POST",
          body: JSON.stringify(data),
        }).then((res) => res.json());
      },

      update: ({ id, data }) => {
        const token = rootStore.session?.access_token || "";
        const baseUrl =
          process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
        return fetchWithAuth(token, `${baseUrl}/posts/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        }).then((res) => res.json());
      },

      remove: (id) => {
        const token = rootStore.session?.access_token || "";
        const baseUrl =
          process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
        return fetchWithAuth(token, `${baseUrl}/posts/${id}`, {
          method: "DELETE",
        }).then(() => ({ id }));
      },
    },
    transformer: new PostTransformer(),
    optimisticContext: () => ({ currentUser: rootStore.session?.user }),
    storeClass: PostStore,
    staleTime: 5 * 60 * 1000,
    enabled: () => !!(rootStore.session?.access_token),
  })();
}

// ---------- Component ----------

export const AdvancedPostsExample = observer(() => {
  const { store, actions, status } = useAdvancedPosts();
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    published: false,
  });
  const [editingPost, setEditingPost] = useState<PostUiData | null>(null);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title.trim()) return;

    actions.create(newPost);
    setNewPost({ title: "", content: "", published: false });
  };

  const handleUpdatePost = (post: PostUiData, updates: Partial<PostUiData>) => {
    actions.update({ id: post.id, data: updates });
    setEditingPost(null);
  };

  const handleDeletePost = (post: PostUiData) => {
    actions.remove(post.id);
  };

  const togglePublish = (post: PostUiData) => {
    actions.update({
      id: post.id,
      data: { published: !post.published },
    });
  };

  if (status.isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse text-slate-300">
          Loading advanced posts...
        </div>
      </div>
    );
  }

  if (status.isError) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
        <div className="text-red-300 mb-2">
          ❌ Error: {status.error?.message}
        </div>
        <button
          onClick={() => actions.refetch()}
          className="px-3 py-1 bg-red-600/20 text-red-300 border border-red-500/50 rounded hover:bg-red-600/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Advanced Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-300">
            {store.count}
          </div>
          <div className="text-sm text-slate-400">Total Posts</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-300">
            {store.publishedCount}
          </div>
          <div className="text-sm text-slate-400">Published</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-300">
            {store.draftCount}
          </div>
          <div className="text-sm text-slate-400">Drafts</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-300">
            {store.recentCount}
          </div>
          <div className="text-sm text-slate-400">Recent</div>
        </div>
      </div>

      {/* Advanced Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Search posts, authors, or tags..."
          value={store.searchQuery}
          onChange={(e) => store.setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <select
          value={store.selectedCategory}
          onChange={(e) => store.setSelectedCategory(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Posts</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="recent">Recent</option>
        </select>
        <select
          value={store.sortBy}
          onChange={(e) => store.setSortBy(e.target.value as any)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title">By Title</option>
        </select>
      </div>

      {/* Create Post Form */}
      <form
        onSubmit={handleCreatePost}
        className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold text-white">Create New Post</h3>
        <input
          type="text"
          placeholder="Post title..."
          value={newPost.title}
          onChange={(e) =>
            setNewPost((prev) => ({ ...prev, title: e.target.value }))
          }
          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <textarea
          placeholder="Write your post content here... Use #hashtags for tags!"
          value={newPost.content}
          onChange={(e) =>
            setNewPost((prev) => ({ ...prev, content: e.target.value }))
          }
          rows={4}
          className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={newPost.published}
              onChange={(e) =>
                setNewPost((prev) => ({ ...prev, published: e.target.checked }))
              }
              className="rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500"
            />
            Publish immediately
          </label>
          <button
            type="submit"
            disabled={status.createPending || !newPost.title.trim()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status.createPending ? "Creating..." : "Create Post"}
          </button>
        </div>
      </form>

      {/* Posts List */}
      <div className="space-y-4">
        {store.filteredPosts.map((post) => (
          <div
            key={post.id}
            className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold text-white">
                    {post.title}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      post.published
                        ? "bg-green-600/20 text-green-300 border border-green-500/50"
                        : "bg-yellow-600/20 text-yellow-300 border border-yellow-500/50"
                    }`}
                  >
                    {post.publishStatus}
                  </span>
                  {post.isNew && (
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/50">
                      New
                    </span>
                  )}
                </div>
                <p className="text-slate-300 mb-3">{post.excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>By {post.author.displayName}</span>
                  <span>{post.wordCount} words</span>
                  <span>{post.readingTime} min read</span>
                  <span>{post.created_at.toLocaleDateString()}</span>
                </div>
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-slate-700/50 text-slate-300 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => togglePublish(post)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    post.published
                      ? "bg-yellow-600/20 text-yellow-300 border border-yellow-500/50 hover:bg-yellow-600/30"
                      : "bg-green-600/20 text-green-300 border border-green-500/50 hover:bg-green-600/30"
                  }`}
                >
                  {post.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => setEditingPost(post)}
                  className="px-3 py-1 text-xs bg-blue-600/20 text-blue-300 border border-blue-500/50 rounded hover:bg-blue-600/30 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePost(post)}
                  className="px-3 py-1 text-xs bg-red-600/20 text-red-300 border border-red-500/50 rounded hover:bg-red-600/30 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {store.filteredPosts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <div className="text-slate-400 text-lg">
            {store.searchQuery || store.selectedCategory !== "all"
              ? "No posts match your filters"
              : "No posts yet. Create your first post above! 👆"}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Post</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleUpdatePost(editingPost, {
                  title: formData.get("title") as string,
                  content: formData.get("content") as string,
                  published: formData.has("published"),
                });
              }}
            >
              <input
                name="title"
                type="text"
                defaultValue={editingPost.title}
                className="w-full px-4 py-2 mb-4 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <textarea
                name="content"
                defaultValue={editingPost.content}
                rows={6}
                className="w-full px-4 py-2 mb-4 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    name="published"
                    type="checkbox"
                    defaultChecked={editingPost.published}
                    className="rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  Published
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pattern Features */}
      <div className="mt-8 pt-6 border-t border-slate-700/50">
        <div className="text-xs text-slate-500 text-center space-y-1">
          <div>
            🧠 Custom Store • 🔄 Custom Transformer • 🔍 Advanced Search &
            Filtering
          </div>
          <div>
            📊 Rich Analytics • 🏷️ Auto-tag Extraction • ⚡ Optimistic Updates
          </div>
        </div>
      </div>
    </div>
  );
});
