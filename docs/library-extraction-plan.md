# Library Extraction Plan: @yourorg/mobx-tanstack-optimistic

## Overview

Extract the optimistic store pattern into a standalone, reusable library that combines:
- MobX (reactive UI state)
- TanStack Query Core (server state caching)
- Optimistic updates (snapshot/rollback)
- Optional realtime updates (WebSocket)

---

## Phase 1: Code Organization (Week 1)

### 1.1: Directory Structure

Create new package: `packages/mobx-tanstack-optimistic/`

```
packages/mobx-tanstack-optimistic/
├── src/
│   ├── core/
│   │   ├── OptimisticStore.ts          # Base store class (extracted)
│   │   ├── createStoreManager.ts       # Manager factory (extracted)
│   │   ├── types.ts                    # Core interfaces
│   │   └── index.ts                    # Core exports
│   ├── transforms/
│   │   ├── DataTransformer.ts          # Transformer interface
│   │   ├── createDefaultTransformer.ts # Default transformer implementation
│   │   ├── types.ts                    # Transform types
│   │   └── index.ts                    # Transform exports
│   ├── realtime/
│   │   ├── RealtimeExtension.ts        # Realtime extension class (extracted)
│   │   ├── createRealtimeExtension.ts  # Factory (extracted)
│   │   ├── types.ts                    # Realtime types
│   │   └── index.ts                    # Realtime exports
│   ├── query/
│   │   ├── queryClient.ts              # Global query client singleton
│   │   ├── types.ts                    # Query types
│   │   └── index.ts                    # Query exports
│   ├── utils/
│   │   ├── shallowEqual.ts             # Equality comparisons
│   │   ├── reconciliation.ts           # Reconciliation helpers
│   │   └── index.ts                    # Util exports
│   └── index.ts                        # Main library exports
├── tests/
│   ├── core/
│   │   ├── OptimisticStore.test.ts
│   │   ├── createStoreManager.test.ts
│   │   └── integration.test.ts
│   ├── transforms/
│   │   ├── DataTransformer.test.ts
│   │   └── defaultTransformer.test.ts
│   ├── realtime/
│   │   ├── RealtimeExtension.test.ts
│   │   └── integration.test.ts
│   ├── query/
│   │   └── queryClient.test.ts
│   └── __fixtures__/
│       ├── mockData.ts
│       └── testHelpers.ts
├── examples/
│   ├── basic-todo/
│   │   ├── TodoStore.ts
│   │   ├── TodoList.tsx
│   │   └── README.md
│   ├── with-auth/
│   │   ├── AuthenticatedStore.ts
│   │   ├── PostStore.ts
│   │   └── README.md
│   ├── with-realtime/
│   │   ├── RealtimeCheckboxStore.ts
│   │   ├── CheckboxGrid.tsx
│   │   └── README.md
│   └── advanced/
│       ├── CustomTransformer.ts
│       ├── ConflictResolution.ts
│       └── README.md
├── docs/
│   ├── api/
│   │   ├── OptimisticStore.md
│   │   ├── createStoreManager.md
│   │   ├── DataTransformer.md
│   │   └── RealtimeExtension.md
│   ├── guides/
│   │   ├── getting-started.md
│   │   ├── optimistic-updates.md
│   │   ├── realtime.md
│   │   ├── authentication.md
│   │   └── advanced.md
│   └── architecture.md
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── .npmignore
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### 1.2: File Splitting Strategy

**Current: `optimistic-store-pattern.ts` (963 lines)**

Split into:

#### `src/core/types.ts`
```typescript
export interface Entity {
  id: string;
}

export interface OptimisticDefaults<TUiData extends Entity> {
  createOptimisticUiData: (userInput: any, context?: any) => TUiData;
  pendingFields?: (keyof TUiData)[];
}

export interface OptimisticStoreConfig<TApiData, TUiData> {
  name: string;
  queryFn: () => Promise<TApiData[]>;
  mutations: {
    create: (data: any) => Promise<TApiData>;
    update: (params: { id: string; data: any }) => Promise<TApiData>;
    remove: (id: string) => Promise<{ id: string } | void>;
  };
  transformer?: DataTransformer<TApiData, TUiData> | false;
  optimisticDefaults?: OptimisticDefaults<TUiData>;
  optimisticContext?: () => any;
  storeClass?: new () => OptimisticStore<TUiData>;
  staleTime?: number;
  enabled?: () => boolean;
  realtime?: RealtimeConfig<TUiData>;
}

export interface OptimisticStoreManager<TApiData, TUiData, TStore> {
  store: TStore;
  actions: {
    create: (data: any) => Promise<TApiData>;
    update: (params: { id: string; data: any }) => Promise<TApiData>;
    remove: (id: string) => Promise<void | { id: string }>;
    refetch: () => Promise<any>;
    triggerQuery: () => void;
  };
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
  updateOptions: () => void;
  isEnabled: () => boolean;
  enable: () => void;
  disable: () => void;
  destroy: () => void;
  realtime?: {
    isConnected: boolean;
    connect: (socket: any) => void;
    disconnect: () => void;
  };
}
```

#### `src/core/OptimisticStore.ts`
```typescript
import { makeObservable, observable, computed, action, runInAction } from "mobx";
import type { Entity, DataTransformer } from "../transforms/types";

export class OptimisticStore<T extends Entity> {
  public entities = new Map<string, T>();
  private snapshots: Map<string, T>[] = [];
  private transformer?: DataTransformer<any, T>;

  constructor(transformer?: DataTransformer<any, T>) {
    this.transformer = transformer;
    makeObservable(this, {
      entities: observable,
      list: computed,
      count: computed,
      upsert: action,
      update: action,
      remove: action,
      clear: action,
      pushSnapshot: action,
      rollback: action,
      reconcile: action,
    });
  }

  // ... rest of implementation
}
```

#### `src/core/createStoreManager.ts`
```typescript
import { QueryClient, MutationObserver, QueryObserver, notifyManager } from "@tanstack/query-core";
import { observable, runInAction } from "mobx";
import { OptimisticStore } from "./OptimisticStore";
import { createRealtimeExtension } from "../realtime";
import type { OptimisticStoreConfig, OptimisticStoreManager } from "./types";

export function createOptimisticStoreManager<TApiData, TUiData, TStore>(
  config: OptimisticStoreConfig<TApiData, TUiData>,
  queryClient?: QueryClient,
): OptimisticStoreManager<TApiData, TUiData, TStore> {
  // ... implementation
}
```

#### `src/transforms/types.ts`
```typescript
import type { Entity } from "../core/types";

export interface DataTransformer<TApiData extends Entity, TUiData extends Entity> {
  toUi(apiData: TApiData): TUiData;
  toApi(uiData: TUiData): TApiData;
  optimisticDefaults?: OptimisticDefaults<TUiData>;
}
```

#### `src/realtime/types.ts`
```typescript
export interface RealtimeEvent<T = any> {
  type: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  data?: T;
  browserId?: string;
  [key: string]: any;
}

export interface RealtimeConfig<T extends { id: string }> {
  eventType: string;
  dataExtractor?: (event: RealtimeEvent) => T | undefined;
  shouldProcessEvent?: (event: RealtimeEvent) => boolean;
  browserId?: string;
  customHandlers?: {
    [eventType: string]: (store: OptimisticStore<T>, event: RealtimeEvent) => void;
  };
}
```

#### `src/index.ts` (Main Export)
```typescript
// Core
export { OptimisticStore } from "./core/OptimisticStore";
export { createOptimisticStoreManager } from "./core/createStoreManager";
export { getGlobalQueryClient } from "./query/queryClient";

// Types
export type {
  Entity,
  OptimisticDefaults,
  OptimisticStoreConfig,
  OptimisticStoreManager,
} from "./core/types";

// Transforms
export { createDefaultTransformer, createTransformer } from "./transforms";
export type { DataTransformer } from "./transforms/types";

// Realtime
export { RealtimeExtension, createRealtimeExtension } from "./realtime";
export type { RealtimeEvent, RealtimeConfig } from "./realtime/types";

// Utils (if needed)
export { shallowEqual } from "./utils";
```

---

## Phase 2: Testing Strategy (Week 2)

### 2.1: Unit Tests

**Coverage target: 90%+**

#### Core Tests
```typescript
// tests/core/OptimisticStore.test.ts
describe("OptimisticStore", () => {
  describe("basic operations", () => {
    it("should add items via upsert", () => { ... });
    it("should update existing items", () => { ... });
    it("should remove items", () => { ... });
    it("should compute list from entities map", () => { ... });
  });

  describe("snapshot/rollback", () => {
    it("should create snapshot before optimistic update", () => { ... });
    it("should rollback to previous snapshot on error", () => { ... });
    it("should handle multiple snapshots (nested)", () => { ... });
  });

  describe("reconciliation", () => {
    it("should reconcile with server data", () => { ... });
    it("should skip reconciliation if no changes", () => { ... });
    it("should handle additions, updates, and deletions", () => { ... });
  });

  describe("realtime updates", () => {
    it("should upsert from realtime without runInAction wrapper", () => { ... });
    it("should remove from realtime", () => { ... });
  });
});
```

```typescript
// tests/core/createStoreManager.test.ts
describe("createOptimisticStoreManager", () => {
  describe("initialization", () => {
    it("should create store manager with default options", () => { ... });
    it("should use custom store class if provided", () => { ... });
    it("should setup query observer", () => { ... });
    it("should setup mutation observers", () => { ... });
  });

  describe("query management", () => {
    it("should trigger initial query if enabled", () => { ... });
    it("should skip query if disabled", () => { ... });
    it("should update options when enabled state changes", () => { ... });
  });

  describe("mutations", () => {
    it("should perform optimistic create", () => { ... });
    it("should perform optimistic update", () => { ... });
    it("should perform optimistic delete", () => { ... });
    it("should rollback on mutation error", () => { ... });
  });

  describe("status tracking", () => {
    it("should track loading state", () => { ... });
    it("should track error state", () => { ... });
    it("should compute hasPendingMutations", () => { ... });
  });
});
```

#### Transform Tests
```typescript
// tests/transforms/defaultTransformer.test.ts
describe("createDefaultTransformer", () => {
  describe("toUi", () => {
    it("should convert date strings to Date objects", () => { ... });
    it("should convert boolean strings to booleans", () => { ... });
    it("should convert number strings to numbers", () => { ... });
    it("should preserve non-convertible values", () => { ... });
  });

  describe("toApi", () => {
    it("should convert Date objects to ISO strings", () => { ... });
    it("should convert booleans to strings", () => { ... });
    it("should preserve other values", () => { ... });
  });
});
```

#### Realtime Tests
```typescript
// tests/realtime/RealtimeExtension.test.ts
describe("RealtimeExtension", () => {
  describe("connection", () => {
    it("should connect to socket", () => { ... });
    it("should disconnect from socket", () => { ... });
    it("should track connection status", () => { ... });
  });

  describe("event handling", () => {
    it("should process INSERT events", () => { ... });
    it("should process UPDATE events", () => { ... });
    it("should process DELETE events", () => { ... });
    it("should filter self-originated events (browserId)", () => { ... });
    it("should use custom data extractor", () => { ... });
    it("should use custom event handlers", () => { ... });
  });
});
```

### 2.2: Integration Tests

```typescript
// tests/integration/optimistic-flow.test.ts
describe("Optimistic Update Flow", () => {
  it("should perform full optimistic create flow", async () => {
    // 1. Setup store manager
    // 2. Trigger create mutation
    // 3. Verify optimistic update
    // 4. Verify server update
    // 5. Verify reconciliation
  });

  it("should handle mutation error with rollback", async () => {
    // 1. Setup store manager
    // 2. Trigger mutation that will fail
    // 3. Verify optimistic update
    // 4. Verify rollback on error
  });

  it("should prevent reconciliation during pending mutations", async () => {
    // 1. Setup store manager
    // 2. Trigger mutation (in flight)
    // 3. Trigger refetch
    // 4. Verify reconciliation skipped
    // 5. Wait for mutation to complete
    // 6. Verify reconciliation happens
  });
});

// tests/integration/realtime-flow.test.ts
describe("Realtime Update Flow", () => {
  it("should handle realtime updates from other clients", async () => {
    // 1. Setup store manager with realtime
    // 2. Simulate socket event from different browserId
    // 3. Verify store updated
  });

  it("should filter out self-originated events", async () => {
    // 1. Setup store manager with browserId
    // 2. Simulate socket event with same browserId
    // 3. Verify event ignored
  });
});
```

### 2.3: Test Setup

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
    },
  },
});
```

```typescript
// tests/__fixtures__/testHelpers.ts
import { QueryClient } from "@tanstack/query-core";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function waitForMs(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createMockSocket() {
  const listeners = new Map();
  return {
    on: vi.fn((event, handler) => listeners.set(event, handler)),
    off: vi.fn((event) => listeners.delete(event)),
    emit: vi.fn((event, data) => listeners.get(event)?.(data)),
    connected: true,
  };
}
```

---

## Phase 3: Build Setup (Week 2)

### 3.1: Package Configuration

```json
// package.json
{
  "name": "@yourorg/mobx-tanstack-optimistic",
  "version": "1.0.0",
  "description": "Optimistic updates with MobX + TanStack Query Core + optional realtime",
  "keywords": [
    "mobx",
    "tanstack-query",
    "optimistic-updates",
    "realtime",
    "state-management"
  ],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourorg/mobx-tanstack-optimistic"
  },
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./realtime": {
      "types": "./dist/realtime/index.d.ts",
      "import": "./dist/realtime/index.mjs",
      "require": "./dist/realtime/index.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/**/*.ts",
    "prepublishOnly": "npm run build && npm run test"
  },
  "peerDependencies": {
    "mobx": "^6.0.0",
    "@tanstack/query-core": "^5.0.0"
  },
  "peerDependenciesMeta": {
    "socket.io-client": {
      "optional": true
    }
  },
  "devDependencies": {
    "@tanstack/query-core": "^5.59.20",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "eslint": "^9.0.0",
    "mobx": "^6.13.5",
    "socket.io-client": "^4.8.1",
    "tsup": "^8.0.0",
    "typescript": "^5.6.3",
    "vitest": "^2.0.0"
  }
}
```

### 3.2: TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  },
  "exclude": ["tests", "**/*.test.ts", "**/*.spec.ts"]
}
```

### 3.3: Build Configuration

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    realtime: "src/realtime/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false, // Keep readable for debugging
  external: ["mobx", "@tanstack/query-core", "socket.io-client"],
});
```

---

## Phase 4: Documentation (Week 3)

### 4.1: README Structure

```markdown
# @yourorg/mobx-tanstack-optimistic

> Optimistic updates made easy: MobX + TanStack Query Core + optional realtime

## Features

- ✅ **Optimistic Updates**: Instant UI feedback with automatic rollback on error
- ✅ **Reactive State**: MobX observables for computed values and reactions
- ✅ **Smart Caching**: TanStack Query handles server state caching
- ✅ **Realtime Support**: Optional WebSocket integration
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Framework Agnostic**: Works with React, Vue, Svelte, vanilla JS

## Installation

\`\`\`bash
npm install @yourorg/mobx-tanstack-optimistic mobx @tanstack/query-core

# Optional: for realtime features
npm install socket.io-client
\`\`\`

## Quick Start

\`\`\`typescript
import { createOptimisticStoreManager } from "@yourorg/mobx-tanstack-optimistic";

const todoStore = createOptimisticStoreManager({
  name: "todos",
  queryFn: () => fetch("/api/todos").then(r => r.json()),
  mutations: {
    create: (data) => fetch("/api/todos", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
    update: ({ id, data }) => fetch(\`/api/todos/\${id}\`, { method: "PUT", body: JSON.stringify(data) }).then(r => r.json()),
    remove: (id) => fetch(\`/api/todos/\${id}\`, { method: "DELETE" }).then(() => ({ id })),
  },
});

// Create with optimistic update
await todoStore.actions.create({ title: "New todo" });
// UI updates immediately, rolls back on error

// Access reactive data
const todos = todoStore.store.list; // MobX observable
\`\`\`

## Documentation

- [Getting Started Guide](./docs/guides/getting-started.md)
- [API Reference](./docs/api/)
- [Examples](./examples/)
- [Architecture](./docs/architecture.md)

## Examples

- [Basic Todo List](./examples/basic-todo/)
- [With Authentication](./examples/with-auth/)
- [With Realtime](./examples/with-realtime/)
- [Advanced Usage](./examples/advanced/)

## License

MIT
```

### 4.2: API Documentation

Create docs for:
- `OptimisticStore` class
- `createOptimisticStoreManager` function
- `DataTransformer` interface
- `RealtimeExtension` class
- Configuration options
- Type definitions

### 4.3: Guides

Write guides for:
- Getting started
- Optimistic updates best practices
- Authentication patterns
- Realtime integration
- Custom transformers
- Error handling
- Testing strategies

---

## Phase 5: Examples (Week 3)

### 5.1: Basic Todo Example

```typescript
// examples/basic-todo/TodoStore.ts
import { createOptimisticStoreManager } from "@yourorg/mobx-tanstack-optimistic";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export const todoStore = createOptimisticStoreManager<Todo, Todo>({
  name: "todos",
  queryFn: async () => {
    const response = await fetch("/api/todos");
    return response.json();
  },
  mutations: {
    create: async (data) => {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    update: async ({ id, data }) => {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    remove: async (id) => {
      await fetch(`/api/todos/${id}`, { method: "DELETE" });
      return { id };
    },
  },
  transformer: false, // No transformation needed
});
```

### 5.2: With Authentication Example

```typescript
// examples/with-auth/AuthenticatedStore.ts
class AuthenticatedPostStore {
  private storeManager: OptimisticStoreManager | null = null;
  private authToken: string | null = null;

  enable(token: string) {
    this.authToken = token;
    this.storeManager = createOptimisticStoreManager({
      name: "posts",
      queryFn: () => this.fetchPosts(),
      mutations: {
        create: (data) => this.createPost(data),
        update: ({ id, data }) => this.updatePost(id, data),
        remove: (id) => this.deletePost(id),
      },
    });
  }

  private async fetchPosts() {
    return fetch("/api/posts", {
      headers: { Authorization: `Bearer ${this.authToken}` },
    }).then(r => r.json());
  }

  // ... other methods
}
```

### 5.3: With Realtime Example

```typescript
// examples/with-realtime/RealtimeCheckboxStore.ts
import { createOptimisticStoreManager } from "@yourorg/mobx-tanstack-optimistic";
import { io } from "socket.io-client";

export class RealtimeCheckboxStore {
  storeManager = createOptimisticStoreManager({
    name: "checkboxes",
    queryFn: () => fetch("/api/checkboxes").then(r => r.json()),
    mutations: {
      create: (data) => fetch("/api/checkboxes", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
      update: ({ id, data }) => fetch(`/api/checkboxes/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(r => r.json()),
      remove: (id) => fetch(`/api/checkboxes/${id}`, { method: "DELETE" }).then(() => ({ id })),
    },
    realtime: {
      eventType: "checkbox_update",
      dataExtractor: (event) => event.checkbox,
      browserId: getBrowserId(), // Filter self-originated events
    },
  });

  connectRealtime(socket: Socket) {
    if (this.storeManager.realtime) {
      this.storeManager.realtime.connect(socket);
    }
  }
}
```

---

## Phase 6: Publishing (Week 4)

### 6.1: Pre-publish Checklist

- [ ] All tests passing (90%+ coverage)
- [ ] TypeScript types exported correctly
- [ ] README complete with examples
- [ ] API documentation complete
- [ ] Examples working
- [ ] LICENSE file added (MIT recommended)
- [ ] CHANGELOG.md initialized
- [ ] Package.json metadata complete
- [ ] .npmignore configured (exclude tests, examples, docs)

### 6.2: Publishing Steps

```bash
# 1. Final checks
npm run typecheck
npm run lint
npm run test
npm run build

# 2. Verify package contents
npm pack
tar -xvzf *.tgz
ls package/

# 3. Test in local project
cd your-test-project
npm install /path/to/mobx-tanstack-optimistic-1.0.0.tgz

# 4. Publish to npm (dry run first)
npm publish --dry-run

# 5. Publish for real
npm publish --access public

# 6. Tag release in git
git tag v1.0.0
git push --tags
```

### 6.3: Versioning Strategy

Follow Semantic Versioning (semver):
- `1.0.0` - Initial stable release
- `1.0.x` - Bug fixes (patch)
- `1.x.0` - New features, backward compatible (minor)
- `x.0.0` - Breaking changes (major)

### 6.4: GitHub Release

Create GitHub release with:
- Version tag (v1.0.0)
- Release notes (from CHANGELOG.md)
- Migration guide (if breaking changes)
- Binary attachments (optional)

---

## Phase 7: Migration from Internal to Library

### 7.1: Update Imports in KingStack

```typescript
// Before
import { createOptimisticStoreManager } from "@/lib/optimistic-store-pattern";

// After
import { createOptimisticStoreManager } from "@yourorg/mobx-tanstack-optimistic";
```

### 7.2: Add as Dependency

```json
// package.json
{
  "dependencies": {
    "@yourorg/mobx-tanstack-optimistic": "^1.0.0",
    "mobx": "^6.13.5",
    "@tanstack/query-core": "^5.59.20"
  }
}
```

### 7.3: Remove Old Files

After migration:
- Delete `lib/optimistic-store-pattern.ts`
- Delete `lib/realtime-extension.ts`
- Keep store implementations (they use the library)

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| 1. Code Organization | Week 1 | Split files, create structure |
| 2. Testing | Week 2 | Unit tests, integration tests |
| 3. Build Setup | Week 2 | Package config, build scripts |
| 4. Documentation | Week 3 | README, API docs, guides |
| 5. Examples | Week 3 | Working examples |
| 6. Publishing | Week 4 | npm package, GitHub release |
| 7. Migration | Week 4 | Update KingStack |

**Total: 4 weeks for full release**

---

## Success Metrics

- ✅ 90%+ test coverage
- ✅ All examples working
- ✅ Documentation complete
- ✅ Successfully published to npm
- ✅ KingStack migrated to use library
- ✅ No breaking changes in migration

---

## Future Enhancements (Post v1.0)

- React hooks wrapper (`useOptimisticStore`)
- Vue composition API wrapper
- Svelte store wrapper
- Persistence plugin (localStorage, IndexedDB)
- Conflict resolution strategies
- Event sourcing support
- Offline queue
- Devtools integration

---

## Resources

- [TanStack Query Core Docs](https://tanstack.com/query/latest/docs/framework/react/guides/caching)
- [MobX Best Practices](https://mobx.js.org/best-practices.html)
- [Creating a TypeScript Library](https://www.tsmean.com/articles/how-to-write-a-typescript-library/)
- [npm Publishing Guide](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages)
