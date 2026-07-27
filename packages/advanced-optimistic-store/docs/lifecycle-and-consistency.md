# Lifecycle and consistency

AOS coordinates two different state models:

- TanStack Query stores confirmed API entities by query key.
- MobX stores the transformed UI projection plus temporary optimistic work.

Correct application integration depends on keeping their ownership and
lifetimes explicit.

## Store lifetime

Creating an enabled store creates one TanStack `QueryObserver` and subscribes
it to the injected QueryClient. Creating a disabled store creates the observer
configuration but does not subscribe it.

```text
construct
  │
  ├─ enabled ──► subscribe ──► use cache or fetch
  │
  └─ disabled ─► zero query subscriptions

updateOptions / enable / disable
  └─ synchronize the subscription with current demand

destroy
  └─ remove query and realtime subscriptions permanently
```

This distinction allows an application to create cheap domain-store objects
without fetching every domain immediately.

## Application ownership

The owner should create:

1. one QueryClient for the application runtime;
2. domain stores using that same client;
3. a demand boundary for each optional feature;
4. one cleanup path that destroys every owned store.

In a browser SPA this is usually an application provider. In SSR, create a
runtime per request or use the framework's QueryClient ownership model. Avoid
the process-level global client when it could mix request data.

Constructing a store inside a component render creates unstable observers and
mutation state. Keep store construction outside render or in stable provider
state.

## Demand is not cache freshness

Application demand answers:

> Should this feature observe its query right now?

TanStack freshness answers:

> If observed, is a request necessary?

Keep those decisions separate:

```ts
enabled: () => featureIsMounted && userCanRead;
```

After either value changes:

```ts
store.updateOptions();
```

Activation of fresh cached data does not force a network request. Activation
of stale or missing data does.

Disabling a store:

- removes its query subscription;
- prevents automatic and triggered queries;
- preserves its current MobX projection when the key is unchanged;
- does not delete TanStack cache data.

Destroying a store releases its internal resources but also does not clear the
shared QueryClient cache. Cache retention remains a QueryClient policy.

Destruction does not abort application promises already returned by query or
mutation functions. If transport cancellation matters, the application must
coordinate it. A pending successful mutation may still synchronize its
original existing cache entry, but a destroyed store will not reconcile that
result into its UI projection.

## Dynamic query scopes

Use `queryKey` to identify the complete server dataset:

```ts
let userId: string | null = null;
let organizationId: string | null = null;

const store = createOptimisticStore({
  name: "documents",
  queryKey: () => [
    "documents",
    userId ?? "anonymous",
    organizationId ?? "none",
  ],
  // ...
});
```

When identity changes:

```ts
userId = nextSession?.user.id ?? null;
organizationId = nextOrganizationId;
store.updateOptions();
```

AOS structurally hashes the key. If it changed, AOS clears:

- the current MobX projection;
- deferred query reconciliation;
- optimistic create tracking;
- optimistic update layers;
- active delete tracking.

It then observes the new TanStack cache scope if enabled.

Confirmed cache entries for old scopes remain in QueryClient according to its
garbage-collection settings. This makes returning to a previous user, tenant,
or filter scope behave like normal TanStack Query navigation.

## Credentials versus identity

Request credentials should be read dynamically by the query and mutation
functions:

```ts
let accessToken: string | null = null;

queryKey: () => ["documents", userId ?? "anonymous"],
queryFn: () => fetchDocuments(accessToken),
```

After a token refresh:

```ts
accessToken = refreshedToken;
store.updateOptions();
```

If the user identity did not change, the key remains stable and fresh data can
stay in the same cache. Do not put rotating access tokens in query keys unless
the token itself truly changes the dataset.

## Authoritative cache and optimistic UI

The TanStack cache contains confirmed API entities. AOS does not write
temporary optimistic entities into that cache.

```text
Mutation starts
├─ MobX: apply temporary optimistic work
└─ Query cache: keep last confirmed API data

Mutation succeeds
├─ Query cache: update an existing collection cache, when present
└─ MobX: project confirmed entity plus any later optimistic layers

Mutation fails
├─ Query cache: unchanged
└─ MobX: remove only that operation's optimistic work
```

This split prevents temporary UI-only fields, `Date` objects, and generated
optimistic IDs from leaking into API cache data.

## Query reconciliation

An observed successful query is transformed and reconciled into the MobX map.
Reconciliation:

- inserts new entities;
- updates changed entities;
- removes entities absent from the query result;
- preserves entity references when shallow data is unchanged;
- strips AOS's internal optimistic marker fields.

While any local mutation is pending, incoming query data is deferred. The
latest deferred result is applied after all local mutations settle. This
prevents a background query from erasing an optimistic layer.

## Concurrent creates

Each create receives its own operation sequence and temporary entity.

- A successful create replaces only its own optimistic entity.
- A failed create removes or restores only its own optimistic entity.
- Pending status remains true until every concurrent create settles.

Applications should still generate collision-resistant optimistic IDs.

## Concurrent updates

Updates to an entity are stored as ordered optimistic layers over a confirmed
base:

```text
confirmed base
  + optimistic update 1
  + optimistic update 2
  = visible UI entity
```

If update 2 succeeds before update 1, update 1's later server response cannot
overwrite update 2's newer confirmed result. If a newer update fails, AOS
removes only that layer and renders the latest valid base plus remaining later
layers.

An update applies optimistically only when the target entity already exists in
the MobX projection. The network mutation still runs when it does not.

## Updates and deletes

Deletes are sequenced with updates to the same entity.

- A newer active delete hides older update layers.
- A successful delete removes the entity from cache and UI.
- A failed delete restores the appropriate entity or update projection.
- Older operation results cannot override a newer confirmed operation.

## Mutations crossing query scopes

Every mutation captures the resolved query key when it starts.

Suppose a mutation starts in organization A, then the application switches the
store to organization B before the response arrives:

```text
mutation starts in A
  │
  ├─ store switches to B
  │    └─ B projection is cleared/loaded
  │
  └─ A mutation succeeds
       ├─ update A's existing TanStack cache entry, when present
       └─ do not touch B's MobX projection
```

This protects the visible scope while preserving a valid server result in the
cache scope where the operation originated.

The application should avoid starting new mutations while changing identity or
tenant unless the user experience explicitly supports it.

## Realtime consistency

Default realtime events update the MobX projection immediately and synchronize
the current confirmed query cache when that cache entry already exists.

Realtime operations use arrival order. AOS cannot determine whether a late
event is older without domain metadata. If the server supplies `revision`,
`updatedAt`, or another ordering field, enforce it with `shouldProcessEvent` or
a custom handler.

Custom handlers replace the default event path. They own both UI and cache
coordination if that is required. See [Realtime](./realtime.md).

## Imperative query controls

Use the least forceful operation that matches the intent:

| Intent                                         | Operation            |
| ---------------------------------------------- | -------------------- |
| Demand, session, filter, or key changed        | `updateOptions()`    |
| Mark current cache data stale                  | `api.invalidate()`   |
| User explicitly requested a refresh            | `api.refetch()`      |
| Enabled feature needs a coalesced forced fetch | `api.triggerQuery()` |
| Temporarily stop automatic observation         | `disable()`          |
| Permanently end ownership                      | `destroy()`          |

`refetch()` is imperative and can fetch while ordinary activation is disabled.
Do not use it as a substitute for modeling feature demand.
