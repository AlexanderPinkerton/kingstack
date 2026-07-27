# @kingstack/advanced-optimistic-store

Advanced Optimistic Store (AOS) combines three focused pieces:

- TanStack Query Core owns remote data, freshness, and the authoritative cache.
- MobX owns the observable UI projection.
- AOS coordinates queries, transformations, optimistic CRUD, reconciliation,
  and normalized remote changes.

The package is framework-agnostic. It does not depend on React, create a
provider, manage authentication, or choose when a feature should be active.
Those decisions remain with the application.

## Installation

```bash
npm install @kingstack/advanced-optimistic-store @tanstack/query-core mobx
```

KingStack itself uses the workspace source during development. Projects created
with `create-kingstack` install the released npm package.

## Mental model

```text
API response
    │
    ▼
TanStack Query cache (authoritative API entities)
    │ transform + reconcile
    ▼
MobX UI projection (observable UI entities)
    ▲
    │ temporary optimistic layers
User mutation
```

Successful mutations update the MobX projection and any existing scoped
TanStack collection cache. Failed mutations roll back only their own optimistic
work. Overlapping mutations do not share one global snapshot.

## Requirements

The consuming workspace must provide compatible peer dependencies:

```json
{
  "dependencies": {
    "@kingstack/advanced-optimistic-store": "^0.1.0",
    "@tanstack/query-core": "^5.0.0",
    "mobx": "^6.0.0"
  }
}
```

Use the exact `QueryClient` instance owned by the application whenever
possible. This gives AOS and the rest of the application one cache:

```ts
import { QueryClient } from "@tanstack/query-core";

export const queryClient = new QueryClient();
```

Pass it as the second argument to `createOptimisticStore`. If it is omitted,
AOS uses its package-level client from `getGlobalQueryClient()`. The global
client is convenient for small non-SSR runtimes, but explicit injection is the
recommended application architecture.

## Quick start

### 1. Define API, UI, and mutation shapes

Every entity must have a string `id`.

```ts
import type { Entity } from "@kingstack/advanced-optimistic-store";

interface TodoApi extends Entity {
  title: string;
  done: boolean;
  created_at: string;
}

interface TodoUi extends Entity {
  title: string;
  done: boolean;
  createdAt: Date;
}

type CreateTodoInput = {
  title: string;
};

type UpdateTodoInput = Partial<Pick<TodoUi, "title" | "done">>;
```

### 2. Create the store

```ts
import {
  createOptimisticStore,
  type DataTransformer,
  type ObservableUIData,
} from "@kingstack/advanced-optimistic-store";
import { QueryClient } from "@tanstack/query-core";

const queryClient = new QueryClient();

const transformer: DataTransformer<TodoApi, TodoUi, CreateTodoInput> = {
  toUi: (todo) => ({
    id: todo.id,
    title: todo.title,
    done: todo.done,
    createdAt: new Date(todo.created_at),
  }),
  toApi: (todo) => ({
    id: todo.id,
    title: todo.title,
    done: todo.done,
    created_at: todo.createdAt.toISOString(),
  }),
  optimisticDefaults: {
    createOptimisticUiData: (input) => ({
      id: `todo-${crypto.randomUUID()}`,
      title: input.title,
      done: false,
      createdAt: new Date(),
    }),
  },
};

export const todoStore = createOptimisticStore<
  TodoApi,
  TodoUi,
  ObservableUIData<TodoUi>,
  CreateTodoInput,
  UpdateTodoInput
>(
  {
    name: "todos",
    queryKey: ["todos"],
    queryFn: async () => {
      const response = await fetch("/api/todos");
      if (!response.ok) throw new Error("Could not load todos");
      return response.json() as Promise<TodoApi[]>;
    },
    mutations: {
      create: async (input) => {
        const response = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) throw new Error("Could not create todo");
        return response.json() as Promise<TodoApi>;
      },
      update: async ({ id, data }) => {
        const response = await fetch(`/api/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Could not update todo");
        return response.json() as Promise<TodoApi>;
      },
      remove: async (id) => {
        const response = await fetch(`/api/todos/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Could not delete todo");
        return { id };
      },
    },
    transformer,
    staleTime: 5 * 60 * 1000,
  },
  queryClient,
);
```

Mutation endpoints must return the complete authoritative entity after a create
or update. AOS uses that response to replace the optimistic projection and
update an existing query cache entry. It does not treat one mutation result as
a complete collection when the query has never been cached.

### 3. Read and mutate

```ts
todoStore.ui.list;
todoStore.ui.count;
todoStore.ui.getById("todo-1");

await todoStore.api.create({ title: "Write documentation" });
await todoStore.api.update("todo-1", { done: true });
await todoStore.api.remove("todo-1");

todoStore.api.status.isLoading;
todoStore.api.status.isSyncing;
todoStore.api.status.hasPendingMutations;
```

`ui.entities`, `ui.list`, `ui.count`, and the status object are MobX
observables. A framework needs its normal MobX adapter to react to them. For
example, React components should use `observer` from `mobx-react-lite`.

## Query activation

Store construction and data demand are separate concerns. Supply a dynamic
`enabled` predicate, then call `updateOptions()` when its dependencies change:

```ts
let featureConsumers = 0;
let accessToken: string | null = null;

const store = createOptimisticStore(
  {
    name: "projects",
    queryKey: () => ["projects", currentUserId],
    queryFn: () => fetchProjects(accessToken),
    mutations: projectMutations,
    enabled: () => featureConsumers > 0 && accessToken !== null,
  },
  queryClient,
);

featureConsumers += 1;
store.updateOptions();

featureConsumers -= 1;
store.updateOptions();
```

While disabled, AOS holds no TanStack `QueryObserver` subscription and performs
no automatic fetch. Re-enabling follows normal TanStack freshness rules:

- fresh cached data is reused without a request;
- stale or missing data is fetched;
- changing the query key moves the store to the new cache scope.

`updateOptions()` is the normal way to re-evaluate a dynamic query key,
function, or enabled predicate. It does not force a request.

## Query keys and authentication

The query key must contain every value that changes the returned dataset:

```ts
queryKey: () => ["projects", userId, organizationId, filters];
```

Use stable data identity in the key. An access token authorizes a request but
usually does not identify its result:

```ts
// Good: token refresh reuses the same user's cache.
queryKey: () => ["projects", session?.user.id ?? "anonymous"];

// Avoid: every token refresh creates a new cache namespace.
queryKey: () => ["projects", session?.access_token];
```

When a dynamic key changes and `updateOptions()` runs, AOS clears the current
MobX projection before observing the new scope. A mutation started in the old
scope may still update an existing old-scope cache entry, but it cannot update
the new scope's UI projection.

See [Lifecycle and consistency](./docs/lifecycle-and-consistency.md) for the
full cache and concurrency contract.

## Transformations

Omitting `transformer`, or setting it to `false`, means API and UI data have the
same runtime shape. AOS does not apply implicit date, number, boolean, or CSV
conversion.

Use an explicit `DataTransformer` when the shapes differ:

- `toUi` maps confirmed API entities into the MobX projection.
- `toApi` lets optimistic updates round-trip through the UI model.
- `optimisticDefaults.createOptimisticUiData` builds a complete UI entity for
  a create before the server responds.

`createDefaultTransformer()` is still exported as a legacy, opt-in heuristic.
It only examines top-level fields and is not a runtime validation system.
Explicit transformers are safer for application data.

## Optimistic mutation behavior

### Create

A temporary UI entity is inserted immediately. On success it is replaced by
the full server entity. On failure only that create is removed or restored.

### Update

The update input is layered over the current UI entity. Concurrent updates to
the same entity are ordered, and an older server response cannot overwrite a
newer confirmed result.

For the optimistic merge to be meaningful, update fields should correspond to
fields in the UI entity. If API update input has a different shape, adapt it in
your domain-store wrapper before calling `api.update`.

### Remove

The entity is removed immediately. A failure restores the appropriate prior
entity unless a newer confirmed operation superseded it.

Query reconciliation is deferred while local mutations are pending so a
background response cannot erase optimistic layers.

## Query controls

```ts
await store.api.refetch(); // Imperative fetch, even when normally disabled
await store.api.invalidate(); // Invalidate the current query key
store.api.triggerQuery(); // Coalesced forced fetch, only while enabled
store.updateOptions(); // Re-evaluate dynamic options and freshness
store.disable(); // Close the manual query gate
store.enable(); // Open the manual gate; enabled() must also pass
```

Use `updateOptions()` for ordinary lifecycle changes. Reserve `refetch()` and
`triggerQuery()` for explicit user or recovery actions.

## Remote and realtime changes

AOS does not own a WebSocket, event source, authentication handshake, or
reconnection policy. The application owns its transport, decodes each raw event
in the relevant domain store, then submits a normalized change:

```ts
const store = createOptimisticStore(
  {
    name: "todos",
    queryFn: fetchTodos,
    mutations: todoMutations,
    transformer,
    remote: {
      localOriginId: browserId,
      shouldApply: (change, context) => {
        // Optional application ordering or authorization policy.
        return isNewerRevision(change, context.cachedEntity);
      },
    },
  },
  queryClient,
);

const unsubscribe = realtime.subscribe("todo_changed", (event) => {
  const change = decodeTodoChange(event);
  if (change) store.applyRemote(change);
});

unsubscribe();
```

`applyRemote()` updates the scoped TanStack cache and current MobX projection
through AOS's normal consistency machinery. A remote upsert becomes the latest
confirmed base beneath pending local optimistic layers; it does not overwrite
the user's in-flight intent. A remote delete remains deleted if a pending local
operation later fails.

Collection membership is explicit:

- `"include"` may insert the entity into the target collection;
- `"exclude"` removes it from that collection;
- `"unknown"` updates an existing member, does not append a missing member,
  and invalidates the exact query.

Use `queryKey` on a change to target a background scope. That cache can be
updated without changing the currently visible projection.

See [Remote changes](./docs/realtime.md) for the complete contract and transport
ownership example.

## Cleanup

The owner of a store must destroy it:

```ts
store.destroy();
```

`destroy()` is idempotent. It clears timers, removes the query subscription,
resets mutation observers, and releases internal optimistic bookkeeping. The
application remains responsible for releasing any transport subscription that
feeds `applyRemote()`. Destruction does not abort promises returned by
application query or mutation functions; use application-level cancellation
when required. Do not use a store after destroying it.

For React, create stores outside render or in a stable provider, activate them
at feature boundaries, and destroy them when their owner unmounts. A complete
pattern is in [Integration recipes](./docs/integration-recipes.md).

## Documentation

- [API reference](./docs/api-reference.md)
- [Lifecycle and consistency](./docs/lifecycle-and-consistency.md)
- [Remote changes](./docs/realtime.md)
- [Integration recipes](./docs/integration-recipes.md)
- [Package status](./STATUS.md)

## Development

```bash
yarn workspace @kingstack/advanced-optimistic-store typecheck
yarn workspace @kingstack/advanced-optimistic-store lint
yarn workspace @kingstack/advanced-optimistic-store test
yarn workspace @kingstack/advanced-optimistic-store build
```
