# A Clean Example: Posts Store

This example demonstrates how **clean and simple** the advanced optimistic store pattern can be. You'll see how a few lines of configuration give you instant UI updates, automatic rollback, type-safe transformations, and reactive state—all without any boilerplate.

## The Setup: Just Define Your Types and API

```typescript
import { createOptimisticStore, createDefaultTransformer } from "@kingstack/advanced-optimistic-store";

// API data shape (what comes from the server)
interface PostApiData {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published: boolean;
  created_at: string;      // ISO string from server
  updated_at: string;      // ISO string from server
}

// UI data shape (what your components use)
interface PostUiData {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published: boolean;
  created_at: Date;        // JavaScript Date object
  updated_at: Date;        // JavaScript Date object
  isNew: boolean;          // Computed: less than 24 hours old
  wordCount: number;        // Computed: words in content
}
```

## The Store: One Configuration Object

```typescript
const postStore = createOptimisticStore<PostApiData, PostUiData>({
  name: "posts",
  
  // How to fetch all posts
  queryFn: async () => {
    const response = await fetch("/api/posts");
    return response.json();
  },
  
  // CRUD mutations - each returns the full updated object
  mutations: {
    create: async (data) => {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json(); // Returns full PostApiData
    },
    
    update: async (params) => {
      const { id, data } = params;
      const response = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json(); // Returns full PostApiData
    },
    
    remove: async (id) => {
      await fetch(`/api/posts/${id}`, { method: "DELETE" });
      return { id }; // Just return the ID for deletion
    },
  },
  
  // Transform API data ↔ UI data with computed properties
  transformer: createDefaultTransformer<PostApiData, PostUiData>({
    // Server data → UI data
    toUi: (apiData) => ({
      ...apiData,
      created_at: new Date(apiData.created_at),
      updated_at: new Date(apiData.updated_at),
      isNew: (Date.now() - new Date(apiData.created_at).getTime()) < 24 * 60 * 60 * 1000,
      wordCount: apiData.content.split(/\s+/).filter(Boolean).length,
    }),
    
    // UI data → API data
    toApi: (uiData) => ({
      ...uiData,
      created_at: uiData.created_at.toISOString(),
      updated_at: uiData.updated_at.toISOString(),
    }),
    
    // Optimistic defaults: what to show before server confirms
    optimisticDefaults: {
      createOptimisticUiData: (formData) => ({
        id: `temp-${Date.now()}`,
        ...formData,
        created_at: new Date(),
        updated_at: new Date(),
        isNew: true,
        wordCount: formData.content?.split(/\s+/).filter(Boolean).length || 0,
      }),
    },
  }),
});
```

**That's it.** You now have:
- ✅ Instant optimistic updates
- ✅ Automatic rollback on errors
- ✅ Type-safe data transformations
- ✅ Reactive UI state (MobX)
- ✅ Smart caching (TanStack Query)
- ✅ Loading and error states

## Using It: The API Is Beautifully Simple

### Access Reactive UI Data

```typescript
// Reactive list (MobX observable)
const posts = postStore.ui.list;

// Computed values work automatically
const publishedPosts = posts.filter(p => p.published);
const totalWords = posts.reduce((sum, p) => sum + p.wordCount, 0);
const newPostsCount = posts.filter(p => p.isNew).length;

// Direct lookups
const post = postStore.ui.getById("post-123");
const hasPost = postStore.ui.hasItem("post-123");
```

### Perform Optimistic Mutations

```typescript
// Create - UI updates instantly, server confirms later
await postStore.api.create({
  title: "My New Post",
  content: "This is the content...",
  author_id: "user-123",
  published: false,
});

// Update - checkbox toggles instantly, server confirms
await postStore.api.update("post-123", { published: true });

// Delete - item disappears instantly, server confirms
await postStore.api.remove("post-123");
```

### Check Status

```typescript
// Loading states
const isLoading = postStore.api.status.isLoading;
const isCreating = postStore.api.status.createPending;
const isUpdating = postStore.api.status.updatePending;
const hasErrors = postStore.api.status.isError;
const error = postStore.api.status.error;
```

## In a React Component: Zero Boilerplate

```tsx
import { observer } from "mobx-react-lite";

const PostList = observer(() => {
  const { ui, api } = postStore;
  
  // Reactive data - automatically re-renders when it changes
  const posts = ui.list;
  const publishedCount = posts.filter(p => p.published).length;
  const isLoading = api.status.isLoading;
  
  const handleCreate = async () => {
    await api.create({
      title: "New Post",
      content: "Content here...",
      author_id: "user-123",
      published: false,
    });
  };
  
  const handleTogglePublish = async (id: string, published: boolean) => {
    await api.update(id, { published });
  };
  
  if (isLoading) return <div>Loading posts...</div>;
  
  return (
    <div>
      <h2>Posts ({posts.length})</h2>
      <p>Published: {publishedCount}</p>
      
      {posts.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <p>
            {post.wordCount} words • 
            {post.isNew ? " 🆕 New" : ""} • 
            Created: {post.created_at.toLocaleDateString()}
          </p>
          <button onClick={() => handleTogglePublish(post.id, !post.published)}>
            {post.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      ))}
      
      <button onClick={handleCreate} disabled={api.status.createPending}>
        {api.status.createPending ? "Creating..." : "Create Post"}
      </button>
    </div>
  );
});
```

## What Happens Behind the Scenes

### When You Call `api.create()`:

1. **Instant UI Update** (optimistic)
   - `createOptimisticUiData()` generates a temporary post
   - It appears in `ui.list` immediately
   - User sees the new post right away

2. **Server Request**
   - Mutation runs in the background
   - TanStack Query handles retries and error handling

3. **Confirmation or Rollback**
   - **Success**: Temporary post replaced with server response
   - **Error**: Temporary post removed, UI rolls back automatically

### When Data Transforms:

- **API → UI**: Dates become `Date` objects, computed properties added
- **UI → API**: Dates become ISO strings, computed properties stripped
- **All type-safe**: TypeScript ensures correctness at compile time

### When You Access `ui.list`:

- **MobX observable**: Any component reading it re-renders when it changes
- **No manual subscriptions**: MobX handles reactivity automatically
- **Computed values**: `isNew`, `wordCount` computed on-the-fly

## The Magic: It Just Works

Notice what you **didn't** have to write:

- ❌ No manual optimistic update logic
- ❌ No rollback handlers
- ❌ No cache invalidation code
- ❌ No loading state management
- ❌ No error state management
- ❌ No data transformation boilerplate
- ❌ No subscription/unsubscription logic
- ❌ No reconciliation code

All of that is handled automatically. You just:

1. Define your types
2. Configure the store
3. Use `ui.list` and `api.create/update/remove`

**That's the power of this pattern: maximum functionality with minimum code.**

## Adding Realtime: One More Config Object

If you need realtime updates (WebSocket, SSE, etc.), just add:

```typescript
const postStore = createOptimisticStore<PostApiData, PostUiData>({
  // ... existing config ...
  
  realtime: {
    eventType: "post_update",
    browserId: "browser-123", // Prevents self-echo
    dataExtractor: (event) => event.data.post,
    shouldProcessEvent: (event) => event.type === "post_update",
  },
});

// Later, when socket is ready:
postStore.realtime?.connect(socket);
```

Now realtime events automatically merge into your store, respecting optimistic updates and preventing conflicts. **No additional code needed.**

## The Result

You get a state layer that:

- **Feels instant** - Optimistic updates make everything appear immediate
- **Stays correct** - Server data is always authoritative
- **Stays in sync** - Realtime updates work seamlessly
- **Stays simple** - One configuration, zero boilerplate
- **Stays type-safe** - Full TypeScript support end-to-end

**This is what clean architecture looks like.**

