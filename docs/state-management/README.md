# State Management Architecture

KingStack uses a sophisticated state management pattern that combines **MobX** for reactive UI state with **TanStack Query** for server state management, orchestrated through a centralized **RootStore** pattern.

> **🤖 For AI Assistants**: See [ai-explanation.md](./ai-explanation.md) for a streamlined guide focused on implementation patterns and wiring.

## 🎯 Overview

The state management architecture follows a **two-layer approach**:

1. **RootStore** - A singleton MobX store that orchestrates authentication, realtime connections, and lifecycle management
2. **Advanced Optimistic Stores** - Individual domain stores that combine MobX observables with TanStack Query for optimistic updates

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
│  │ • Authentication state (session)                     │   │
│  │ • WebSocket connection management                    │   │
│  │ • Browser ID (for self-echo prevention)             │   │
│  │ • Lifecycle management (enable/disable stores)       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ todoStore    │  │ postStore    │  │ checkboxStore│      │
│  │ (Advanced)   │  │ (Advanced)   │  │ (Realtime)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                   │
│                  ┌────────▼────────┐                          │
│                  │ userStore       │                          │
│                  │ (Advanced)      │                          │
│                  └────────┬────────┘                          │
└───────────────────────────┼───────────────────────────────────┘
                            │
                            │ wraps
                            │
┌───────────────────────────▼───────────────────────────────────┐
│         @kingstack/advanced-optimistic-store                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ UI Domain (MobX)      │  API Domain (TanStack Query) │   │
│  │ • Observable state    │  • Mutations                 │   │
│  │ • Optimistic updates  │  • Query caching             │   │
│  │ • Computed values     │  • Background sync           │   │
│  │ • Snapshot/rollback   │  • Loading states            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Data Transformation Layer                            │   │
│  │ • API data → UI data (with computed fields)          │   │
│  │ • UI data → API data (for mutations)                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Optional Realtime Layer                              │   │
│  │ • WebSocket integration                              │   │
│  │ • Conflict resolution                                │   │
│  │ • Self-echo prevention                               │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 RootStore Pattern

The `RootStore` is a **singleton MobX store** that serves as the central orchestrator for all application state.

### Key Responsibilities

1. **Authentication Management**
   - Listens to Supabase auth state changes
   - Enables/disables stores based on session availability
   - Manages JWT token distribution to stores

2. **Realtime Connection Management**
   - Creates and manages WebSocket connections (Socket.io)
   - Connects/disconnects stores that support realtime
   - Handles browser ID for self-echo prevention

3. **Store Lifecycle**
   - Creates all optimistic stores on initialization
   - Enables stores when authenticated
   - Disables stores on logout
   - Cleans up on disposal (prevents memory leaks)

4. **Playground Mode Support**
   - Detects playground mode (no Supabase backend)
   - Enables stores with mock data
   - Skips authentication requirements

### RootStore Structure

```typescript
export class RootStore {
  // Singleton tracking
  private static instance: RootStore | null = null;
  
  // Authentication state
  session: any = null;
  
  // Domain stores
  todoStore: AdvancedTodoStore;
  postStore: AdvancedPostStore;
  checkboxStore: RealtimeCheckboxStore;
  userStore: AdvancedUserStore;
  
  // Realtime management
  socket: Socket | null = null;
  browserId: string;
  
  // Lifecycle
  dispose(): void;
  setupRealtime(token: string): void;
  teardownRealtime(): void;
  refreshSession(): Promise<void>;
}
```

### Initialization Flow

```typescript
// 1. RootStore is created once (singleton)
const rootStore = new RootStore();

// 2. Constructor creates all stores (disabled by default)
this.todoStore = new AdvancedTodoStore();
this.postStore = new AdvancedPostStore();
this.checkboxStore = new RealtimeCheckboxStore(this.browserId);
this.userStore = new AdvancedUserStore();

// 3. Auth listener watches for session changes
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.access_token && event === "SIGNED_IN") {
    // Enable all stores with token
    this.todoStore.enable(session.access_token);
    this.postStore.enable(session.access_token);
    this.userStore.enable(session.access_token);
    // Setup realtime connection
    this.setupRealtime(session.access_token);
  } else if (!session?.access_token) {
    // Disable all stores
    this.todoStore.disable();
    this.postStore.disable();
    this.userStore.disable();
    // Teardown realtime
    this.teardownRealtime();
  }
});
```

### Realtime Connection Flow

```typescript
// When authenticated, RootStore sets up realtime
setupRealtime(token: string) {
  const socket = io(REALTIME_SERVER_URL);
  
  socket.on("connect", () => {
    socket.emit("register", { token, browserId: this.browserId });
    // Connect all stores that support realtime
    this.connectAllRealtime(socket);
  });
}

// Each store that supports realtime gets connected
private connectAllRealtime(socket: Socket): void {
  this.getOptimisticStores().forEach((store) => {
    if (store.connectRealtime) {
      store.connectRealtime(socket);
    }
  });
}
```

---

## 🎨 Advanced Optimistic Store Pattern

Each domain store (e.g., `AdvancedTodoStore`, `AdvancedPostStore`) wraps the `createOptimisticStore` function with additional features:

### Store Wrapper Structure

```typescript
export class AdvancedTodoStore {
  private optimisticStore: OptimisticStore<TodoApiData, TodoUiData> | null = null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Store is created but disabled until auth is available
    this.initialize();
  }

  // Enable store with auth token
  enable(authToken: string): void {
    this.authToken = authToken;
    this.isEnabled = true;
    this.optimisticStore?.updateOptions();
  }

  // Disable store
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

1. **Enable/Disable Pattern**
   - Stores are created but disabled by default
   - RootStore enables them when authenticated
   - Prevents unnecessary API calls when not authenticated

2. **Playground Mode Support**
   - Detects playground mode via `isPlaygroundMode()`
   - Switches between API and mock implementations
   - No authentication required

3. **Data Transformation**
   - Converts API data (ISO strings) to UI data (Date objects)
   - Adds computed fields (e.g., `isNew`, `readingTime`)
   - Type-safe transformations

4. **Realtime Support (Optional)**
   - Some stores support realtime (e.g., `RealtimeCheckboxStore`)
   - Realtime is configured but not connected until RootStore connects it
   - Browser ID prevents self-echo

### Example: AdvancedTodoStore

```typescript
export class AdvancedTodoStore {
  private initialize() {
    this.optimisticStore = createOptimisticStore<TodoApiData, TodoUiData>({
      name: "todos",
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

export default observer(function TodoList() {
  const rootStore = useRootStore();
  const { ui, api } = rootStore.todoStore;

  // Reactive data (MobX)
  const todos = ui?.list || [];
  const isLoading = api?.status.isLoading || false;

  // Optimistic mutations
  const handleCreate = () => {
    api?.create({ title: "New todo", done: false });
  };

  return (
    <div>
      {todos.map(todo => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  );
});
```

### Key Points

1. **Always use `observer()`** - Wraps component to react to MobX changes
2. **Access via RootStore** - `rootStore.todoStore`, `rootStore.postStore`, etc.
3. **Use `ui` for reactive data** - MobX observables, computed values
4. **Use `api` for mutations** - Optimistic updates, query control
5. **Null checks** - Stores may be disabled, so check for null

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
RootStore Auth Listener
    │
    ├─► Enable todoStore.enable(token)
    ├─► Enable postStore.enable(token)
    ├─► Enable userStore.enable(token)
    └─► Setup realtime connection
        └─► Connect stores that support realtime
```

---

## 🎮 Playground Mode

Playground mode allows development without a Supabase backend:

```typescript
// Detected via isPlaygroundMode() from @kingstack/shared
if (isPlaygroundMode() || !supabase) {
  // Enable stores with playground token
  this.todoStore.enable("playground-token");
  this.postStore.enable("playground-token");
  this.userStore.enable("playground-token");
  // Checkboxes work without auth in playground mode
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

### Step 3: Add to RootStore

```typescript
// In rootStore.ts
import { AdvancedMyEntityStore } from "./myEntityStore";

export class RootStore {
  // ... existing stores
  myEntityStore: AdvancedMyEntityStore;

  constructor() {
    // ... existing initialization
    this.myEntityStore = new AdvancedMyEntityStore();

    // Make observable
    makeAutoObservable(this, {
      // ... existing stores
      myEntityStore: true,
    });

    // Enable in auth listener
    if (session?.access_token && event === "SIGNED_IN") {
      // ... existing enables
      this.myEntityStore.enable(session.access_token);
    } else if (!session?.access_token) {
      // ... existing disables
      this.myEntityStore.disable();
    }
  }
}
```

### Step 4: Use in Components

```typescript
import { observer } from "mobx-react-lite";
import { useRootStore } from "@/hooks/useRootStore";

export default observer(function MyEntityList() {
  const rootStore = useRootStore();
  const { ui, api } = rootStore.myEntityStore;

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
  const todos = rootStore.todoStore.ui?.list || [];
  return <div>{todos.length}</div>;
});

// ❌ Bad - Won't react to MobX changes
export default function MyComponent() {
  const rootStore = useRootStore();
  const todos = rootStore.todoStore.ui?.list || [];
  return <div>{todos.length}</div>;
}
```

### 2. Null Checks

```typescript
// ✅ Good - Stores may be disabled
const { ui, api } = rootStore.todoStore;
if (!ui || !api) return <div>Loading...</div>;

const todos = ui.list;
api.create({ title: "New todo" });

// ❌ Bad - May throw errors
const todos = rootStore.todoStore.ui.list; // ui might be null
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

1. **Centralized Orchestration** - RootStore manages auth, realtime, and lifecycle
2. **Domain Separation** - Each store handles its own domain (todos, posts, etc.)
3. **Optimistic Updates** - Instant UI feedback with automatic rollback
4. **Reactive State** - MobX observables for computed values and reactions
5. **Smart Caching** - TanStack Query handles server state efficiently
6. **Realtime Support** - Optional WebSocket integration with conflict resolution
7. **Type Safety** - Full TypeScript support with data transformations
8. **Playground Mode** - Development without backend dependencies

This architecture makes it easy to build responsive, real-time applications with minimal boilerplate while maintaining clear separation of concerns.

