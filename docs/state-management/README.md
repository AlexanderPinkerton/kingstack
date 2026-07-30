# State management architecture

KingStack separates package-level server-state behavior from
application-level ownership:

- [Advanced Optimistic Store](https://github.com/AlexanderPinkerton/kingstack/tree/main/packages/advanced-optimistic-store)
  documents queries, caching, transformations, optimistic concurrency, and
  normalized remote changes.
- [Next store architecture](../../apps/next/src/stores/README.md) documents the
  application's RootStore, session propagation, feature activation, and
  disposal conventions.

This page explains how those layers fit together. It intentionally does not
duplicate either API reference.

## Runtime ownership

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

`AppProviders` creates one QueryClient and passes that exact instance into
RootStore. RootStore passes it into each AOS-backed domain store. React owns the
runtime lifetime, but business behavior remains in plain TypeScript.

There is no module-level RootStore singleton. `useRootStore()` reads the
provider-owned instance and fails clearly when called outside the provider.

## Responsibilities

### AppProviders

- owns one QueryClient and RootStore per mounted application runtime;
- exposes them through the TanStack and RootStore providers;
- mounts and disposes RootStore with the application;
- contains no domain rules.

### RootStore

- receives every session event;
- exposes observable session and readiness state;
- propagates session changes to user and admin store groups;
- owns the authenticated realtime connection;
- disposes managers and infrastructure in one path.

### SessionManager

- subscribes to the Supabase authentication source;
- reports session changes to RootStore;
- does not know which domain stores exist;
- does not enable or disable queries directly.

### RealtimeManager

- owns one authenticated socket;
- exposes observable connection status without exposing the raw socket;
- retains channel subscriptions across socket recreation;
- releases listeners and the socket during teardown.

### Store managers

UserStoreManager and AdminStoreManager are typed containers and lifecycle
coordinators. They do not use string registries or synchronous getters
described as code splitting.

Creating child store objects is cheap. A route-level dynamic import or provider
is the appropriate boundary when a domain genuinely needs bundle-level lazy
loading.

### Domain stores

Each domain store owns:

- its complete query key;
- its repository contract and runtime context;
- API-to-UI transformations;
- activation policy;
- optimistic behavior exposed by AOS;
- domain actions and computed state;
- cleanup.

Domain stores do not depend on React.

## Construction versus demand

Store construction does not imply fetching. Optional domains use a
reference-counted activation lease:

```ts
interface ActivatableStore {
  activate(): () => void;
}
```

The first consumer activates query demand. The final returned release function
removes it. Multiple components can therefore share one store safely.

React uses one thin adapter:

```tsx
function useStoreActivation(store: ActivatableStore): void {
  useEffect(() => store.activate(), [store]);
}
```

All enabling rules remain in the domain store:

```ts
enabled: () => demand.isActive && Boolean(session?.access_token);
```

Stores that support more than one data source use a repository-neutral
predicate instead:

```ts
enabled: () => demand.isActive && context.enabled;
```

When demand or session changes, the store calls `updateOptions()`. TanStack
Query then decides whether cached data is fresh or a request is necessary.

## Current activation policy

| Store                   | Demand source                                                  |
| ----------------------- | -------------------------------------------------------------- |
| `CurrentUserStore`      | Automatically active while authenticated                        |
| `AdvancedPostStore`     | Posts feature component                                        |
| `PublicTodoStore`       | Public-todos feature component                                 |
| `RealtimeCheckboxStore` | Checkbox feature; realtime follows the same demand             |
| `AdminMgmtStore`        | Admin-management feature plus authorized session               |

This policy prevents the early-query behavior that the previous pseudo-lazy
manager implementation attempted to solve.

## Sessions and cache identity

Authenticated repository adapters read the current access token when a request
runs, while domain stores use stable data identity in the query key:

```ts
queryKey: () => ["advanced-posts", context.scope];
```

This has two important effects:

- a token refresh updates credentials without throwing away fresh user data;
- a user change moves the store to a different cache namespace.

When a scoped key changes, AOS clears the visible MobX projection before
observing the new scope. An old in-flight mutation may update its original
cache entry, but cannot leak into the new user's UI.

## Data flow

```text
Component action
    │
    ▼
Plain TypeScript domain action
    │
    ▼
AOS mutation
├── MobX UI projection: temporary optimistic layer
├── Repository: perform an in-memory or remote mutation
└── TanStack cache: commit complete confirmed response
    │
    ▼
MobX projection: reconcile confirmed data and later optimistic layers
```

The TanStack cache stores API entities. MobX stores transformed UI entities.
Temporary optimistic entities remain in MobX and do not pollute the
authoritative API cache.

## Realtime flow

```text
Session with token
    │
    ▼
RealtimeManager socket
    │
    ▼
Domain-store subscription with active demand
    │
    ▼
Validate and decode raw domain event
    │
    ▼
AOS applyRemote()
├── apply origin and domain policy
├── update the scoped TanStack cache
├── preserve pending optimistic layers
└── reconcile the current MobX projection
```

Socket ownership and feature-listener ownership are separate. The application
can keep one authenticated connection while inactive features hold no event
listeners.

## Disposal

Ownership is symmetrical:

```text
AppProviders unmounts
→ RootStore disposes
→ SessionManager unsubscribes
→ store managers dispose
→ domain stores destroy AOS instances
→ feature realtime subscriptions are released
→ RealtimeManager disconnects
```

React Strict Mode's development setup/cleanup/setup probe is handled at the
RootStore mount boundary so it does not permanently dispose the runtime between
probe effects.

## Backend-free frontend drafts

Reusable domain UI can receive a store directly instead of reading RootStore.
The same store can then be composed with an in-memory repository under
`/drafts`, outside the Supabase-backed runtime route group. Moving the feature
to production changes only its repository composition.

See [Frontend drafts without Supabase](../frontend-drafts.md) for the workflow
and the advanced-posts reference implementation.

## Adding a domain store

1. Define API, UI, create-input, and update-input types.
2. Define a repository contract for the domain's data operations.
3. Put transport and authorization details in production adapters.
4. Accept the shared QueryClient and repository in the store constructor.
5. Create the AOS instance with a complete scoped query key.
6. Add a demand predicate if the domain is optional.
7. Implement `activate()` with reference-counted release when needed.
8. Implement idempotent `dispose()` and call `destroy()`.
9. Add the store as a typed manager property.
10. Forward runtime context only when the domain needs it.
11. Subscribe to raw realtime events and decode them into `RemoteChange` values
    only when the domain needs it.
12. Activate the store at its feature boundary.
13. Add tests for inactive behavior, scope changes, rollback, and cleanup.

For AOS configuration and mutation contracts, use the
[package API reference](https://github.com/AlexanderPinkerton/kingstack/blob/main/packages/advanced-optimistic-store/docs/api-reference.md).
