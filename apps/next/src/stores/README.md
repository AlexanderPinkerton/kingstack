# Store Architecture

KingStack keeps business state in framework-independent TypeScript stores.
React owns the application runtime and adapts component lifetime to store
demand; it does not contain domain or synchronization logic.

## Ownership

```text
AppProviders
├── QueryClient
└── RootStore
    ├── SessionManager
    ├── RealtimeManager
    ├── UserStoreManager
    │   ├── CurrentUserStore
    │   ├── AdvancedPostStore
    │   ├── OptimisticPostDemoController
    │   ├── RealtimeCheckboxStore
    │   ├── SharedCursorStore (one per cursor room scope)
    │   └── PublicTodoStore
    └── AdminStoreManager
        └── AdminMgmtStore
```

For backend-dependent routes, `AppProviders` constructs one QueryClient and
injects that same client through RootStore into every Advanced Optimistic
Store. It also mounts and disposes RootStore with that route runtime.

`RootStore` is the single coordinator for session and realtime changes.
`SessionManager` only reports authentication state; it does not reach into
child stores itself.

The user and admin managers are typed store containers. They do not use
string-keyed registries and do not pretend to provide bundle-level lazy
loading.

## Construction Does Not Fetch

Child stores are created together because store objects are cheap. Their
queries remain disabled until the feature has demand for them.

Each demand-driven store implements:

```ts
interface ActivatableStore {
  activate(): () => void;
}
```

Activation is reference-counted. The returned function releases one consumer,
so multiple components can safely share the same store.

```ts
const release = postStore.activate();
// Query may run if authorized and stale.
release();
// Query observer becomes inactive when the final consumer releases it.
```

React uses the generic thin adapter:

```tsx
function PostsPage() {
  const rootStore = useRootStore();
  useStoreActivation(rootStore.userStore.postStore);

  return <PostList />;
}
```

The hook only maps mount/unmount to acquire/release. Query keys, repository
composition, caching, and optimistic updates remain in raw TypeScript.

## Repository adapters

Stores that can run against multiple data sources accept a domain repository
in their constructor. `AdvancedPostStore`, for example, receives either the
authenticated Nest HTTP adapter or an in-memory draft adapter. Both expose the
same asynchronous operations and return the same API entity shape, so AOS and
the UI do not branch on a global mode.

Reusable UI receives the domain store directly. RootStore-backed pages add a
thin composition wrapper, while backend-free routes compose the same UI and
store outside `AppProviders`. See
[Frontend drafts without Supabase](../../../../docs/frontend-drafts.md).

The authenticated optimistic-post example wraps its HTTP repository with an
`OptimisticPostDemoController`. The wrapper can add visible latency or reject
one mutation before it reaches HTTP, while the unchanged `AdvancedPostStore`
performs the real optimistic update, reconciliation, and rollback. Form,
filter, and edit state lives in `OptimisticPostsViewModel`; React only renders
it and forwards events. The draft route reuses the same view with its memory
repository and without the network controls.

## Query Activation Policy

| Store | Activation |
| --- | --- |
| `CurrentUserStore` | Automatically while a permanent session exists |
| `AdvancedPostStore` | While the posts feature is mounted |
| `PublicTodoStore` | While the todo feature is mounted with a permanent session |
| `RealtimeCheckboxStore` | While the checkbox demo is mounted with a verified guest or permanent session; realtime follows the same demand |
| `SharedCursorStore` | While a surface is bound to its room; holds no query at all |
| `AdminMgmtStore` | While the admin-management feature is mounted and an authorized session exists |

TanStack Query still decides whether activation requires a network request.
Fresh confirmed cache data can be reused without an unconditional refetch.

## Session and Cache Identity

RootStore forwards every session event to both store groups. Admin stores do
not fetch merely because they received a session; their feature must also be
active.

Anonymous Supabase sessions are demo credentials, not application-data
credentials. RootStore gives their access token to RealtimeManager and the
bounded checkbox demo, while UserStoreManager withholds it from profile, post,
and todo stores. Canvas, cursor, and wave-pool stores are transport-only and
remain available.

Authenticated query keys use data identity:

```ts
["advanced-posts", context.scope]
```

Access tokens authorize requests but are not cache identity. Token refreshes
therefore update credentials without creating a new cache namespace.

When user identity changes, authenticated stores clear their MobX projection
and move to the new scoped query key.

## Realtime

RootStore owns one RealtimeManager and one socket. Domain stores subscribe and
publish by channel, validate their raw transport events, and pass normalized
`RemoteChange` values to AOS. The manager knows nothing about domain stores or
query caches.

### Rooms

Every realtime message is scoped to a room named `<namespace>:<scope>`, such as
`checkboxes:global` or `cursors:realtime-demo`. `RealtimeManager.joinRoom()` is
ref-counted and re-joins on reconnect, so entity fan-out and presence for one
feature never reach clients looking at another. The server owns the namespace
policy — who may join, and what a valid presence payload looks like — in
`apps/nest/src/realtime/presence/room-namespaces.ts`. Adding a collaborative
example means adding one entry there, not another gateway handler.

`RealtimeManager.publish()` takes two options that matter for presence:
`latestKey` retains the message as the caller's current state and replays it
after a reconnect, and `throttleMs` coalesces to a trailing edge so a pointer
stream collapses to one frame per interval instead of one per pixel.

### Presence

`PresenceRoom<TState>` (`src/lib/realtime/presence-room.ts`) is the shared
client half: it holds an observable roster, applies local state immediately,
ignores the server's echo of its own participant, and preserves the local entry
across an authoritative roster sync. Features differ only in the `TState` they
put on the wire — a grid index for checkboxes, a normalized point for cursors.

`SharedCursorStore` is the purely ephemeral case: it never touches Postgres or
the AOS cache, which is what lets it publish at pointer rate. Its DOM wiring
lives in `CursorSurfaceController`, outside React, so pointermove never causes a
render or a forced layout.

### Two coordinate spaces

The surface controller always reports a fraction of the element it is bound to.
What that fraction *means* is decided by the store's projection, and the two
examples deliberately choose differently:

| Room | Space | Agrees across devices? |
| --- | --- | --- |
| `cursors:realtime-demo` | Fraction of the bound surface | Only between clients rendering the same layout |
| `canvas:world` | Absolute units in a fixed 1600×1000 world | Always |

A fraction of a responsive card is not a location: the realtime example renders
16 checkboxes on a phone and 200 at `xl`, so the same fraction names different
content on different devices. The canvas example fixes this by locking its stage
to the world's aspect ratio, which makes the stage the world at a uniform scale
and leaves nothing for two clients to disagree about.

Anything needing exact cross-device presence over a responsive layout wants a
third approach — anchor-relative coordinates, `{ anchorId, dx, dy }`, resolved
against a stable DOM node on the receiving client and hidden when that node is
absent. Nothing in the repo needs it yet.

### Signals

Presence answers "where are you now". A signal answers "something happened
here": a one-shot room event that is never retained, never replayed to a late
joiner, and never re-sent after a reconnect, because it means nothing after the
moment it arrives. `PresenceRoom.sendSignal()` and `onSignal()` are the client
half; the server validates them through `validateSignal` on the room namespace,
which is opt-in, so a room accepts no signals unless it asks to.

Signals get their own token bucket, much tighter than presence: a sampled
pointer stream is expected to be fast, a deliberate user action is not.

Canvas taps are the first use. They matter beyond decoration — a touch client
has no hover to sample and so publishes no cursor at all, which makes a tap the
only presence it can express.

Channel subscriptions survive socket recreation and are released by their
domain owners. Realtime-capable feature stores gate those subscriptions on
feature demand; the checkbox store listens only while its feature is active.

The side-by-side checkbox example deliberately owns a second QueryClient,
RealtimeManager, and RealtimeCheckboxStore in a route-level controller. This is
the simulated collaborator boundary: the two panes never share checkbox memory,
and the controller disposes the extra cache and socket with the example.

## Disposal

Ownership is symmetrical:

```text
AppProviders unmounts
→ RootStore.dispose()
→ session listener unsubscribes
→ child stores dispose
→ feature realtime subscriptions and AOS query observers are destroyed
→ realtime disconnects
```

Every new child store must implement `dispose()` and call
`optimisticStore.destroy()`.

## Adding a Store

1. Create a domain store in the appropriate feature folder.
2. Define a domain repository contract and its production adapter.
3. Accept the shared QueryClient and repository in the store constructor.
4. Add an `enabled` predicate that separates runtime availability from feature
   demand.
5. Implement `activate()` when the query should be feature-driven.
6. Implement `dispose()` and destroy the optimistic store.
7. Add the store as a typed property of the user or admin store manager.
8. Forward runtime context only if the store needs it.
9. Add `useStoreActivation()` at the feature boundary that needs its data.

For genuinely large or optional domains, prefer a route-level provider and
dynamic route bundle instead of a synchronous “lazy” getter. Client-side code
splitting is a performance boundary, not an authorization boundary; the server
must always enforce permissions.
