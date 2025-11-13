# @kingstack/advanced-optimistic-store

> **Framework-agnostic optimistic updates with MobX + TanStack Query Core + optional realtime**

Modern apps need to feel instant, stay correct, and scale without turning your state layer into a ball of mud. **@kingstack/advanced-optimistic-store (AOS)** gives you that balance by combining MobX, TanStack Query Core, and optional realtime into a single, coherent pattern.

## Why Use Advanced Optimistic Store?

### ⚡ Instant, Confident UX

Give users the feeling that everything happens immediately—because from their perspective, it does.

* Optimistic updates apply instantly, before the server responds
* Automatic rollback keeps your UI honest when something fails
* No more "loading…" flicker for every small interaction

Your app feels like it's running on local data, while still staying fully in sync with the backend.

### 🧠 Clear Separation of Concerns

Stop forcing one tool to do everything.

* **UI domain (MobX)** handles reactive lists, computed values, snapshots, and rollback
* **API domain (TanStack Query Core)** manages caching, fetches, mutations, and background syncing
* **Transformation layer** cleanly maps API data ↔ UI data with type safety

You get a state model that's easy to reason about, test, and evolve—without hidden coupling between your UI and API logic.

### 🗃️ Perfect Fit for CRUD Backends

AOS really shines when paired with a straightforward backend design:

* A **DB table or collection** for each entity
* A clean **CRUD API** for that entity
* **Mutation endpoints that return the full updated object**

This makes optimistic updates trivial: the UI instantly shows the change, and the server's response "locks in" the final, authoritative version without extra refetching or reconciliation hacks.

### 🧾 Forms That Map Directly to Operations

For maximum speed and clarity, each mutation is best paired with its own form:

* A form per operation (create, update, etc.)
* Fields match the **UI data shape** (or a subset of it)
* Minimal transformation between what the user fills out and what the API expects

That means fewer bugs, less glue code, and a more intuitive mental model:
**"This form drives this mutation, which updates this store."**

### 🌐 Realtime-Ready When You Are

If your app needs realtime updates, AOS plugs into WebSockets or other event sources without rewriting your state layer:

* Realtime events merge into the same optimistic store
* Conflict resolution and self-echo prevention are built in
* Local optimistic changes and remote updates stay in sync

You don't have to choose between "optimistic" and "realtime" — you get both.

### 🧩 Framework-Agnostic, Future-Proof

AOS is designed to slot into your stack, not lock you into one.

* Works with React, Vue, Svelte, or vanilla JS
* UI stays powered by MobX observables
* API logic stays powered by TanStack Query Core
* Your data model stays consistent across the entire app

You can refactor your UI layer, evolve your API, or add realtime later—without rewriting how your state works.

### 💻 Developer Experience That Feels Right

* No more hand-rolling optimistic logic for every feature
* No more guessing how API data will flow into the UI
* No more bolting realtime onto an already fragile state layer

Instead, you get a **single, opinionated pattern**:

> A DB table → a CRUD API → an AOS store → forms and components bound to a fast, optimistic, reactive UI.

The end result: a system that feels instant to users, predictable to developers, and scalable for your product.

## 🚀 Quick Start: A Complete Example

This example demonstrates how **clean and simple** the advanced optimistic store pattern can be. You'll see how a few lines of configuration give you instant UI updates, automatic rollback, type-safe transformations, and reactive state—all without any boilerplate.

### Step 1: Define Your Types

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

### Step 2: Create the Store

```typescript
const postStore = createOptimisticStore<PostApiData, PostUiData>({
  name: "posts",
  
  // How to fetch all posts
  queryFn: async () => {
    const response = await fetch("/api/posts");
    return response.json();
  },
  
  // CRUD mutations - each returns the full updated object
  // **IMPORTANT**: If your CRUD API endpoints do not return the object, instant update confirmations will not work!
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

### Step 3: Use It

#### Access Reactive UI Data

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

#### Perform Optimistic Mutations

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

#### Check Status

```typescript
// Loading states
const isLoading = postStore.api.status.isLoading;
const isCreating = postStore.api.status.createPending;
const isUpdating = postStore.api.status.updatePending;
const hasErrors = postStore.api.status.isError;
const error = postStore.api.status.error;
```

### Step 4: Use in a React Component

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

## 🎯 What Happens Behind the Scenes

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

## ✨ The Magic: It Just Works

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

## 🌐 Adding Realtime: One More Config Object

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


## 🔧 API Reference

### `createOptimisticStore<TApiData, TUiData>(config)`

Creates an optimistic store with clear separation between UI and API domains.

#### Configuration

```typescript
interface OptimisticStoreConfig<TApiData, TUiData> {
  name: string;                    // Unique identifier for query keys
  queryFn: () => Promise<TApiData[]>;  // Fetch all items
  mutations: {
    create: (data: any) => Promise<TApiData>;
    update: (id: string, data: any) => Promise<TApiData>;
    remove: (id: string) => Promise<{ id: string } | void>;
  };
  transformer?: DataTransformer<TApiData, TUiData> | false;
  optimisticDefaults?: OptimisticDefaults<TUiData>;
  staleTime?: number;              // Cache time in ms (default: 5 minutes)
  enabled?: () => boolean;         // Query enable condition
  realtime?: RealtimeConfig<TUiData>;
}
```

#### Return Value

```typescript
interface OptimisticStore<TApiData, TUiData> {
  // UI Domain - MobX observable state
  ui: ObservableUIData<TUiData>;
  
  // API Domain - TanStack Query + mutations
  api: {
    // Optimistic mutations
    create: (data: any) => Promise<TApiData>;
    update: (id: string, data: any) => Promise<TApiData>;
    remove: (id: string) => Promise<{ id: string } | void>;
    
    // Query control
    refetch: () => Promise<any>;
    invalidate: () => Promise<void>;
    triggerQuery: () => void;
    
    // Query state
    status: {
      isLoading: boolean;
      isError: boolean;
      error: Error | null;
      isSyncing: boolean;
      createPending: boolean;
      updatePending: boolean;
      deletePending: boolean;
      hasPendingMutations: boolean;
    };
  };
  
  // Lifecycle methods
  updateOptions: () => void;
  enable: () => void;
  disable: () => void;
  destroy: () => void;
  
  // Realtime (if configured)
  realtime?: {
    isConnected: boolean;
    connect: (socket: any) => void;
    disconnect: () => void;
  };
}
```

### `ObservableUIData<TUiData>`

The MobX store that holds your UI data with reactive access patterns.

```typescript
interface ObservableUIData<TUiData> {
  list: TUiData[];                 // Reactive array of items
  count: number;                   // Computed count
  entities: Map<string, TUiData>;  // Map for O(1) lookups
  
  // Methods
  getById(id: string): TUiData | undefined;
  hasItem(id: string): boolean;
  snapshot(): TUiData[];           // Non-reactive snapshot
  
  // Internal methods (used by the store)
  upsert(item: TUiData): void;
  update(id: string, updates: Partial<TUiData>): void;
  remove(id: string): void;
  reconcile(items: TUiData[]): void;
  pushSnapshot(): void;
  rollback(): void;
}
```

## 🎯 Why This Approach?

### The Problem with Other Solutions

**TanStack Query alone:**
- ❌ Complex optimistic updates require lots of boilerplate
- ❌ No reactive computed values
- ❌ Difficult to manage UI-specific state

**MobX alone:**
- ❌ No built-in server state caching
- ❌ Manual cache invalidation
- ❌ No background sync capabilities

**Redux + RTK Query:**
- ❌ Boilerplate-heavy
- ❌ Complex optimistic updates
- ❌ No reactive computed values

### Our Solution

**Clear Separation of Concerns:**
- 🎯 **UI Domain**: MobX handles reactive state, computed values, optimistic updates
- 🎯 **API Domain**: TanStack Query handles server state, caching, background sync
- 🎯 **Transformation Layer**: Type-safe conversion between API and UI formats

**Best of Both Worlds:**
- ✅ Instant optimistic updates with automatic rollback
- ✅ Reactive computed values and derived state
- ✅ Smart server state caching and invalidation
- ✅ Seamless realtime synchronization
- ✅ Type-safe data transformations
- ✅ Framework agnostic

## 📦 Installation

```bash
# In your monorepo workspace
yarn add @kingstack/advanced-optimistic-store

# Peer dependencies (you probably already have these)
yarn add mobx @tanstack/query-core
```

## 🤝 Contributing

This is an internal package for the KingStack monorepo. For external contributions, please open an issue first.
