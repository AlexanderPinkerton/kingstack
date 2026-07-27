# Remote changes

AOS accepts normalized remote changes. It deliberately does not create or own
a WebSocket, Socket.IO client, server-sent event stream, authentication
handshake, channel registry, or reconnection policy.

This boundary keeps three responsibilities separate:

```text
transport manager
  owns connection, authentication, reconnection, and raw subscriptions
        │ raw event
        ▼
domain store
  validates the envelope and maps domain meaning
        │ RemoteChange<TApiData>
        ▼
AOS applyRemote()
  coordinates query cache, MobX projection, and optimistic layers
```

The transport can change without changing AOS, and wire-specific event shapes
do not leak into the generic state package.

## Normalized change contract

```ts
type RemoteChange<TApiData extends Entity> =
  | {
      operation: "insert" | "update";
      entity: TApiData;
      membership?: "include" | "exclude" | "unknown";
      queryKey?: QueryKey;
      originId?: string;
      revision?: string | number;
    }
  | {
      operation: "delete";
      id: string;
      queryKey?: QueryKey;
      originId?: string;
      revision?: string | number;
    };
```

`entity` must be the complete API representation, not a UI object or partial
patch. AOS transforms it before placing it in the MobX projection.

`insert` and `update` currently share upsert behavior. The distinction is kept
because domain policies, logging, and future consumers may care which server
operation occurred.

## Applying a change

```ts
const result = store.applyRemote({
  operation: "update",
  entity: updatedTodo,
  membership: "include",
  originId: event.browserId,
  revision: updatedTodo.revision,
});
```

The result reports whether the change was applied and which scope it affected:

```ts
type RemoteApplyResult =
  | {
      applied: true;
      scope: "current" | "background";
      queryKey: QueryKey;
    }
  | {
      applied: false;
      reason: "destroyed" | "self-origin" | "rejected";
      queryKey: QueryKey;
    };
```

An applied result means AOS performed the safe action for that change. For an
unknown missing member, that action is query invalidation rather than insertion.

## Collection membership

A remote entity alone cannot tell AOS whether it belongs in a filtered,
paginated, permission-scoped, or tenant-scoped collection. Upserts therefore
carry a membership decision.

| Membership | Existing member                   | Missing member                  |
| ---------- | --------------------------------- | ------------------------------- |
| `include`  | Replace with confirmed entity     | Append to existing cache and UI |
| `exclude`  | Remove from target cache and UI   | No visible change               |
| `unknown`  | Update and invalidate exact query | Do not append; invalidate query |

`unknown` is the default. It is intentionally conservative. An unfiltered
domain store that knows every valid entity belongs can explicitly use
`membership: "include"`.

AOS only mutates an existing TanStack collection cache. One event is not enough
to construct a complete collection when no cache entry exists.

## Query scope

When `queryKey` is omitted, the change targets the store's currently resolved
query key.

Supply a key when the raw event identifies another known scope:

```ts
store.applyRemote({
  operation: "update",
  entity: project,
  membership: "include",
  queryKey: ["projects", project.organizationId],
});
```

If the target is the current scope, AOS updates both its existing cache entry
and the MobX projection. If it is a background scope, only that existing cache
entry changes. The visible projection is never contaminated with data from
another user, tenant, filter, or page.

The domain decoder must build keys using the same identity rules as the store's
`queryKey`.

## Local and remote concurrency

Incoming changes do not bypass AOS's optimistic state.

For a remote upsert received while local updates are pending:

1. the remote entity becomes the new confirmed base;
2. pending local layers remain on top and stay visible;
3. local success replaces the base with its authoritative mutation response;
4. local failure removes only its own layer and reveals the remote base.

For a remote delete:

1. the entity disappears immediately;
2. an already-pending local delete failure does not resurrect it;
3. an already-pending local update failure does not resurrect it;
4. a successful local update can re-establish the entity from its authoritative
   response.

This is state coordination, not distributed conflict resolution. The
application still decides whether the remote message itself is current and
valid.

## Origin and revision policy

Configure optional application policy on the store:

```ts
const store = createOptimisticStore({
  // ...
  remote: {
    localOriginId: () => browserSession.id,
    shouldApply: (change, context) => {
      if (change.revision === undefined) return true;

      const currentRevision =
        context.cachedEntity?.revision ?? context.visibleEntity?.revision ?? -1;

      return Number(change.revision) > Number(currentRevision);
    },
  },
});
```

If both IDs are present and `change.originId` equals `localOriginId`, AOS
returns `reason: "self-origin"`. If the server does not preserve the origin in
its broadcast, filtering cannot occur.

`revision` is opaque metadata. AOS does not compare it automatically because
timestamps, monotonic integers, database revisions, vector clocks, and logical
versions have different semantics. `shouldApply` owns that domain decision and
returns `false` to reject the whole change.

## Domain decoder

Validate and normalize at the application boundary:

```ts
interface TodoSocketEvent {
  type?: string;
  event?: "INSERT" | "UPDATE" | "DELETE";
  todo?: TodoApi;
  browserId?: string;
}

function decodeTodoChange(
  event: TodoSocketEvent,
): RemoteChange<TodoApi> | null {
  if (event.type && event.type !== "todo_changed") return null;
  if (!event.event || !event.todo) return null;

  if (event.event === "DELETE") {
    return {
      operation: "delete",
      id: event.todo.id,
      originId: event.browserId,
      revision: event.todo.revision,
    };
  }

  return {
    operation: event.event === "INSERT" ? "insert" : "update",
    entity: event.todo,
    membership: "include",
    originId: event.browserId,
    revision: event.todo.revision,
  };
}
```

Runtime-schema validation is recommended when events cross an untrusted or
loosely typed boundary.

## Transport ownership

Expose the smallest interface domain stores need:

```ts
interface RealtimeSource {
  subscribe<TEvent>(
    channel: string,
    listener: (event: TEvent) => void,
  ): () => void;
}
```

The application-level manager owns the socket and retains subscriptions across
token refresh or socket recreation. The domain store owns decoding and feature
demand:

```ts
class TodosStore {
  private releaseRealtime: (() => void) | null = null;

  constructor(
    private readonly source: RealtimeSource,
    readonly state: OptimisticStore<TodoApi, TodoUi>,
  ) {}

  activate(): () => void {
    if (!this.releaseRealtime) {
      this.releaseRealtime = this.source.subscribe<TodoSocketEvent>(
        "todo_changed",
        (event) => {
          const change = decodeTodoChange(event);
          if (change) this.state.applyRemote(change);
        },
      );
    }

    return () => {
      this.releaseRealtime?.();
      this.releaseRealtime = null;
    };
  }

  dispose(): void {
    this.releaseRealtime?.();
    this.releaseRealtime = null;
    this.state.destroy();
  }
}
```

For multiple consumers, use reference-counted feature demand so one component
cannot unsubscribe while another still needs the store.

The application runtime should dispose domain stores before disposing the
transport manager. AOS's `destroy()` cannot release subscriptions it does not
own.

## Error ownership

The transport manager owns connection errors and connection status. The domain
decoder owns malformed or unsupported event handling. `applyRemote()` is
synchronous and reports policy rejection in its result.

If a rejected or malformed event means the local cache may be stale, the domain
store can call `api.invalidate()` or target the relevant query through the
application's QueryClient.
