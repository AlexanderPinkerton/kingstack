# @kingstack/advanced-optimistic-store

> Framework-agnostic optimistic updates with MobX + TanStack Query Core + optional realtime

## Features

- ✅ **Optimistic Updates**: Instant UI feedback with automatic rollback on error
- ✅ **Reactive State**: MobX observables for computed values and reactions
- ✅ **Smart Caching**: TanStack Query handles server state caching
- ✅ **Realtime Support**: Optional WebSocket integration
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Framework Agnostic**: Works with React, Vue, Svelte, vanilla JS

## Installation

```bash
# In your workspace
yarn add @kingstack/advanced-optimistic-store
```

## Quick Start

```typescript
import { createOptimisticStoreManager } from "@kingstack/advanced-optimistic-store";

const todoStore = createOptimisticStoreManager({
  name: "todos",
  queryFn: () => fetch("/api/todos").then(r => r.json()),
  mutations: {
    create: (data) => fetch("/api/todos", { 
      method: "POST", 
      body: JSON.stringify(data) 
    }).then(r => r.json()),
    update: ({ id, data }) => fetch(`/api/todos/${id}`, { 
      method: "PUT", 
      body: JSON.stringify(data) 
    }).then(r => r.json()),
    remove: (id) => fetch(`/api/todos/${id}`, { 
      method: "DELETE" 
    }).then(() => ({ id })),
  },
});

// Create with optimistic update
await todoStore.actions.create({ title: "New todo" });

// Access reactive data
const todos = todoStore.store.list; // MobX observable
```

## Documentation

Coming soon...

## License

MIT
