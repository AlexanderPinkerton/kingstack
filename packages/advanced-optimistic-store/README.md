# @kingstack/advanced-optimistic-store

> **Framework-agnostic optimistic updates with MobX + TanStack Query Core + optional realtime**

A powerful library that combines the best of MobX (reactive UI state) and TanStack Query (server state management) to provide seamless optimistic updates with automatic rollback, realtime synchronization, and type-safe data transformations.

## 🎯 The Problem This Solves

Modern web apps need to manage two types of state:
- **UI State**: Reactive, computed values, optimistic updates, form state
- **Server State**: Cached API data, background sync, invalidation, loading states

Most solutions force you to choose one approach for everything, leading to:
- ❌ Complex optimistic update implementations
- ❌ Stale data and cache invalidation headaches  
- ❌ Poor UX with loading spinners everywhere
- ❌ Difficult realtime synchronization
- ❌ Type safety issues between API and UI data

**This library gives you the best of both worlds** by clearly separating concerns while making them work together seamlessly.

## ✨ Key Features

- 🚀 **Optimistic Updates**: Instant UI feedback with automatic rollback on error
- ⚡ **Reactive State**: MobX observables for computed values and reactions
- 🗄️ **Smart Caching**: TanStack Query handles expensive server state caching
- 🔄 **Realtime Support**: Optional WebSocket integration with conflict resolution
- 🛡️ **Type-Safe**: Full TypeScript support with API ↔ UI data transformations
- 🎨 **Framework Agnostic**: Works with React, Vue, Svelte, vanilla JS
- 🧠 **Smart Defaults**: Sensible defaults with powerful customization options

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                         │
├─────────────────────────────────────────────────────────────┤
│  UI Domain (MobX)         │  API Domain (TanStack Query)    │
│  ┌─────────────────────┐  │  ┌──────────────────────────┐   │
│  │  ObservableUIData   │  │  │  Mutations + Query State │   │
│  │  • Optimistic       │  │  │  • Data Caching          │   │
│  │  • Computed values  │  │  │  • Background sync       │   │
│  │  • Snapshot/rollback│  │  │  • Loading states        │   │
│  └─────────────────────┘  │  └──────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│              Data Transformation Layer                      │
│  • API data → UI data (with optimistic defaults)            │
│  • UI data → API data (for api calls)                       │
│  • Type-safe transformations                                │
├─────────────────────────────────────────────────────────────┤
│              Optional Realtime Layer                        │
│  • WebSocket integration                                    │
│  • Conflict resolution                                      │
│  • Self-echo prevention                                     │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Basic Setup

```typescript
import { createOptimisticStore } from "@kingstack/advanced-optimistic-store";

const todoStore = createOptimisticStore({
  name: "todos",
  queryFn: () => fetch("/api/todos").then(r => r.json()),
  mutations: {
    create: (data) => fetch("/api/todos", { 
      method: "POST", 
      body: JSON.stringify(data) 
    }).then(r => r.json()),
    update: (id, data) => fetch(`/api/todos/${id}`, { 
      method: "PUT", 
      body: JSON.stringify(data) 
    }).then(r => r.json()),
    remove: (id) => fetch(`/api/todos/${id}`, { 
      method: "DELETE" 
    }).then(() => ({ id })),
  },
});

// Access UI data (MobX observable)
const todos = todoStore.ui.list;
const count = todoStore.ui.count;

// Perform optimistic mutations
await todoStore.api.create({ title: "New todo" });
await todoStore.api.update(todoId, { done: true });
await todoStore.api.remove(todoId);

// Check loading states
const isLoading = todoStore.api.status.isLoading;
const hasErrors = todoStore.api.status.isError;
```

### With Custom Data Transformation

```typescript
import { createOptimisticStore, createDefaultTransformer } from "@kingstack/advanced-optimistic-store";

// API data structure
interface TodoApiData {
  id: string;
  title: string;
  done: boolean;
  created_at: string;  // ISO string
  user_id: string;
}

// UI data structure  
interface TodoUiData {
  id: string;
  title: string;
  done: boolean;
  created_at: Date;    // JavaScript Date
  user_id: string;
  isNew: boolean;      // Computed property
  daysOld: number;     // Computed property
}

const todoStore = createOptimisticStore<TodoApiData, TodoUiData>({
  name: "todos",
  queryFn: () => fetch("/api/todos").then(r => r.json()),
  mutations: {
    create: (data) => fetch("/api/todos", { 
      method: "POST", 
      body: JSON.stringify(data) 
    }).then(r => r.json()),
    update: (id, data) => fetch(`/api/todos/${id}`, { 
      method: "PUT", 
      body: JSON.stringify(data) 
    }).then(r => r.json()),
    remove: (id) => fetch(`/api/todos/${id}`, { 
      method: "DELETE" 
    }).then(() => ({ id })),
  },
  transformer: createDefaultTransformer<TodoApiData, TodoUiData>({
    toUi: (apiData) => ({
      ...apiData,
      created_at: new Date(apiData.created_at),
      isNew: (Date.now() - new Date(apiData.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000,
      daysOld: Math.floor((Date.now() - new Date(apiData.created_at).getTime()) / (1000 * 60 * 60 * 24)),
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
        daysOld: 0,
      }),
    },
  }),
});
```

### With Realtime Updates via Websocket

```typescript
const todoStore = createOptimisticStore({
  name: "todos",
  queryFn: () => fetch("/api/todos").then(r => r.json()),
  mutations: { /* ... */ },
  realtime: {
    eventType: "todo_update",
    browserId: "browser-123", // Prevents self-echo
    dataExtractor: (event) => event.data.todo,
    shouldProcessEvent: (event) => event.type === "todo_update",
  },
});

// Realtime is automatically connected when you call:
// todoStore.realtime?.connect(socket);
```

## 🎨 Usage Examples

### React Component

```tsx
import { observer } from "mobx-react-lite";
import { createOptimisticStore } from "@kingstack/advanced-optimistic-store";

const TodoList = observer(() => {
  const { ui, api } = todoStore;
  
  // Reactive data (MobX)
  const todos = ui.list;
  const completedCount = ui.filter(todo => todo.done).length;
  
  // Query state
  const isLoading = api.status.isLoading;
  const isCreating = api.status.createPending;
  
  const handleCreate = (title: string) => {
    api.create({ title, done: false });
  };
  
  const handleToggle = (id: string, done: boolean) => {
    api.update(id, { done });
  };
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Todos ({todos.length})</h2>
      <p>Completed: {completedCount}</p>
      
      {todos.map(todo => (
        <div key={todo.id}>
          <input 
            type="checkbox" 
            checked={todo.done}
            onChange={() => handleToggle(todo.id, !todo.done)}
          />
          {todo.title}
        </div>
      ))}
      
      <button 
        onClick={() => handleCreate("New todo")}
        disabled={isCreating}
      >
        {isCreating ? "Creating..." : "Add Todo"}
      </button>
    </div>
  );
});
```

### Vue Component

```vue
<template>
  <div>
    <h2>Todos ({{ todos.length }})</h2>
    <p>Completed: {{ completedCount }}</p>
    
    <div v-for="todo in todos" :key="todo.id">
      <input 
        type="checkbox" 
        :checked="todo.done"
        @change="handleToggle(todo.id, !todo.done)"
      />
      {{ todo.title }}
    </div>
    
    <button 
      @click="handleCreate('New todo')"
      :disabled="isCreating"
    >
      {{ isCreating ? 'Creating...' : 'Add Todo' }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { createOptimisticStore } from "@kingstack/advanced-optimistic-store";

const { ui, api } = createOptimisticStore({
  // ... config
});

// Reactive data
const todos = computed(() => ui.list);
const completedCount = computed(() => ui.filter(todo => todo.done).length);
const isCreating = computed(() => api.status.createPending);

const handleCreate = (title) => {
  api.create({ title, done: false });
};

const handleToggle = (id, done) => {
  api.update(id, { done });
};
</script>
```

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
