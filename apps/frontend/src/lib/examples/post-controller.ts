// Example: Post Controller with advanced features

import { EntityAPI, OptimisticStore, createEntityController } from "../optimistic-store-pattern";

// ---------- Post Types ----------
export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface CreatePostData {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdatePostData {
  title?: string;
  content?: string;
  tags?: string[];
}

// ---------- Post API ----------
export class PostAPI implements EntityAPI<Post, CreatePostData, UpdatePostData> {
  async list(): Promise<Post[]> {
    const response = await fetch('/api/posts');
    if (!response.ok) throw new Error('Failed to fetch posts');
    return response.json();
  }

  async create(data: CreatePostData): Promise<Post> {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create post');
    return response.json();
  }

  async update(id: string, data: UpdatePostData): Promise<Post> {
    const response = await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update post');
    return response.json();
  }

  async delete(id: string): Promise<{ id: string }> {
    const response = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete post');
    return { id };
  }

  // Post-specific endpoints
  async like(id: string): Promise<Post> {
    const response = await fetch(`/api/posts/${id}/like`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to like post');
    return response.json();
  }

  async unlike(id: string): Promise<Post> {
    const response = await fetch(`/api/posts/${id}/like`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to unlike post');
    return response.json();
  }
}

// ---------- Enhanced Post Store ----------
export class PostStore extends OptimisticStore<Post> {
  // Sorting and filtering
  get byNewest(): Post[] {
    return [...this.list].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  get byPopularity(): Post[] {
    return [...this.list].sort((a, b) => b.likes - a.likes);
  }

  get likedPosts(): Post[] {
    return this.filter(post => post.isLiked);
  }

  filterByTag(tag: string): Post[] {
    return this.filter(post => post.tags.includes(tag));
  }

  filterByAuthor(authorId: string): Post[] {
    return this.filter(post => post.authorId === authorId);
  }

  // Search functionality
  search(query: string): Post[] {
    const lowerQuery = query.toLowerCase();
    return this.filter(post => 
      post.title.toLowerCase().includes(lowerQuery) ||
      post.content.toLowerCase().includes(lowerQuery) ||
      post.authorName.toLowerCase().includes(lowerQuery) ||
      post.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // Analytics
  get totalLikes(): number {
    return this.list.reduce((sum, post) => sum + post.likes, 0);
  }

  get allTags(): string[] {
    const tagSet = new Set<string>();
    this.list.forEach(post => {
      post.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  // Optimistic operations
  toggleLikeLocal(id: string) {
    const post = this.get(id);
    if (post) {
      this.update(id, {
        isLiked: !post.isLiked,
        likes: post.isLiked ? post.likes - 1 : post.likes + 1,
      });
    }
  }
}

// ---------- Controller Setup ----------
const postStore = new PostStore();
const postAPI = new PostAPI();

export const usePostsController = createEntityController({
  queryKey: ['posts'],
  api: postAPI,
  store: postStore,
  staleTime: 30_000, // Posts don't change as frequently
  customActions: {
    // Like/Unlike actions
    toggleLike: {
      mutationFn: async (id: string) => {
        const post = postStore.get(id);
        if (!post) throw new Error('Post not found');
        
        return post.isLiked 
          ? postAPI.unlike(id)
          : postAPI.like(id);
      },
      onOptimistic: (id: string, store: PostStore) => {
        store.toggleLikeLocal(id);
      },
      onSuccess: (result, _id, store: PostStore) => {
        store.upsert(result);
      },
    },

    // Batch operations
    deletePostsByAuthor: {
      mutationFn: async (authorId: string) => {
        const authorPosts = postStore.filterByAuthor(authorId);
        await Promise.all(authorPosts.map(post => postAPI.delete(post.id)));
        return { deletedIds: authorPosts.map(p => p.id) };
      },
      onOptimistic: (authorId: string, store: PostStore) => {
        const authorPosts = store.filterByAuthor(authorId);
        authorPosts.forEach(post => store.remove(post.id));
      },
    },

    // Advanced update with optimistic tags
    updateWithTags: {
      mutationFn: async ({ id, data }: { id: string; data: UpdatePostData & { addTags?: string[]; removeTags?: string[] } }) => {
        const post = postStore.get(id);
        if (!post) throw new Error('Post not found');

        let newTags = [...post.tags];
        if (data.addTags) {
          newTags = [...new Set([...newTags, ...data.addTags])];
        }
        if (data.removeTags) {
          newTags = newTags.filter(tag => !data.removeTags!.includes(tag));
        }

        return postAPI.update(id, { ...data, tags: newTags });
      },
      onOptimistic: ({ id, data }, store: PostStore) => {
        const post = store.get(id);
        if (!post) return;

        let newTags = [...post.tags];
        if (data.addTags) {
          newTags = [...new Set([...newTags, ...data.addTags])];
        }
        if (data.removeTags) {
          newTags = newTags.filter(tag => !data.removeTags!.includes(tag));
        }

        store.update(id, { ...data, tags: newTags });
      },
      onSuccess: (result, _params, store: PostStore) => {
        store.upsert(result);
      },
    },
  },
});

// ---------- Usage Examples ----------
/*
// In a React component:
import { observer } from "mobx-react-lite";

const PostFeed = observer(() => {
  const { store, actions, status } = usePostsController();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  const displayedPosts = useMemo(() => {
    let posts = store.byNewest;
    
    if (searchQuery) {
      posts = store.search(searchQuery);
    }
    
    if (selectedTag) {
      posts = posts.filter(p => p.tags.includes(selectedTag));
    }
    
    return posts;
  }, [searchQuery, selectedTag, store.list]);

  return (
    <div>
      <input 
        placeholder="Search posts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      
      <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
        <option value="">All tags</option>
        {store.allTags.map(tag => (
          <option key={tag} value={tag}>{tag}</option>
        ))}
      </select>

      <div>Total likes across all posts: {store.totalLikes}</div>
      
      {displayedPosts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
          <div>By: {post.authorName}</div>
          <div>Tags: {post.tags.join(', ')}</div>
          
          <button 
            onClick={() => actions.toggleLike(post.id)}
            disabled={status.toggleLikePending}
          >
            {post.isLiked ? '❤️' : '🤍'} {post.likes}
          </button>
          
          <button onClick={() => actions.remove(post.id)}>
            Delete
          </button>
        </article>
      ))}
    </div>
  );
});

// Tag management component
const TagManager = observer(() => {
  const { store, actions } = usePostsController();
  const [postId, setPostId] = useState("");
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    if (postId && newTag) {
      actions.updateWithTags({ 
        id: postId, 
        data: { addTags: [newTag] } 
      });
      setNewTag("");
    }
  };

  return (
    <div>
      <select value={postId} onChange={(e) => setPostId(e.target.value)}>
        <option value="">Select a post</option>
        {store.list.map(post => (
          <option key={post.id} value={post.id}>{post.title}</option>
        ))}
      </select>
      
      <input 
        value={newTag}
        onChange={(e) => setNewTag(e.target.value)}
        placeholder="New tag"
      />
      
      <button onClick={addTag}>Add Tag</button>
    </div>
  );
});
*/
