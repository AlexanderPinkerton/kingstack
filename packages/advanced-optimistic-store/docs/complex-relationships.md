# Complex Relationships: Maintaining Speed with Multiple Entities

When your page combines multiple related entities (posts with authors, comments, tags, etc.), you can still maintain the **instant optimistic updates** and **reactive state** benefits. The key is understanding how to coordinate multiple stores while keeping each one fast and independent.

## The Core Principle: One Store Per Entity

**Each entity type gets its own store.** This keeps the architecture clean and fast:

- ✅ Posts → `postStore`
- ✅ Users → `userStore`  
- ✅ Comments → `commentStore`
- ✅ Tags → `tagStore`

Each store handles its own optimistic updates, caching, and realtime independently. Then you **coordinate them** at the UI layer.

## Pattern 1: Denormalized UI Data (Recommended)

**Include related entity data directly in your UI shape.** This is the fastest approach because you avoid cross-store lookups during rendering.

### Example: Posts with Authors

```typescript
// API returns posts with nested author data
interface PostApiData {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
  author: {  // Nested from server
    id: string;
    username: string;
    email: string;
  };
}

// UI shape includes author data (denormalized)
interface PostUiData {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: Date;
  author: {
    id: string;
    username: string;
    email: string;
    displayName: string;  // Computed from username/email
  };
  // Other computed fields...
  wordCount: number;
  excerpt: string;
}

// Transformer includes author in optimistic data
const postTransformer = {
  toUi: (apiData: PostApiData): PostUiData => ({
    ...apiData,
    created_at: new Date(apiData.created_at),
    author: {
      ...apiData.author,
      displayName: apiData.author.username || apiData.author.email.split("@")[0],
    },
    wordCount: apiData.content.split(/\s+/).length,
    excerpt: apiData.content.substring(0, 150),
  }),
  
  toApi: (uiData: PostUiData): PostApiData => ({
    id: uiData.id,
    title: uiData.title,
    content: uiData.content,
    author_id: uiData.author_id,
    created_at: uiData.created_at.toISOString(),
    author: uiData.author,  // Server expects this
  }),
  
  optimisticDefaults: {
    createOptimisticUiData: (formData, context) => ({
      id: `temp-${Date.now()}`,
      ...formData,
      created_at: new Date(),
      author: context?.currentUser || {
        id: "unknown",
        username: "You",
        email: "you@example.com",
        displayName: "You",
      },
      wordCount: formData.content?.split(/\s+/).length || 0,
      excerpt: formData.content?.substring(0, 150) || "",
    }),
  },
};
```

**Benefits:**
- ✅ No cross-store lookups during render
- ✅ Author data updates instantly with post
- ✅ Works perfectly with optimistic updates
- ✅ Simple to use: `post.author.username` directly

**Trade-off:**
- ⚠️ If author data changes, you need to update all posts (see Pattern 3)

## Pattern 2: Computed Relationships (MobX)

**Use MobX computed properties to derive relationships** from multiple stores. This keeps stores independent but allows reactive cross-store queries.

### Example: Posts with Comment Counts

```typescript
// Root store coordinates multiple stores
class RootStore {
  postStore: OptimisticStore<PostApiData, PostUiData>;
  commentStore: OptimisticStore<CommentApiData, CommentUiData>;
  
  // Computed: posts with their comment counts
  get postsWithCommentCounts() {
    return this.postStore.ui.list.map(post => ({
      ...post,
      commentCount: this.commentStore.ui.list.filter(
        c => c.post_id === post.id
      ).length,
    }));
  }
  
  // Computed: posts by author
  get postsByAuthor() {
    const posts = this.postStore.ui.list;
    const grouped = new Map<string, PostUiData[]>();
    
    posts.forEach(post => {
      const authorPosts = grouped.get(post.author_id) || [];
      authorPosts.push(post);
      grouped.set(post.author_id, authorPosts);
    });
    
    return grouped;
  }
}
```

**In a React component:**

```tsx
const PostList = observer(() => {
  const rootStore = useRootStore();
  
  // Reactive: automatically updates when posts or comments change
  const postsWithCounts = rootStore.postsWithCommentCounts;
  
  return (
    <div>
      {postsWithCounts.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.commentCount} comments</p>
        </div>
      ))}
    </div>
  );
});
```

**Benefits:**
- ✅ Stores remain independent
- ✅ Reactive: updates automatically when any store changes
- ✅ No manual subscriptions needed
- ✅ Type-safe with TypeScript

**Trade-off:**
- ⚠️ Computed values recalculate on every access (MobX optimizes this)
- ⚠️ More complex than denormalized data

## Pattern 3: Coordinated Updates

**When one entity updates, update related entities optimistically.** This keeps everything in sync while maintaining speed.

### Example: Updating Author Name Updates All Posts

```typescript
class RootStore {
  postStore: OptimisticStore<PostApiData, PostUiData>;
  userStore: OptimisticStore<UserApiData, UserUiData>;
  
  // Update user and all their posts optimistically
  async updateUserProfile(userId: string, updates: Partial<UserUiData>) {
    // 1. Update user store
    await this.userStore.api.update(userId, updates);
    
    // 2. Optimistically update all posts by this user
    const userPosts = this.postStore.ui.list.filter(
      p => p.author_id === userId
    );
    
    // Batch update all posts
    await Promise.all(
      userPosts.map(post =>
        this.postStore.api.update(post.id, {
          author: {
            ...post.author,
            ...updates,
          },
        })
      )
    );
  }
}
```

**Better: Use MobX reactions for automatic coordination**

```typescript
import { reaction } from "mobx";

class RootStore {
  constructor() {
    // Automatically sync author changes to posts
    reaction(
      () => this.userStore.ui.list,
      (users) => {
        // When users change, update posts optimistically
        users.forEach(user => {
          const posts = this.postStore.ui.list.filter(
            p => p.author_id === user.id
          );
          
          posts.forEach(post => {
            // Only update if author data actually changed
            if (post.author.id === user.id && 
                post.author.username !== user.username) {
              this.postStore.ui.update(post.id, {
                author: {
                  ...post.author,
                  username: user.username,
                  displayName: user.username,
                },
              });
            }
          });
        });
      }
    );
  }
}
```

**Benefits:**
- ✅ Automatic synchronization
- ✅ Works with optimistic updates
- ✅ No manual coordination needed

**Trade-off:**
- ⚠️ Can trigger many updates if not careful
- ⚠️ Need to prevent infinite loops

## Pattern 4: Composite Queries

**Create helper methods that query multiple stores** for common UI patterns.

### Example: Post Detail Page

```typescript
class RootStore {
  postStore: OptimisticStore<PostApiData, PostUiData>;
  commentStore: OptimisticStore<CommentApiData, CommentUiData>;
  userStore: OptimisticStore<UserApiData, UserUiData>;
  tagStore: OptimisticStore<TagApiData, TagUiData>;
  
  // Get everything needed for a post detail page
  getPostDetail(postId: string) {
    const post = this.postStore.ui.getById(postId);
    if (!post) return null;
    
    const comments = this.commentStore.ui.list.filter(
      c => c.post_id === postId
    );
    
    const author = this.userStore.ui.getById(post.author_id);
    
    // Tags might be stored as IDs in post, or as separate entities
    const tags = post.tag_ids?.map(id => 
      this.tagStore.ui.getById(id)
    ).filter(Boolean) || [];
    
    return {
      post,
      comments,
      author,
      tags,
      commentCount: comments.length,
      // Computed values
      hasComments: comments.length > 0,
      isPublished: post.published,
    };
  }
}
```

**In a component:**

```tsx
const PostDetail = observer(({ postId }: { postId: string }) => {
  const rootStore = useRootStore();
  
  // Reactive: updates when post, comments, or author change
  const detail = rootStore.getPostDetail(postId);
  
  if (!detail) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{detail.post.title}</h1>
      <p>By {detail.author?.username || "Unknown"}</p>
      <p>{detail.commentCount} comments</p>
      
      {detail.comments.map(comment => (
        <div key={comment.id}>{comment.content}</div>
      ))}
    </div>
  );
});
```

**Benefits:**
- ✅ Encapsulates complex queries
- ✅ Reactive: updates automatically
- ✅ Reusable across components
- ✅ Type-safe

## Pattern 5: Realtime Coordination

**Handle realtime updates across relationships** by listening to events in multiple stores.

### Example: Post with Comments Realtime

```typescript
class RootStore {
  postStore: OptimisticStore<PostApiData, PostUiData>;
  commentStore: OptimisticStore<CommentApiData, CommentUiData>;
  
  connectRealtime(socket: Socket) {
    // Posts store handles post updates
    this.postStore.realtime?.connect(socket);
    
    // Comments store handles comment updates
    this.commentStore.realtime?.connect(socket);
    
    // Listen for events that affect multiple stores
    socket.on("post_deleted", (data: { post_id: string }) => {
      // When a post is deleted, optimistically remove all its comments
      const comments = this.commentStore.ui.list.filter(
        c => c.post_id === data.post_id
      );
      
      comments.forEach(comment => {
        this.commentStore.ui.remove(comment.id);
      });
    });
  }
}
```

## Best Practices Summary

### ✅ DO:

1. **One store per entity type** - Keep stores focused and fast
2. **Denormalize for display** - Include related data in UI shape when possible
3. **Use computed properties** - For derived relationships that change frequently
4. **Coordinate at the root** - Use a RootStore to coordinate multiple stores
5. **Batch related updates** - Update multiple stores together when needed
6. **Leverage MobX reactions** - For automatic synchronization

### ❌ DON'T:

1. **Don't create circular dependencies** - Store A shouldn't depend on Store B if B depends on A
2. **Don't duplicate data unnecessarily** - Only denormalize what you need for display
3. **Don't create mega-stores** - One store handling everything defeats the purpose
4. **Don't manually sync everywhere** - Use MobX computed/reactions instead
5. **Don't block on cross-store queries** - Use computed properties for reactive queries

## Complete Example: Blog with Posts, Comments, Authors, and Tags

```typescript
// ===== STORES =====

// 1. Post Store
const postStore = createOptimisticStore<PostApiData, PostUiData>({
  name: "posts",
  queryFn: () => fetch("/api/posts").then(r => r.json()),
  mutations: { /* ... */ },
  transformer: {
    toUi: (apiData) => ({
      ...apiData,
      created_at: new Date(apiData.created_at),
      author: apiData.author, // Denormalized
      tag_ids: apiData.tag_ids, // Just IDs
    }),
    // ...
  },
});

// 2. Comment Store
const commentStore = createOptimisticStore<CommentApiData, CommentUiData>({
  name: "comments",
  queryFn: () => fetch("/api/comments").then(r => r.json()),
  mutations: { /* ... */ },
});

// 3. User Store
const userStore = createOptimisticStore<UserApiData, UserUiData>({
  name: "users",
  queryFn: () => fetch("/api/users").then(r => r.json()),
  mutations: { /* ... */ },
});

// 4. Tag Store
const tagStore = createOptimisticStore<TagApiData, TagUiData>({
  name: "tags",
  queryFn: () => fetch("/api/tags").then(r => r.json()),
  mutations: { /* ... */ },
});

// ===== ROOT STORE =====

class RootStore {
  postStore = postStore;
  commentStore = commentStore;
  userStore = userStore;
  tagStore = tagStore;
  
  // Computed: Posts with full tag objects
  get postsWithTags() {
    return this.postStore.ui.list.map(post => ({
      ...post,
      tags: post.tag_ids
        .map(id => this.tagStore.ui.getById(id))
        .filter(Boolean),
    }));
  }
  
  // Computed: Posts with comment counts
  get postsWithStats() {
    return this.postsWithTags.map(post => ({
      ...post,
      commentCount: this.commentStore.ui.list.filter(
        c => c.post_id === post.id
      ).length,
    }));
  }
  
  // Helper: Get post detail with all related data
  getPostDetail(postId: string) {
    const post = this.postStore.ui.getById(postId);
    if (!post) return null;
    
    return {
      post,
      author: this.userStore.ui.getById(post.author_id),
      comments: this.commentStore.ui.list.filter(c => c.post_id === postId),
      tags: post.tag_ids.map(id => this.tagStore.ui.getById(id)).filter(Boolean),
    };
  }
}

// ===== COMPONENT =====

const BlogPage = observer(() => {
  const rootStore = useRootStore();
  
  // Reactive: updates when any store changes
  const posts = rootStore.postsWithStats;
  
  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author.username}</p>
          <p>{post.commentCount} comments</p>
          <div>
            {post.tags.map(tag => (
              <span key={tag.id}>{tag.name}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
```

## The Result

Even with complex relationships, you get:

- ✅ **Instant optimistic updates** - Each store updates independently
- ✅ **Reactive cross-store queries** - MobX computed properties handle coordination
- ✅ **Type safety** - Full TypeScript support across relationships
- ✅ **Simple mental model** - One store per entity, coordinate at the root
- ✅ **Maintainable** - Clear boundaries, easy to test and evolve

**The key insight:** Keep stores independent and fast, then coordinate them reactively at the UI layer. This gives you the speed of independent stores with the power of coordinated relationships.

