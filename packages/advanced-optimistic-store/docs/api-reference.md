# API reference

This reference describes the public exports of
`@kingstack/advanced-optimistic-store`. Types shown here are abbreviated for
readability; the source of truth is `src/core/types.ts`.

## Package exports

```ts
// Core
createOptimisticStore;
ObservableUIData;

// Transform helpers
createTransformer;
createDefaultTransformer;

// Query client
getGlobalQueryClient;

// Realtime
RealtimeExtension;
createRealtimeExtension;

// Types
Entity;
OptimisticDefaults;
DataTransformer;
OptimisticStoreConfig;
OptimisticStore;
RealtimeConfig;
RealtimeEvent;
RealtimeOperation;
RealtimeSocket;
```

Realtime values and types are also available from
`@kingstack/advanced-optimistic-store/realtime`.

## `Entity`

```ts
interface Entity {
  id: string;
}
```

Both API and UI entities must satisfy this contract. AOS uses the ID as the
normalized MobX map key and to reconcile query and mutation results.

## `createOptimisticStore`

```ts
function createOptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends ObservableUIData<TUiData> = ObservableUIData<TUiData>,
  TCreateInput = any,
  TUpdateInput = any,
  TOptimisticContext = any,
>(
  config: OptimisticStoreConfig<
    TApiData,
    TUiData,
    TCreateInput,
    TUpdateInput,
    TOptimisticContext
  >,
  queryClient?: QueryClient,
): OptimisticStore<TApiData, TUiData, TStore, TCreateInput, TUpdateInput>;
```

Passing `queryClient` is recommended. Omitting it uses the client returned by
`getGlobalQueryClient()`.

### Generic parameters

| Parameter            | Meaning                                                 |
| -------------------- | ------------------------------------------------------- |
| `TApiData`           | Complete entity shape returned by queries and mutations |
| `TUiData`            | Entity shape stored in MobX after transformation        |
| `TStore`             | `ObservableUIData` or an application subclass           |
| `TCreateInput`       | Input accepted by `api.create`                          |
| `TUpdateInput`       | Input accepted by `api.update`                          |
| `TOptimisticContext` | Dynamic context passed to optimistic create defaults    |

The input types default to `any` for compatibility. Applications should provide
them explicitly when mutation type safety matters.

## `OptimisticStoreConfig`

### `name`

```ts
name: string;
```

Required human-readable identifier. It is also the fallback query key:
`[name]`.

### `queryKey`

```ts
queryKey?: QueryKey | (() => QueryKey);
```

The complete TanStack Query key. Use a function when the scope changes at
runtime, and call `store.updateOptions()` after its dependencies change.

The key must include user, tenant, pagination, filters, and any other value that
changes the returned dataset.

### `queryFn`

```ts
queryFn: () => Promise<TApiData[]>;
```

Fetches the complete entity collection represented by `queryKey`. The result
is stored in TanStack Query as API data and reconciled into the MobX UI
projection.

Returning `undefined` is invalid TanStack Query behavior. Return an empty array
when the collection is empty.

### `mutations`

```ts
mutations: {
  create: (data: TCreateInput) => Promise<TApiData>;
  update: (params: { id: string; data: TUpdateInput }) => Promise<TApiData>;
  remove: (id: string) => Promise<{ id: string } | void>;
}
```

Create and update must return the complete authoritative API entity. Remove may
return the removed ID or no value because the requested ID is already known.

Errors must reject or throw. AOS uses rejection to roll back that operation's
optimistic state.

### `transformer`

```ts
transformer?:
  | DataTransformer<TApiData, TUiData, TCreateInput, TOptimisticContext>
  | false;
```

Maps confirmed API entities to UI entities and supports optimistic rendering.
Omitting it or setting it to `false` uses identity mode; no implicit conversion
occurs.

### `optimisticDefaults`

```ts
optimisticDefaults?: OptimisticDefaults<
  TUiData,
  TCreateInput,
  TOptimisticContext
>;
```

Builds the complete UI entity shown during `api.create`. It may be placed on
the config or on the transformer. Transformer defaults take precedence when
both are present.

If no defaults are supplied, AOS constructs `{ id: temporaryId, ...input }`.
When a transformer exists, that candidate is passed through `toUi`. Explicit
defaults are therefore strongly recommended when create input and API entity
shapes differ.

### `optimisticContext`

```ts
optimisticContext?: () => TOptimisticContext;
```

Returns current application data used only when creating the optimistic UI
entity:

```ts
optimisticContext: () => ({
  currentUser: session?.user ?? null,
});
```

The function is evaluated for each create, not only during store construction.

### `storeClass`

```ts
storeClass?: new (
  transformer?: DataTransformer<TApiData, TUiData>,
) => ObservableUIData<TUiData>;
```

Creates a custom MobX UI projection. The class must extend
`ObservableUIData<TUiData>` and accept the transformer constructor argument.

### `staleTime`

```ts
staleTime?: number;
```

Milliseconds before query data is stale. The default is five minutes.

### `enabled`

```ts
enabled?: () => boolean;
```

Dynamic automatic-query gate. The default is enabled. Call `updateOptions()`
whenever values used by the predicate change.

This predicate is combined with the store's manual `enable()`/`disable()` gate.
Both must allow the query for an automatic observer subscription to exist.

### `realtime`

```ts
realtime?: RealtimeConfig<TApiData, TUiData>;
```

Adds the optional `store.realtime` API. It does not create or own a socket.
See [Realtime](./realtime.md).

## `OptimisticStore`

### `ui`

```ts
ui: TStore;
```

The observable UI projection. It always exists, including while the query is
disabled or loading.

### `api.create`

```ts
api.create(data: TCreateInput): Promise<TApiData>;
```

Adds an optimistic UI entity, runs the create mutation, then replaces or rolls
back only that operation.

### `api.update`

```ts
api.update(id: string, data: TUpdateInput): Promise<TApiData>;
```

Optimistically layers update fields over an entity already in the UI
projection. If the entity is absent, the server mutation still runs but no
optimistic UI layer is applied.

### `api.remove`

```ts
api.remove(id: string): Promise<{ id: string } | void>;
```

Optimistically removes the entity, then confirms the removal or restores the
appropriate prior state.

### `api.refetch`

```ts
api.refetch(): Promise<QueryObserverResult<TApiData[], Error>>;
```

Imperatively fetches the current query. This is explicit and can run even when
the store's ordinary `enabled` predicate is false. AOS temporarily subscribes
for the operation if necessary.

### `api.invalidate`

```ts
api.invalidate(): Promise<void>;
```

Invalidates the current resolved query key through the injected QueryClient.
TanStack Query decides whether an active observer should refetch.

### `api.triggerQuery`

```ts
api.triggerQuery(): void;
```

Schedules a forced refetch after a short coalescing delay. It does nothing
while the store is disabled or after destruction.

### `api.status`

```ts
api.status: {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isSyncing: boolean;
  createPending: boolean;
  updatePending: boolean;
  deletePending: boolean;
  hasPendingMutations: boolean;
};
```

| Field                 | Meaning                                             |
| --------------------- | --------------------------------------------------- |
| `isLoading`           | TanStack Query has no confirmed data and is loading |
| `isError`             | The current query is in an error state              |
| `error`               | Current query error                                 |
| `isSyncing`           | The query is fetching, including background fetches |
| `createPending`       | At least one create is pending                      |
| `updatePending`       | At least one update is pending                      |
| `deletePending`       | At least one remove is pending                      |
| `hasPendingMutations` | At least one mutation of any kind is pending        |

The pending flags are backed by counters, so concurrent operations remain
pending until the final operation of that kind settles.

### `updateOptions`

```ts
updateOptions(): void;
```

Re-resolves `queryKey`, `queryFn`, and `enabled`, updates the query observer,
and synchronizes its subscription. It follows normal TanStack freshness rules
and does not force a refetch.

A changed query key clears the current MobX projection and local optimistic
bookkeeping before moving to the new scope.

### `enable` and `disable`

```ts
enable(): void;
disable(): void;
isEnabled(): boolean;
```

The manual gate starts enabled.

- `disable()` closes it and removes the query subscription.
- `enable()` opens it and applies the current dynamic `enabled` predicate.
- `isEnabled()` returns the combined manual and dynamic state.

Disabling does not clear the current UI projection when the query key is
unchanged.

### `destroy`

```ts
destroy(): void;
```

Idempotently releases internal resources. The owner must call it when the
store's lifetime ends. It does not abort application-owned query or mutation
promises that are already running. Calls made after destruction are outside the
supported lifecycle.

### `realtime`

```ts
realtime?: {
  readonly isConnected: boolean;
  connect(socket: RealtimeSocket): void;
  disconnect(): void;
};
```

Present only when the configuration includes `realtime`.

## `ObservableUIData`

```ts
class ObservableUIData<T extends Entity> {
  entities: Map<string, T>;

  readonly list: T[];
  readonly count: number;

  get(id: string): T | undefined;
  getById(id: string): T | undefined;
  hasItem(id: string): boolean;
  snapshot(): T[];

  upsert(entity: T): void;
  update(id: string, updates: Partial<T>): void;
  remove(id: string): void;
  clear(): void;

  filter(predicate: (entity: T) => boolean): T[];
  find(predicate: (entity: T) => boolean): T | undefined;

  pushSnapshot(): void;
  rollback(): void;
  reconcile<TApiData extends Entity>(
    serverData: TApiData[],
    transformer?: DataTransformer<TApiData, T>,
  ): void;
}
```

`entities`, `list`, and `count` are observable/computed MobX state. Mutation and
reconciliation methods are actions.

`pushSnapshot()` and `rollback()` are low-level public utilities on the UI
container. AOS mutations do not use one shared snapshot stack; they maintain
operation-specific rollback context to remain correct under concurrency.

## Transformers

### `DataTransformer`

```ts
interface DataTransformer<
  TApiData extends Entity,
  TUiData extends Entity,
  TCreateInput = any,
  TOptimisticContext = any,
> {
  toUi(apiData: TApiData): TUiData;
  toApi(uiData: TUiData): TApiData;
  optimisticDefaults?: OptimisticDefaults<
    TUiData,
    TCreateInput,
    TOptimisticContext
  >;
}
```

### `createTransformer`

Normalizes the optional transformer configuration:

```ts
createTransformer(transformer);
```

It returns an explicit transformer unchanged and returns `undefined` for
identity mode. Most application code does not need to call this helper.

### `createDefaultTransformer`

Returns the legacy top-level heuristic transformer. It recognizes some date,
boolean, numeric, and comma-separated string patterns. It is not used
implicitly and does not validate input.

## Query client

### `getGlobalQueryClient`

```ts
getGlobalQueryClient(): QueryClient;
```

Returns AOS's mounted process-level QueryClient. It uses a five-minute
`staleTime`, ten-minute `gcTime`, one retry, no window-focus refetch, and
reconnect refetching.

Prefer an injected client in applications, tests, SSR, and any runtime that
already owns a QueryClient.

## Standalone realtime extension

`RealtimeExtension` and `createRealtimeExtension` can attach the same event
handling to an existing `ObservableUIData` without creating a full optimistic
store:

```ts
const extension = createRealtimeExtension(
  uiStore,
  "todo_changed",
  realtimeOptions,
);

extension.connect(socket);
extension.disconnect();
```

When used standalone, the extension updates only the supplied UI store. It has
no QueryClient to synchronize.
