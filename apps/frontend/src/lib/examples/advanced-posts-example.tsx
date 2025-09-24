"use client";

import { observer } from "mobx-react-lite";
import { useState, useContext, useEffect } from "react";
import { RootStoreContext } from "@/context/rootStoreContext";
import { PostApiData, PostUiData } from "@/stores/postStore";

// ---------- Advanced Types ----------
// Types are now imported from postStore2.ts

// ---------- Advanced UI State ----------
// Using basic React state instead of MobX class

// ---------- Component ----------

export const AdvancedPostsExample = observer(() => {
  const rootStore = useContext(RootStoreContext);
  const postStore = rootStore.postStore2;
  const { store, actions, status } = postStore;
  
  // Basic React state for UI controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    published: false,
  });
  const [editingPost, setEditingPost] = useState<PostUiData | null>(null);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title.trim() || !actions) return;

    // Add author_id from current user for optimistic updates
    const postData = {
      ...newPost,
      author_id: rootStore.session?.user?.id || "unknown",
    };

    actions.create(postData);
    setNewPost({ title: "", content: "", published: false });
  };

  const handleUpdatePost = (post: PostUiData, updates: Partial<PostUiData>) => {
    if (!actions) return;
    actions.update({ id: post.id, data: updates });
    setEditingPost(null);
  };

  const handleDeletePost = (post: PostUiData) => {
    actions?.remove(post.id);
  };

  const togglePublish = (post: PostUiData) => {
    actions?.update({
      id: post.id,
      data: { published: !post.published },
    });
  };

  // Filtering and sorting logic
  const getFilteredPosts = (): PostUiData[] => {
    if (!store?.list) return [];
    
    let posts = store.list;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.content.toLowerCase().includes(query) ||
          post.author.displayName.toLowerCase().includes(query) ||
          (post.tags && post.tags.some((tag) => tag.toLowerCase().includes(query))),
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      posts = posts.filter((post) => {
        switch (selectedCategory) {
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
      switch (sortBy) {
        case "newest":
          const dateA = a.created_at instanceof Date ? a.created_at : new Date(a.created_at);
          const dateB = b.created_at instanceof Date ? b.created_at : new Date(b.created_at);
          return dateB.getTime() - dateA.getTime();
        case "oldest":
          const dateAOld = a.created_at instanceof Date ? a.created_at : new Date(a.created_at);
          const dateBOld = b.created_at instanceof Date ? b.created_at : new Date(b.created_at);
          return dateAOld.getTime() - dateBOld.getTime();
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return posts;
  };

  // Computed stats
  const getStats = () => {
    if (!store?.list) return { total: 0, published: 0, draft: 0, recent: 0 };
    
    const posts = store.list;
    return {
      total: posts.length,
      published: posts.filter(post => post.published).length,
      draft: posts.filter(post => !post.published).length,
      recent: posts.filter(post => post.isNew).length,
    };
  };

  // Show loading state while store is not ready
  if (!postStore.isReady) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse text-slate-300">
          Initializing advanced posts...
        </div>
      </div>
    );
  }

  if (status?.isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse text-slate-300">
          Loading advanced posts...
        </div>
      </div>
    );
  }

  if (status?.isError) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
        <div className="text-red-300 mb-2">
          ❌ Error: {status.error?.message}
        </div>
        <button
          onClick={() => actions?.refetch()}
          className="px-3 py-1 bg-red-600/20 text-red-300 border border-red-500/50 rounded hover:bg-red-600/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const filteredPosts = getFilteredPosts();
  const stats = getStats();

  return (
    <div className="space-y-6">
      {/* Advanced Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-300">
            {stats.total}
          </div>
          <div className="text-sm text-slate-400">Total Posts</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-300">
            {stats.published}
          </div>
          <div className="text-sm text-slate-400">Published</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-300">
            {stats.draft}
          </div>
          <div className="text-sm text-slate-400">Drafts</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-300">
            {stats.recent}
          </div>
          <div className="text-sm text-slate-400">Recent</div>
        </div>
      </div>

      {/* Advanced Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Search posts, authors, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Posts</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="recent">Recent</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
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
            disabled={status?.createPending || !newPost.title.trim()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status?.createPending ? "Creating..." : "Create Post"}
          </button>
        </div>
      </form>

      {/* Posts List */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
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
                  <span>
                    {post.created_at instanceof Date 
                      ? post.created_at.toLocaleDateString() 
                      : new Date(post.created_at).toLocaleDateString()
                    }
                  </span>
                </div>
                {post.tags && post.tags.length > 0 && (
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

      {filteredPosts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <div className="text-slate-400 text-lg">
            {searchQuery || selectedCategory !== "all"
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
