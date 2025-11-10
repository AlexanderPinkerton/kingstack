# State Management Pattern - AI Explanation

> **Purpose**: Quick reference for AI assistants to understand KingStack's state management architecture and how to implement it.

## 🎯 Pattern Overview

KingStack uses a **two-layer state management pattern**:

1. **RootStore** (Singleton MobX store) - Orchestrates auth, realtime, and lifecycle
2. **Advanced Optimistic Stores** - Domain-specific stores wrapping `@kingstack/advanced-optimistic-store`

### Key Benefits

- ✅ **Instant UI updates** - Optimistic updates with automatic rollback
- ✅ **Reactive state** - MobX observables for computed values
- ✅ **Smart caching** - TanStack Query handles server state
- ✅ **Realtime sync** - Optional WebSocket integration
- ✅ **Type-safe** - Full TypeScript with API ↔ UI transformations
- ✅ **Playground mode** - Works without backend

---

## 🔌 Wiring Pattern

### 1. RootStore Structure

```typescript
// apps/next/src/stores/rootStore.ts
export class RootStore {
  session: any = null;
  
  // Domain stores (created but disabled by default)
  todoStore: AdvancedTodoStore;
  postStore: AdvancedPostStore;
  checkboxStore: RealtimeCheckboxStore;
  userStore: AdvancedUserStore;
  
  // Realtime
  socket: Socket | null = null;
  browserId: string;
  
  constructor() {
    // Create all stores (disabled until auth)
    this.todoStore = new AdvancedTodoStore();
    this.postStore = new AdvancedPostStore();
    this.checkboxStore = new RealtimeCheckboxStore(this.browserId);
    this.userStore = new AdvancedUserStore();
    
    // Make observable
    makeAutoObservable(this, {
      session: true,
      todoStore: true,
      postStore: true,
      checkboxStore: true,
      userStore: true,
    });
    
    // Auth listener
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token && event === "SIGNED_IN") {
        // Enable stores
        this.todoStore.enable(session.access_token);
        this.postStore.enable(session.access_token);
        this.userStore.enable(session.access_token);
        // Setup realtime
        this.setupRealtime(session.access_token);
      } else if (!session?.access_token) {
        // Disable stores
        this.todoStore.disable();
        this.postStore.disable();
        this.userStore.disable();
        this.teardownRealtime();
      }
    });
  }
}
```

### 2. Store Wrapper Pattern

```typescript
// apps/next/src/stores/todoStore.ts
export class AdvancedTodoStore {
  private optimisticStore: OptimisticStore<TodoApiData, TodoUiData> | null = null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initialize(); // Create store but keep disabled
  }

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
          created_at: new Date(apiData.created_at), // API → UI
        }),
        toApi: (uiData) => ({
          ...uiData,
          created_at: uiData.created_at.toISOString(), // UI → API
        }),
        optimisticDefaults: {
          createOptimisticUiData: (userInput) => ({
            id: `temp-${Date.now()}`,
            ...userInput,
            created_at: new Date(),
          }),
        },
      },
      staleTime: 5 * 60 * 1000,
      enabled: () => this.isEnabled && !!this.authToken, // Disabled by default
    });
  }

  // RootStore calls these
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

  // Expose API
  get ui() {
    return this.optimisticStore?.ui || null; // MobX observable
  }

  get api() {
    return this.optimisticStore?.api || null; // Mutations + query control
  }
}
```

### 3. Context Setup

```typescript
// apps/next/src/context/rootStoreContext.ts
import { createContext } from "react";
import { RootStore } from "@/stores/rootStore";

const rootStore = new RootStore(); // Singleton created at module level
export const RootStoreContext = createContext(rootStore);
```

### 4. Component Usage

```typescript
// apps/next/src/app/home/page.tsx
import { observer } from "mobx-react-lite";
import { useRootStore } from "@/hooks/useRootStore";

export default observer(function HomePage() {
  const rootStore = useRootStore();
  const { ui, api } = rootStore.todoStore;

  // Reactive data (MobX)
  const todos = ui?.list || [];
  const isLoading = api?.status.isLoading || false;

  // Optimistic mutation
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

---

## 🔑 Key Concepts

### Enable/Disable Pattern

**Why**: Stores are created but disabled until authenticated. This prevents:
- Unnecessary API calls
- Errors from missing auth tokens
- Race conditions during initialization

**How**: RootStore calls `enable(token)` when authenticated, `disable()` on logout.

### Playground Mode

**Why**: Allows development without Supabase backend.

**How**: 
```typescript
// In store methods
private getQueryFn() {
  return isPlaygroundMode() ? this.playgroundQueryFn : this.apiQueryFn;
}

// In RootStore constructor
if (isPlaygroundMode() || !supabase) {
  this.todoStore.enable("playground-token");
  // ... enable other stores
}
```

### Data Transformation

**Why**: API returns ISO strings, UI needs Date objects. Also allows computed fields.

**How**: Transformer converts between formats:
- `toUi`: API data → UI data (add computed fields, convert types)
- `toApi`: UI data → API data (serialize for server)
- `optimisticDefaults`: Create optimistic UI data from user input

### Realtime Integration

**Why**: Some stores need realtime updates (e.g., checkboxes).

**How**:
1. Store configures realtime in `createOptimisticStore`
2. RootStore connects WebSocket when authenticated
3. RootStore calls `store.connectRealtime(socket)`
4. Store filters events by `browserId` to prevent self-echo

```typescript
// In RealtimeCheckboxStore
this.optimisticStore = createOptimisticStore({
  // ... config
  realtime: {
    eventType: "checkbox_update",
    dataExtractor: (event) => event.checkbox,
    browserId: browserId, // Prevents self-echo
  },
});

// RootStore connects it
connectAllRealtime(socket: Socket) {
  this.getOptimisticStores().forEach((store) => {
    if (store.connectRealtime) {
      store.connectRealtime(socket);
    }
  });
}
```

---

## 📝 Creating a New Store

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

  // ... mutations follow same pattern
}
```

### Step 3: Add to RootStore

```typescript
// In rootStore.ts
import { AdvancedMyEntityStore } from "./myEntityStore";

export class RootStore {
  myEntityStore: AdvancedMyEntityStore;

  constructor() {
    // ... existing stores
    this.myEntityStore = new AdvancedMyEntityStore();

    makeAutoObservable(this, {
      // ... existing
      myEntityStore: true,
    });

    // In auth listener
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

  if (!ui || !api) return <div>Loading...</div>;

  const entities = ui.list;

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

## ⚠️ Critical Rules

1. **Always use `observer()`** - Components must be wrapped to react to MobX changes
2. **Null checks required** - Stores may be disabled, so check `ui` and `api` before use
3. **Use `fetchWithAuth`** - Never use plain `fetch` for internal APIs, always pass JWT
4. **Centralize playground logic** - Use `getQueryFn()` pattern, don't scatter `isPlaygroundMode()` checks
5. **Type-safe transformations** - Always provide explicit types for transformer functions

---

## 🔄 Data Flow

### Optimistic Update

```
User Action
  ↓
api.create({ title: "New todo" })
  ↓
1. Create optimistic UI data (temp ID, current time)
   → UI updates instantly (MobX reactive)
  ↓
2. Send mutation to server (TanStack Query)
  ↓
3. Server responds
   ├─ Success: Replace optimistic with server data
   └─ Error: Rollback optimistic data (snapshot restored)
```

### Authentication Flow

```
User Signs In
  ↓
Supabase Auth State Change
  ↓
RootStore Auth Listener
  ↓
Enable stores: todoStore.enable(token)
  ↓
Setup realtime: setupRealtime(token)
  ↓
Connect stores: store.connectRealtime(socket)
```

---

## 🎯 Quick Reference

### Store Access Pattern

```typescript
const rootStore = useRootStore();
const { ui, api } = rootStore.todoStore;

// UI domain (MobX observable)
const todos = ui?.list || [];
const count = ui?.count || 0;
const todo = ui?.getById(id);

// API domain (mutations + query)
await api?.create({ title: "New" });
await api?.update(id, { done: true });
await api?.remove(id);
api?.refetch();

// Status
const isLoading = api?.status.isLoading;
const isError = api?.status.isError;
const createPending = api?.status.createPending;
```

### Common Patterns

```typescript
// ✅ Good - Null checks
const { ui, api } = rootStore.todoStore;
if (!ui || !api) return <div>Loading...</div>;
const todos = ui.list;

// ✅ Good - Use fetchWithAuth
private apiQueryFn = async () => {
  const token = this.authToken || "";
  return fetchWithAuth(token, `${baseUrl}/todos`).then((res) => res.json());
};

// ✅ Good - Playground pattern
private getQueryFn() {
  return isPlaygroundMode() ? this.playgroundQueryFn : this.apiQueryFn;
}

// ❌ Bad - No observer
export default function MyComponent() { // Missing observer()
  const todos = rootStore.todoStore.ui?.list;
}

// ❌ Bad - No null check
const todos = rootStore.todoStore.ui.list; // ui might be null

// ❌ Bad - Plain fetch
return fetch(`${baseUrl}/todos`).then((res) => res.json()); // Missing JWT
```

---

## 📚 Related Files

- **RootStore**: `apps/next/src/stores/rootStore.ts`
- **Example Stores**: 
  - `apps/next/src/stores/todoStore.ts`
  - `apps/next/src/stores/postStore.ts`
  - `apps/next/src/stores/checkboxStore.ts`
  - `apps/next/src/stores/userStore.ts`
- **Context**: `apps/next/src/context/rootStoreContext.ts`
- **Hook**: `apps/next/src/hooks/useRootStore.ts`
- **Package**: `packages/advanced-optimistic-store/README.md`

---

## 🎯 Summary for AI

When implementing state management in KingStack:

1. **Create store wrapper** - Wrap `createOptimisticStore` with enable/disable pattern
2. **Add to RootStore** - Create instance, make observable, enable/disable in auth listener
3. **Use in components** - Access via `useRootStore()`, wrap with `observer()`, check for null
4. **Support playground** - Use `getQueryFn()` pattern to switch between API and mock
5. **Use `fetchWithAuth`** - Always pass JWT token for internal API calls
6. **Type-safe transformations** - Convert API data (ISO strings) to UI data (Date objects)

The pattern provides instant UI feedback, automatic error rollback, reactive computed values, and seamless realtime synchronization.

