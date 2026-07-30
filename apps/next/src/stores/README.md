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
    │   ├── RealtimeCheckboxStore
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

## Query Activation Policy

| Store | Activation |
| --- | --- |
| `CurrentUserStore` | Automatically while a session exists |
| `AdvancedPostStore` | While the posts feature is mounted |
| `PublicTodoStore` | While the public-todos feature is mounted |
| `RealtimeCheckboxStore` | While the checkbox feature is mounted; realtime follows the same demand |
| `AdminMgmtStore` | While the admin-management feature is mounted and an authorized session exists |

TanStack Query still decides whether activation requires a network request.
Fresh confirmed cache data can be reused without an unconditional refetch.

## Session and Cache Identity

RootStore forwards every session event to both store groups. Admin stores do
not fetch merely because they received a session; their feature must also be
active.

Authenticated query keys use data identity:

```ts
["advanced-posts", context.scope]
```

Access tokens authorize requests but are not cache identity. Token refreshes
therefore update credentials without creating a new cache namespace.

When user identity changes, authenticated stores clear their MobX projection
and move to the new scoped query key.

## Realtime

RootStore owns one RealtimeManager and one socket. Domain stores subscribe by
channel, validate their raw transport events, and pass normalized
`RemoteChange` values to AOS. The manager knows nothing about domain stores or
query caches.

Channel subscriptions survive socket recreation and are released by their
domain owners. Realtime-capable feature stores gate those subscriptions on
feature demand; the checkbox store listens only while its feature is active.

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
