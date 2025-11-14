# State Management Architecture

KingStack uses a sophisticated state management pattern that combines **MobX** for reactive UI state with **TanStack Query** for server state management, orchestrated through a centralized **RootStore** pattern.

> **🤖 For AI Assistants**: See [ai-explanation.md](./ai-explanation.md) for a streamlined guide focused on implementation patterns and wiring.

## 🎯 Overview

The state management architecture follows a **three-layer approach**:

1. **RootStore** - A singleton MobX store that orchestrates SessionManager and RealtimeManager
2. **Store Managers** - UserStoreManager and AdminStoreManager handle lazy loading and lifecycle of domain stores
3. **Advanced Optimistic Stores** - Individual domain stores that combine MobX observables with TanStack Query for optimistic updates

This pattern provides:
- ✅ **Instant UI feedback** with optimistic updates
- ✅ **Automatic rollback** on errors
- ✅ **Reactive computed values** via MobX
- ✅ **Smart server state caching** via TanStack Query
- ✅ **Realtime synchronization** via WebSocket
- ✅ **Type-safe data transformations** between API and UI formats
- ✅ **Playground mode** for development without backend

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                         │
│  (use observer() from mobx-react-lite)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ useRootStore()
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    RootStore (Singleton)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • SessionManager (auth state & lifecycle)            │   │
│  │ • RealtimeManager (WebSocket connections)           │   │
│  │ • Browser ID (for self-echo prevention)             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐          │
│  │ UserStoreManager    │  │ AdminStoreManager    │          │
│  │ (Lazy-loaded)       │  │ (Lazy-loaded)       │          │
│  └──────────┬──────────┘  └──────────┬──────────┘          │
│             │                        │                      │
│  ┌──────────▼──────────┐  ┌──────────▼──────────┐          │
│  │ postStore           │  │ adminMgmtStore      │          │
│  │ checkboxStore       │  │ (created on access) │          │
│  │ publicTodoStore    │  └─────────────────────┘          │
│  │ currentUserStore   │                                    │
│  │ (created on access)│                                    │
│  └──────────┬──────────┘                                    │
└─────────────┼───────────────────────────────────────────────┘
              │
              │ wraps
              │
┌─────────────▼───────────────────────────────────────────────┐
│         @kingstack/advanced-optimistic-store               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ UI Domain (MobX)      │  API Domain (TanStack Query) │ │
│  │ • Observable state    │  • Mutations                 │ │
│  │ • Optimistic updates  │  • Query caching             │ │
│  │ • Computed values     │  • Background sync           │ │
│  │ • Snapshot/rollback   │  • Loading states            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Data Transformation Layer                            │ │
│  │ • API data → UI data (with computed fields)          │ │
│  │ • UI data → API data (for mutations)                │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Optional Realtime Layer                              │ │
│  │ • WebSocket integration                              │ │
│  │ • Conflict resolution                                │ │
│  │ • Self-echo prevention                               │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 📦 RootStore Pattern

The `RootStore` is a **singleton MobX store** that serves as the central orchestrator for all application state.

### Key Responsibilities

1. **Orchestration**
   - Coordinates SessionManager and RealtimeManager
   - Provides singleton access point for all stores
   - Manages browser ID for self-echo prevention

2. **Session Management (via SessionManager)**
   - Listens to Supabase auth state changes
   - Updates store managers when session changes
   - Handles playground mode detection
   - Manages JWT token distribution to stores

3. **Realtime Management (via RealtimeManager)**
   - Creates and manages WebSocket connections (Socket.io)
   - Connects/disconnects stores that support realtime
   - Registers stores lazily as they're created

4. **Store Manager Coordination**
   - Creates UserStoreManager and AdminStoreManager
   - Delegates store lifecycle to managers
   - Cleans up managers on disposal (prevents memory leaks)

### RootStore Structure

```typescript
export class RootStore {
  // Session management (via SessionManager)
  private sessionManager: SessionManager;
  session: SupabaseSession = null;
  
  // Realtime management (via RealtimeManager)
  private realtimeManager: RealtimeManager;
  get socket(): Socket | null;
  
  // Store managers (lazy-loaded stores)
  userStore: UserStoreManager;
  adminStore: AdminStoreManager;
  
  // Browser ID for self-echo prevention
  browserId: string;
  
  // Lifecycle
  dispose(): void;
  refreshSession(): Promise<void>;
  static getInstance(): RootStore | null;
  static hasActiveInstance(): boolean;
}
```

### Initialization Flow

```typescript
// 1. RootStore is created once (singleton, managed by SingletonManager)
const rootStore = new RootStore();

// 2. Constructor creates store managers (stores are lazy-loaded)
this.userStore = new UserStoreManager();
this.adminStore = new AdminStoreManager();

// 3. SessionManager handles authentication state
this.sessionManager = new SessionManager({
  stores: [], // Stores registered lazily via store managers
  onSessionChange: (session, event) => {
    this.session = session;
    
    // Update store managers with new session
    this.userStore.updateSession(session);
    
    // Setup/teardown realtime based on session
    if (session?.access_token && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      this.realtimeManager.setup(session.access_token);
    } else if (!session?.access_token) {
      this.realtimeManager.teardown();
    }
  },
});

// 4. RealtimeManager handles WebSocket connections
this.realtimeManager = new RealtimeManager({
  stores: [], // Stores registered lazily via store managers
  browserId: this.browserId,
});

// 5. Store managers register with realtime manager
this.userStore.registerRealtime(this.realtimeManager);
this.adminStore.registerRealtime(this.realtimeManager);

// 6. SessionManager initializes (sets up auth listener or playground mode)
this.sessionManager.initialize();
```

### Realtime Connection Flow

```typescript
// When authenticated, RootStore's SessionManager callback triggers
onSessionChange: (session, event) => {
  if (session?.access_token && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
    // RealtimeManager sets up WebSocket connection
    this.realtimeManager.setup(session.access_token);
  }
}

// RealtimeManager handles connection internally
setup(token: string) {
  this.socket = io(REALTIME_SERVER_URL);
  
  this.socket.on("connect", () => {
    this.socket?.emit("register", { token, browserId: this.browserId });
    
    // Connect all registered stores that support realtime
    this.stores.forEach((store) => {
      if (store.connectRealtime) {
        store.connectRealtime(this.socket!);
      } else if (store.realtime?.connect) {
        store.realtime.connect(this.socket!);
      }
    });
  });
}

// Store managers register their realtime stores lazily
// When a store with realtime support is first accessed, it's registered
```

---

## 🎨 Store Manager Pattern

Stores are managed through **Store Managers** that implement lazy loading and lifecycle management:

### UserStoreManager Structure

```typescript
export class UserStoreManager extends StoreManager {
  // Store registry - defines all available stores
  private readonly storeConfigs: StoreConfig<any>[] = [
    {
      name: "postStore",
      factory: () => new AdvancedPostStore(),
      requiresAuth: true,
      supportsRealtime: false,
    },
    {
      name: "checkboxStore",
      factory: () => new RealtimeCheckboxStore(this.browserId),
      requiresAuth: false,
      supportsRealtime: true,
    },
    // ... more stores
  ];

  // Store instances cache (lazy-loaded)
  private readonly stores = new Map<string, any>();

  // Type-safe getters (create stores on first access)
  get postStore(): AdvancedPostStore {
    return this.getStore<AdvancedPostStore>("postStore");
  }

  get checkboxStore(): RealtimeCheckboxStore {
    return this.getStore<RealtimeCheckboxStore>("checkboxStore");
  }

  // Generic lazy getter
  private getStore<T>(name: string): T {
    // Return cached if exists
    if (this.stores.has(name)) {
      return this.stores.get(name);
    }

    // Create from registry
    const config = this.storeConfigs.find((c) => c.name === name);
    const store = config.factory();
    this.stores.set(name, store);
    this.ensureInitialized();
    return store;
  }

  // Initialize all stores with session
  initialize(session: SupabaseSession | null): void {
    // Create all stores, enable those requiring auth
    const token = session?.access_token || "playground-token";
    this.getAuthStores().forEach((store) => store.enable(token));
  }

  // Update session (called by RootStore on auth changes)
  updateSession(session: SupabaseSession | null): void {
    this.initialize(session);
  }
}
```

### Individual Store Structure

Each domain store (e.g., `AdvancedPostStore`) wraps the `createOptimisticStore` function:

```typescript
export class AdvancedPostStore {
  private optimisticStore: OptimisticStore<PostApiData, PostUiData> | null = null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Store is created but disabled until auth is available
    this.initialize();
  }

  // Enable store with auth token (called by StoreManager)
  enable(authToken: string): void {
    this.authToken = authToken;
    this.isEnabled = true;
    this.optimisticStore?.updateOptions();
  }

  // Disable store (called by StoreManager)
  disable(): void {
    this.isEnabled = false;
    this.authToken = null;
    this.optimisticStore?.updateOptions();
  }

  // Expose UI domain (MobX observable)
  get ui() {
    return this.optimisticStore?.ui || null;
  }

  // Expose API domain (mutations + query control)
  get api() {
    return this.optimisticStore?.api || null;
  }
}
```

### Key Features

1. **Lazy Loading Pattern**
   - Stores are created only when first accessed via getter
   - Reduces initial bundle size and memory footprint
   - Store managers maintain a registry of available stores

2. **Enable/Disable Pattern**
   - Stores are created but disabled by default
   - StoreManager enables them when session is available
   - Prevents unnecessary API calls when not authenticated

3. **Playground Mode Support**
   - Detects playground mode via `isPlaygroundMode()`
   - Switches between API and mock implementations
   - No authentication required
   - SessionManager handles playground mode automatically

4. **Data Transformation**
   - Converts API data (ISO strings) to UI data (Date objects)
   - Adds computed fields (e.g., `isNew`, `readingTime`)
   - Type-safe transformations

5. **Realtime Support (Optional)**
   - Some stores support realtime (e.g., `RealtimeCheckboxStore`)
   - RealtimeManager handles WebSocket connections
   - Stores register with RealtimeManager when created
   - Browser ID prevents self-echo

### Example: AdvancedPostStore

```typescript
export class AdvancedPostStore {
  private initialize() {
    this.optimisticStore = createOptimisticStore<PostApiData, PostUiData>({
      name: "posts",
      queryFn: this.getQueryFn(), // Switches based on playground mode
      mutations: {
        create: this.getCreateMutation(),
        update: this.getUpdateMutation(),
        remove: this.getDeleteMutation(),
      },
      transformer: {
        toUi: (apiData) => ({
          ...apiData,
          created_at: new Date(apiData.created_at),
          updated_at: new Date(apiData.updated_at),
          // Computed fields
          isNew: this.isPostNew(apiData.created_at),
          readingTime: this.calculateReadingTime(apiData.content),
        }),
        toApi: (uiData) => ({
          ...uiData,
          created_at: uiData.created_at.toISOString(),
          updated_at: uiData.updated_at.toISOString(),
        }),
        optimisticDefaults: {
          createOptimisticUiData: (userInput) => ({
            id: `temp-${Date.now()}`,
            ...userInput,
            created_at: new Date(),
            updated_at: new Date(),
          }),
        },
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: () => this.isEnabled && !!this.authToken,
    });
  }
}
```

---

## 🔌 Realtime Integration

Stores can optionally support realtime updates via WebSocket. The `RealtimeCheckboxStore` demonstrates this pattern:

```typescript
export class RealtimeCheckboxStore {
  public optimisticStore: ReturnType<typeof createOptimisticStore>;

  constructor(browserId?: string) {
    this.optimisticStore = createOptimisticStore({
      name: "checkboxes",
      // ... queryFn, mutations, transformer
      realtime: {
        eventType: "checkbox_update",
        dataExtractor: (event) => event.checkbox || event.data,
        shouldProcessEvent: (event) => event.type === "checkbox_update",
        browserId: browserId, // Prevents self-echo
      },
    });
  }

  // RootStore calls these methods
  connectRealtime(socket: any): void {
    this.optimisticStore.realtime?.connect(socket);
  }

  disconnectRealtime(): void {
    this.optimisticStore.realtime?.disconnect();
  }
}
```

### Realtime Flow

1. **RootStore** creates WebSocket connection when authenticated
2. **RootStore** calls `connectRealtime(socket)` on stores that support it
3. **Store** subscribes to realtime events via the optimistic store
4. **Events** are filtered by `browserId` to prevent self-echo
5. **Updates** are applied optimistically and reconciled with server state

---

## 🎯 Usage in Components

### Setup

```typescript
// 1. Create RootStore once (in context file)
const rootStore = new RootStore();
export const RootStoreContext = createContext(rootStore);

// 2. Provide RootStore to app (via context)
// RootStore is created at module level, so it's available everywhere

// 3. Use in components
import { observer } from "mobx-react-lite";
import { useRootStore } from "@/hooks/useRootStore";

export default observer(function PostList() {
  const rootStore = useRootStore();
  const { ui, api } = rootStore.userStore.postStore;

  // Reactive data (MobX)
  const posts = ui?.list || [];
  const isLoading = api?.status.isLoading || false;

  // Optimistic mutations
  const handleCreate = () => {
    api?.create({ title: "New post", content: "Post content" });
  };

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
});
```

### Key Points

1. **Always use `observer()`** - Wraps component to react to MobX changes
2. **Access via Store Managers** - `rootStore.userStore.postStore`, `rootStore.userStore.checkboxStore`, etc.
3. **Lazy Loading** - Stores are created on first access, not at RootStore initialization
4. **Use `ui` for reactive data** - MobX observables, computed values
5. **Use `api` for mutations** - Optimistic updates, query control
6. **Null checks** - Stores may be disabled, so check for null
7. **Admin Stores** - Require explicit initialization: `rootStore.adminStore.initializeWithSession(session)`

---

## 🔄 Data Flow

### Optimistic Update Flow

```
User Action
    │
    ▼
Component calls api.create({ title: "New todo" })
    │
    ▼
Optimistic Store
    │
    ├─► 1. Create optimistic UI data (temp ID, current timestamp)
    │   └─► UI updates instantly (MobX reactive)
    │
    ├─► 2. Send mutation to server
    │   └─► TanStack Query handles request
    │
    └─► 3. Server responds
        ├─► Success: Replace optimistic data with server data
        └─► Error: Rollback optimistic data (snapshot restored)
```

### Realtime Update Flow

```
Server Event (via WebSocket)
    │
    ▼
RootStore receives event
    │
    ▼
Store's realtime handler
    │
    ├─► Filter by browserId (prevent self-echo)
    │
    ├─► Extract data via dataExtractor
    │
    └─► Apply update to UI (MobX observable)
        └─► UI updates reactively
```

### Authentication Flow

```
User Signs In
    │
    ▼
Supabase Auth State Change
    │
    ▼
SessionManager Auth Listener
    │
    ▼
RootStore onSessionChange Callback
    │
    ├─► Update observable session
    ├─► userStore.updateSession(session)
    │   └─► Initialize stores, enable those requiring auth
    ├─► realtimeManager.setup(token)
    │   └─► Connect stores that support realtime
    └─► Admin stores require explicit initialization
```

---

## 🎮 Playground Mode

Playground mode allows development without a Supabase backend:

```typescript
// SessionManager automatically detects playground mode
// In rootStore.ts constructor:
this.sessionManager = new SessionManager({
  stores: [], // Stores registered lazily
  onSessionChange: (session, event) => {
    // Handle session changes
  },
});

// SessionManager.initialize() detects playground mode:
if (isPlaygroundMode() || !supabase) {
  // Enable all registered stores with playground token
  this.stores.forEach((store) => {
    store.enable("playground-token");
  });
}
```

### Playground Features

- **Mock Data** - Uses `getMockData()` from `@kingstack/shared`
- **Simulated Delays** - Async operations have artificial delays
- **No Authentication** - Stores work without Supabase
- **No Realtime** - WebSocket connections are skipped

---

## 🛠️ Creating a New Store

### Step 1: Define Types

```typescript
// API data (from server)
export interface MyEntityApiData {
  id: string;
  name: string;
  created_at: string; // ISO string
}

// UI data (for frontend)
export interface MyEntityUiData {
  id: string;
  name: string;
  created_at: Date; // JavaScript Date
  isNew: boolean; // Computed field
}
```

### Step 2: Create Store Class

```typescript
import { createOptimisticStore } from "@kingstack/advanced-optimistic-store";
import { fetchWithAuth } from "@/lib/utils";
import { isPlaygroundMode, getMockData } from "@kingstack/shared";

export class AdvancedMyEntityStore {
  private optimisticStore: OptimisticStore<MyEntityApiData, MyEntityUiData> | null = null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.optimisticStore = createOptimisticStore<MyEntityApiData, MyEntityUiData>({
      name: "my-entities",
      queryFn: this.getQueryFn(),
      mutations: {
        create: this.getCreateMutation(),
        update: this.getUpdateMutation(),
        remove: this.getDeleteMutation(),
      },
      transformer: {
        toUi: (apiData) => ({
          ...apiData,
          created_at: new Date(apiData.created_at),
          isNew: this.isEntityNew(apiData.created_at),
        }),
        toApi: (uiData) => ({
          ...uiData,
          created_at: uiData.created_at.toISOString(),
        }),
        optimisticDefaults: {
          createOptimisticUiData: (userInput) => ({
            id: `temp-${Date.now()}`,
            ...userInput,
            created_at: new Date(),
            isNew: true,
          }),
        },
      },
      staleTime: 5 * 60 * 1000,
      enabled: () => this.isEnabled && !!this.authToken,
    });
  }

  enable(authToken: string) {
    this.authToken = authToken;
    this.isEnabled = true;
    this.optimisticStore?.updateOptions();
  }

  disable() {
    this.isEnabled = false;
    this.authToken = null;
    this.optimisticStore?.updateOptions();
  }

  get ui() {
    return this.optimisticStore?.ui || null;
  }

  get api() {
    return this.optimisticStore?.api || null;
  }

  // API implementations
  private getQueryFn() {
    return isPlaygroundMode() ? this.playgroundQueryFn : this.apiQueryFn;
  }

  private apiQueryFn = async (): Promise<MyEntityApiData[]> => {
    const token = this.authToken || "";
    const baseUrl = process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/my-entities`).then((res) => res.json());
  };

  private playgroundQueryFn = async (): Promise<MyEntityApiData[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return getMockData("my-entities") as MyEntityApiData[];
  };

  // ... other mutation implementations
}
```

### Step 3: Add to Store Manager

```typescript
// In userApp/userStoreManager.ts (or adminApp/adminStoreManager.ts)
import { AdvancedMyEntityStore } from "./myEntityStore";

export class UserStoreManager extends StoreManager {
  // Add to store registry
  private readonly storeConfigs: StoreConfig<any>[] = [
    // ... existing stores
    {
      name: "myEntityStore",
      factory: () => new AdvancedMyEntityStore(),
      requiresAuth: true, // or false
      supportsRealtime: false, // or true
    },
  ];

  // Add type-safe getter
  get myEntityStore(): AdvancedMyEntityStore {
    return this.getStore<AdvancedMyEntityStore>("myEntityStore");
  }

  // StoreManager automatically handles enable/disable via getAuthStores()
  // No additional code needed - it's handled by the registry pattern
}
```

### Step 4: Use in Components

```typescript
import { observer } from "mobx-react-lite";
import { useRootStore } from "@/hooks/useRootStore";

export default observer(function MyEntityList() {
  const rootStore = useRootStore();
  const { ui, api } = rootStore.userStore.myEntityStore; // Access via userStore manager

  const entities = ui?.list || [];

  return (
    <div>
      {entities.map(entity => (
        <div key={entity.id}>{entity.name}</div>
      ))}
    </div>
  );
});
```

---

## 🔍 Best Practices

### 1. Always Use `observer()`

```typescript
// ✅ Good
export default observer(function MyComponent() {
  const rootStore = useRootStore();
  const posts = rootStore.userStore.postStore.ui?.list || [];
  return <div>{posts.length}</div>;
});

// ❌ Bad - Won't react to MobX changes
export default function MyComponent() {
  const rootStore = useRootStore();
  const posts = rootStore.userStore.postStore.ui?.list || [];
  return <div>{posts.length}</div>;
}
```

### 2. Null Checks

```typescript
// ✅ Good - Stores may be disabled
const { ui, api } = rootStore.userStore.postStore;
if (!ui || !api) return <div>Loading...</div>;

const posts = ui.list;
api.create({ title: "New post", content: "Content" });

// ❌ Bad - May throw errors
const posts = rootStore.userStore.postStore.ui.list; // ui might be null
```

### 3. Use `fetchWithAuth` for Internal APIs

```typescript
// ✅ Good
import { fetchWithAuth } from "@/lib/utils";

private apiQueryFn = async () => {
  const token = this.authToken || "";
  return fetchWithAuth(token, `${baseUrl}/todos`).then((res) => res.json());
};

// ❌ Bad - Doesn't pass JWT
private apiQueryFn = async () => {
  return fetch(`${baseUrl}/todos`).then((res) => res.json());
};
```

### 4. Centralize Playground Logic

```typescript
// ✅ Good - All playground logic in one place
private getQueryFn() {
  return isPlaygroundMode() ? this.playgroundQueryFn : this.apiQueryFn;
}

// ❌ Bad - Scattered playground checks
if (isPlaygroundMode()) {
  // ... playground code
} else {
  // ... api code
}
```

### 5. Type-Safe Transformations

```typescript
// ✅ Good - Explicit types
transformer: {
  toUi: (apiData: TodoApiData): TodoUiData => ({
    ...apiData,
    created_at: new Date(apiData.created_at),
  }),
  toApi: (uiData: TodoUiData): TodoApiData => ({
    ...uiData,
    created_at: uiData.created_at.toISOString(),
  }),
}

// ❌ Bad - No type safety
transformer: {
  toUi: (data) => ({ ...data }),
  toApi: (data) => ({ ...data }),
}
```

---

## 📚 Related Documentation

- **[Advanced Optimistic Store Package](../packages/advanced-optimistic-store/README.md)** - Core library documentation
- **[Authentication Guide](./auth/README.md)** - JWT authentication architecture
- **[Secrets Management](./secrets/README.md)** - Environment configuration

---

## 🎯 Summary

The KingStack state management pattern provides:

1. **Centralized Orchestration** - RootStore coordinates SessionManager and RealtimeManager
2. **Lazy Loading** - Stores are created only when accessed, reducing bundle size
3. **Store Managers** - UserStoreManager and AdminStoreManager handle store lifecycle
4. **Domain Separation** - Each store handles its own domain (posts, checkboxes, etc.)
5. **Optimistic Updates** - Instant UI feedback with automatic rollback
6. **Reactive State** - MobX observables for computed values and reactions
7. **Smart Caching** - TanStack Query handles server state efficiently
8. **Realtime Support** - Optional WebSocket integration via RealtimeManager
9. **Type Safety** - Full TypeScript support with data transformations
10. **Playground Mode** - Development without backend dependencies (handled by SessionManager)

This architecture makes it easy to build responsive, real-time applications with minimal boilerplate while maintaining clear separation of concerns and optimal performance through lazy loading.

