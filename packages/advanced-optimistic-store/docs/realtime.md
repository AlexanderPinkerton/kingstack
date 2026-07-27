# Realtime

AOS realtime support adapts event-emitter-style transports to the MobX
projection. It does not create, authenticate, reconnect, or dispose the
application's socket.

## Socket contract

```ts
interface RealtimeSocket {
  readonly connected?: boolean;
  on(eventType: string, listener: (event: RealtimeEvent) => void): unknown;
  off(eventType: string, listener: (event: RealtimeEvent) => void): unknown;
}
```

Socket.IO clients satisfy this shape. Other transports can use a small adapter.
Correct cleanup requires `off` to receive the same listener reference that was
given to `on`; AOS maintains that stable reference.

## Event contract

```ts
type RealtimeOperation = "INSERT" | "UPDATE" | "DELETE";

interface RealtimeEvent<T = unknown> {
  type: string;
  event: RealtimeOperation;
  data?: T;
  browserId?: string;
  [key: string]: unknown;
}
```

The configured `eventType` is the socket channel name. By default, AOS also
requires `event.type` to match that value.

## Store configuration

```ts
const store = createOptimisticStore(
  {
    name: "todos",
    queryKey: ["todos"],
    queryFn: fetchTodos,
    mutations: todoMutations,
    transformer: todoTransformer,
    realtime: {
      eventType: "todo_changed",
      browserId,
      dataExtractor: (event) => event.todo,
      shouldProcessEvent: (event) =>
        event.type === "todo_changed" && event.workspaceId === workspaceId,
      onApplied: (operation, todo) => {
        auditRemoteChange(operation, todo.id);
      },
      onError: (error, event) => {
        reportRealtimeError(error, event);
      },
    },
  },
  queryClient,
);
```

The resulting optional API is:

```ts
store.realtime?.connect(socket);
store.realtime?.isConnected;
store.realtime?.disconnect();
```

Calling `connect` again disconnects the previous socket listener first.
`store.destroy()` also disconnects it.

## Event processing order

For each received event, AOS:

1. ignores it when `browserId` matches the configured browser ID;
2. evaluates `shouldProcessEvent`, if supplied;
3. finds a custom handler by database operation, then by event channel type;
4. otherwise extracts data;
5. applies the default `INSERT`, `UPDATE`, or `DELETE` behavior;
6. calls `onApplied` after a default operation;
7. sends thrown processing errors to `onError`.

When `shouldProcessEvent` is omitted, the helper used by the optimistic store
defaults it to:

```ts
event.type === realtime.eventType;
```

## Data extraction

The default extractor reads `event.data`. Supply `dataExtractor` when the
server uses another envelope:

```ts
realtime: {
  eventType: "todo_changed",
  dataExtractor: (event) => event.todo,
}
```

Returning `undefined` ignores the event.

The extracted value must be a complete API entity. `INSERT` and `UPDATE` pass
it through the store transformer. `DELETE` uses its `id`.

## Default behavior

| Operation | MobX projection      | TanStack cache                    |
| --------- | -------------------- | --------------------------------- |
| `INSERT`  | Transform and upsert | Upsert into existing scoped cache |
| `UPDATE`  | Transform and upsert | Upsert into existing scoped cache |
| `DELETE`  | Remove by ID         | Remove from existing scoped cache |

The cache update is scoped to the query key resolved when the event is
processed. If no cache entry exists yet, realtime does not invent a complete
collection from one entity.

## Self-echo filtering

If mutations are broadcast back to the originating browser, attach a stable
browser ID to both the socket protocol and AOS config:

```ts
realtime: {
  eventType: "todo_changed",
  browserId: browserInstanceId,
}
```

An event with the same `event.browserId` is ignored. This prevents the server
echo from being applied twice.

The server must preserve the originating browser ID for this mechanism to
work.

## Custom handlers

Handlers may be keyed by operation:

```ts
customHandlers: {
  UPDATE: (ui, event) => {
    const todo = event.data;
    if (!todo) return;
    ui.upsertViaRealtime(todo);
  },
}
```

or by channel type:

```ts
customHandlers: {
  todo_changed: (ui, event) => {
    // Domain-specific processing
  },
}
```

Operation handlers take precedence over channel handlers.

A custom handler replaces the default path. Consequently:

- `dataExtractor` is not used automatically;
- `onApplied` is not called automatically;
- the optimistic store's default TanStack cache synchronization is skipped.

This is intentional: a custom handler owns the entire event transaction. If it
changes the UI and the authoritative cache must match, update the injected
QueryClient in the handler or invalidate the relevant query afterward.

## Conflict ordering

AOS processes realtime events in arrival order. It does not infer causality or
compare versions.

For revisioned data:

```ts
shouldProcessEvent: (event) => {
  const incoming = event.data;
  if (!incoming) return false;

  const current = store.ui.get(incoming.id);
  return !current || incoming.revision > current.revision;
};
```

For more complex merge rules, use a custom handler. CRDT, vector-clock, and
multi-region conflict resolution remain application concerns.

## Socket ownership

In applications with several stores:

1. own one authenticated socket in an application-level manager;
2. register feature stores with that manager;
3. connect a store's realtime listener only while the feature has demand;
4. disconnect listeners before disposing the socket;
5. destroy stores when their owner ends.

This prevents eagerly constructed but inactive stores from processing remote
events they do not currently need.

## Standalone extension

The realtime module can update an `ObservableUIData` without a full optimistic
store:

```ts
import {
  createRealtimeExtension,
  ObservableUIData,
} from "@kingstack/advanced-optimistic-store";

const ui = new ObservableUIData<TodoUi>(todoTransformer);
const realtime = createRealtimeExtension<TodoApi, TodoUi>(ui, "todo_changed", {
  browserId,
});

realtime.connect(socket);
realtime.disconnect();
```

Standalone extensions have no QueryClient, so they update only the MobX store.
