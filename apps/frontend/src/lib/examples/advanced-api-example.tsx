/**
 * Advanced API Example
 * 
 * This shows how power users can customize everything while still using the simple API.
 * Demonstrates: custom stores, transformations, custom actions, and advanced features.
 */

import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { 
  EntityAPI, 
  OptimisticStore, 
  DataTransformer,
  createAdvancedOptimisticStore 
} from "../optimistic-store-pattern";

// ---------- API Types (from server) ----------
interface PostApiData {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO string
  publishedAt: string | null;
  likes: number;
  tags: string; // CSV string
}

// ---------- UI Types (for the app) ----------  
interface PostUiData {
  id: string;
  title: string;
  content: string;
  createdAt: Date; // Transformed to Date
  publishedAt: Date | null;
  likes: number;
  tags: string[]; // Transformed to array
  
  // Computed properties
  isPublished: boolean;
  timeAgo: string;
  excerpt: string;
}

// ---------- Custom Data Transformer ----------
class PostTransformer implements DataTransformer<PostApiData, PostUiData> {
  toUi(apiData: PostApiData): PostUiData {
    const createdAt = new Date(apiData.createdAt);
    const publishedAt = apiData.publishedAt ? new Date(apiData.publishedAt) : null;
    
    return {
      id: apiData.id,
      title: apiData.title,
      content: apiData.content,
      createdAt,
      publishedAt,
      likes: apiData.likes,
      tags: apiData.tags ? apiData.tags.split(',').map(t => t.trim()) : [],
      
      // Computed properties
      isPublished: !!publishedAt && publishedAt <= new Date(),
      timeAgo: this.formatTimeAgo(createdAt),
      excerpt: apiData.content.slice(0, 100) + (apiData.content.length > 100 ? '...' : ''),
    };
  }

  toApi(uiData: PostUiData): PostApiData {
    return {
      id: uiData.id,
      title: uiData.title,
      content: uiData.content,
      createdAt: uiData.createdAt.toISOString(),
      publishedAt: uiData.publishedAt?.toISOString() || null,
      likes: uiData.likes,
      tags: uiData.tags.join(', '),
    };
  }

  toApiUpdate(uiData: Partial<PostUiData>): Partial<PostApiData> {
    const result: Partial<PostApiData> = {};
    
    if (uiData.title !== undefined) result.title = uiData.title;
    if (uiData.content !== undefined) result.content = uiData.content;
    if (uiData.publishedAt !== undefined) {
      result.publishedAt = uiData.publishedAt?.toISOString() || null;
    }
    if (uiData.tags !== undefined) {
      result.tags = uiData.tags.join(', ');
    }
    
    return result;
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }
}

// ---------- Custom Enhanced Store ----------
class PostStore extends OptimisticStore<PostUiData> {
  // Custom computed properties
  get publishedPosts(): PostUiData[] {
    return this.filter(post => post.isPublished);
  }

  get draftPosts(): PostUiData[] {
    return this.filter(post => !post.isPublished);
  }

  get byNewest(): PostUiData[] {
    return [...this.list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  get popularPosts(): PostUiData[] {
    return [...this.list].sort((a, b) => b.likes - a.likes);
  }

  get allTags(): string[] {
    const tagSet = new Set<string>();
    this.list.forEach(post => {
      post.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  // Custom methods
  searchPosts(query: string): PostUiData[] {
    const lowerQuery = query.toLowerCase();
    return this.filter(post => 
      post.title.toLowerCase().includes(lowerQuery) ||
      post.content.toLowerCase().includes(lowerQuery) ||
      post.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getPostsByTag(tag: string): PostUiData[] {
    return this.filter(post => post.tags.includes(tag));
  }
}

// ---------- API Implementation ----------
class PostAPI implements EntityAPI<PostApiData> {
  private posts: Record<string, PostApiData> = {
    "1": {
      id: "1",
      title: "Getting Started with Optimistic Updates",
      content: "Optimistic updates make your app feel instant by updating the UI immediately, before waiting for the server response. This creates a much better user experience...",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      likes: 42,
      tags: "react, typescript, patterns",
    },
    "2": {
      id: "2", 
      title: "Advanced State Management Patterns",
      content: "When building complex applications, choosing the right state management pattern can make or break your project. Let's explore some advanced techniques...",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      publishedAt: null, // Draft
      likes: 15,
      tags: "state-management, mobx, patterns",
    },
  };

  async list(): Promise<PostApiData[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    console.log('📡 API: Fetching posts');
    return Object.values(this.posts);
  }

  async create(data: Omit<PostApiData, 'id'>): Promise<PostApiData> {
    await new Promise(resolve => setTimeout(resolve, 600));
    console.log('📡 API: Creating post', data);
    
    const id = Math.random().toString(36).slice(2, 9);
    const post: PostApiData = { id, ...data };
    this.posts[id] = post;
    return post;
  }

  async update(id: string, data: Partial<PostApiData>): Promise<PostApiData> {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('📡 API: Updating post', id, data);
    
    const existing = this.posts[id];
    if (!existing) throw new Error('Post not found');
    
    const updated = { ...existing, ...data };
    this.posts[id] = updated;
    return updated;
  }

  async delete(id: string): Promise<{ id: string }> {
    await new Promise(resolve => setTimeout(resolve, 400));
    console.log('📡 API: Deleting post', id);
    
    if (!this.posts[id]) throw new Error('Post not found');
    delete this.posts[id];
    return { id };
  }

  // Custom API methods
  async likePost(id: string): Promise<PostApiData> {
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log('📡 API: Liking post', id);
    
    const post = this.posts[id];
    if (!post) throw new Error('Post not found');
    
    const updated = { ...post, likes: post.likes + 1 };
    this.posts[id] = updated;
    return updated;
  }

  async publishPost(id: string): Promise<PostApiData> {
    await new Promise(resolve => setTimeout(resolve, 400));
    console.log('📡 API: Publishing post', id);
    
    const post = this.posts[id];
    if (!post) throw new Error('Post not found');
    
    const updated = { ...post, publishedAt: new Date().toISOString() };
    this.posts[id] = updated;
    return updated;
  }
}

// ---------- Advanced Optimistic Store Setup ----------
const postAPI = new PostAPI();
const postTransformer = new PostTransformer();

// Create the advanced controller and wrap it with proper typing
function usePosts() {
  const controller = createAdvancedOptimisticStore<PostApiData, PostUiData, PostStore>({
    name: 'posts',
    api: postAPI,
    transformer: postTransformer,
    storeClass: PostStore,
    staleTime: 2 * 60 * 1000, // 2 minutes
    customActions: {
      // Like a post
      like: {
        mutationFn: async (id: string) => {
          return postAPI.likePost(id);
        },
        onOptimistic: (id: string, store: PostStore) => {
          const post = store.get(id);
          if (post) {
            store.update(id, { likes: post.likes + 1 });
          }
        },
        onSuccess: (result: PostApiData, id: string, store: PostStore) => {
          const uiData = postTransformer.toUi(result);
          store.upsert(uiData);
        },
      },

      // Publish a post
      publish: {
        mutationFn: async (id: string) => {
          return postAPI.publishPost(id);
        },
        onOptimistic: (id: string, store: PostStore) => {
          const now = new Date();
          store.update(id, { 
            publishedAt: now,
            isPublished: true,
          });
        },
        onSuccess: (result: PostApiData, id: string, store: PostStore) => {
          const uiData = postTransformer.toUi(result);
          store.upsert(uiData);
        },
      },

      // Add tags to a post
      addTags: {
        mutationFn: async ({ id, newTags }: { id: string; newTags: string[] }) => {
          const post = postAPI['posts'][id];
          if (!post) throw new Error('Post not found');
          
          const currentTags = post.tags ? post.tags.split(',').map(t => t.trim()) : [];
          const allTags = [...new Set([...currentTags, ...newTags])];
          
          return postAPI.update(id, { tags: allTags.join(', ') });
        },
        onOptimistic: ({ id, newTags }: { id: string; newTags: string[] }, store: PostStore) => {
          const post = store.get(id);
          if (post) {
            const updatedTags = [...new Set([...post.tags, ...newTags])];
            store.update(id, { tags: updatedTags });
          }
        },
        onSuccess: (result: PostApiData, params: any, store: PostStore) => {
          const uiData = postTransformer.toUi(result);
          store.upsert(uiData);
        },
      },
    },
  });

  const result = controller();
  
  // Return with properly typed custom actions
  return {
    store: result.store as PostStore,
    actions: {
      ...result.actions,
      like: (result.actions as any).like as (id: string) => void,
      publish: (result.actions as any).publish as (id: string) => void,
      addTags: (result.actions as any).addTags as (params: { id: string; newTags: string[] }) => void,
    },
    status: {
      ...result.status,
      likePending: (result.status as any).likePending as boolean,
      publishPending: (result.status as any).publishPending as boolean,
      addTagsPending: (result.status as any).addTagsPending as boolean,
    },
  };
}

// ---------- Advanced UI Components ----------
const PostCard = observer(({ post }: { post: PostUiData }) => {
  const { actions, status } = usePosts();
  const [isAddingTags, setIsAddingTags] = useState(false);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim()) {
      actions.addTags({ id: post.id, newTags: [newTag.trim()] });
      setNewTag('');
      setIsAddingTags(false);
    }
  };

  return (
    <article style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
      backgroundColor: 'white',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>{post.title}</h2>
        <div style={{ fontSize: '14px', color: '#666', display: 'flex', gap: '16px' }}>
          <span>{post.timeAgo}</span>
          {post.isPublished ? (
            <span style={{ color: '#4caf50' }}>✓ Published</span>
          ) : (
            <span style={{ color: '#ff9800' }}>📝 Draft</span>
          )}
        </div>
      </div>

      {/* Content */}
      <p style={{ marginBottom: '16px', lineHeight: 1.6 }}>{post.excerpt}</p>

      {/* Tags */}
      <div style={{ marginBottom: '16px' }}>
        {post.tags.map(tag => (
          <span key={tag} style={{
            display: 'inline-block',
            padding: '4px 8px',
            backgroundColor: '#e3f2fd',
            color: '#1976d2',
            borderRadius: '12px',
            fontSize: '12px',
            marginRight: '8px',
            marginBottom: '4px',
          }}>
            {tag}
          </span>
        ))}
        
        {isAddingTags ? (
          <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="New tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              style={{ padding: '2px 6px', fontSize: '12px', width: '80px' }}
            />
            <button onClick={handleAddTag} style={{ padding: '2px 6px', fontSize: '12px' }}>+</button>
            <button onClick={() => setIsAddingTags(false)} style={{ padding: '2px 6px', fontSize: '12px' }}>×</button>
          </div>
        ) : (
          <button 
            onClick={() => setIsAddingTags(true)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#f5f5f5',
              border: '1px dashed #ccc',
              borderRadius: '12px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            + Add tag
          </button>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={() => actions.like(post.id)}
          disabled={status.likePending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ❤️ {post.likes}
        </button>

        {!post.isPublished && (
          <button
            onClick={() => actions.publish(post.id)}
            disabled={status.publishPending}
            style={{
              padding: '8px 12px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {status.publishPending ? 'Publishing...' : 'Publish'}
          </button>
        )}

        <button
          onClick={() => actions.remove(post.id)}
          disabled={status.deletePending}
          style={{
            padding: '8px 12px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
});

const AdvancedPostApp = observer(() => {
  const { store, actions, status } = usePosts();
  const [filter, setFilter] = useState<'all' | 'published' | 'drafts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  const getFilteredPosts = () => {
    let posts = store.byNewest;
    
    // Apply filter
    switch (filter) {
      case 'published': posts = store.publishedPosts; break;
      case 'drafts': posts = store.draftPosts; break;
    }
    
    // Apply search
    if (searchQuery) {
      posts = store.searchPosts(searchQuery);
    }
    
    // Apply tag filter
    if (selectedTag) {
      posts = posts.filter(p => p.tags.includes(selectedTag));
    }
    
    return posts;
  };

  if (status.isLoading) {
    return <div style={{ padding: '20px' }}>Loading posts...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>📝 Advanced Blog Example</h1>
      <p>Showcasing custom stores, transformations, and custom actions</p>

      {status.isSyncing && (
        <div style={{
          padding: '12px',
          backgroundColor: '#e8f5e8',
          borderRadius: '4px',
          marginBottom: '20px',
        }}>
          🔄 Syncing with server...
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{store.count}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Total Posts</div>
        </div>
        <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>{store.publishedPosts.length}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Published</div>
        </div>
        <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>{store.draftPosts.length}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Drafts</div>
        </div>
        <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>{store.allTags.length}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Tags</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'published', 'drafts'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px',
                backgroundColor: filter === f ? '#2196f3' : '#f5f5f5',
                color: filter === f ? 'white' : 'black',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search posts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            minWidth: '200px',
          }}
        />

        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        >
          <option value="">All tags</option>
          {store.allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {/* Posts */}
      <div>
        {getFilteredPosts().map(post => (
          <PostCard key={post.id} post={post} />
        ))}
        
        {getFilteredPosts().length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
            fontStyle: 'italic',
          }}>
            No posts match your current filters
          </div>
        )}
      </div>
    </div>
  );
});

// ---------- App Root ----------
const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdvancedPostApp />
    </QueryClientProvider>
  );
}

/*
🚀 ADVANCED FEATURES DEMONSTRATED:

1. **Custom Data Transformation**: API strings ↔ UI Date objects + computed properties
2. **Extended Store**: Custom methods like searchPosts(), getPostsByTag(), etc.
3. **Custom Actions**: like(), publish(), addTags() with optimistic updates
4. **Rich Filtering**: By status, search, tags
5. **Real-time Stats**: Computed from store data
6. **Complex UI**: Multiple components working together

All while keeping the setup clean and manageable! 💪
*/
