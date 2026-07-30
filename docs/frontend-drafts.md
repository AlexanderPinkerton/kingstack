# Frontend drafts without Supabase

KingStack can run frontend design experiments without starting Supabase, Nest,
or Postgres while preserving the production state-management pattern.

```bash
yarn dev:frontend
```

Open [http://localhost:6666](http://localhost:6666) to choose between the
backend-free and full-stack paths. The draft index is `/drafts`, and the
advanced posts example is available at `/drafts/posts`.

## Architecture

The domain store depends on a repository contract, not a particular backend:

```text
AdvancedPostsExample
        |
AdvancedPostStore + optimistic transformer
        |
PostRepository
   |              |
HTTP adapter      In-memory adapter
Nest production   Frontend draft
```

Both adapters are asynchronous and return the same API data shape. As a result,
drafts exercise the real MobX view model, TanStack Query lifecycle, data
transformer, optimistic create/update/delete behavior, and rollback machinery.
They do not maintain a separate mock-store implementation.

Backend-dependent pages live under the `(runtime)` route group and receive
`AppProviders`, which initializes the Supabase-backed root runtime. Draft routes
sit outside that group, so rendering a draft does not instantiate a Supabase
client.

## Adding a draft-backed feature

1. Define the domain repository contract and API data shape.
2. Put HTTP or Supabase access in a production repository adapter.
3. Add an in-memory adapter that implements the same contract.
4. Inject the repository into the domain store.
5. Keep reusable UI dependent on the domain store rather than `RootStore`.
6. Compose the in-memory repository, real store, and shared UI under `/drafts`.

Keep fixtures next to their draft route. In-memory data should reset on reload;
if a prototype needs persistence across reloads, add a local-storage or
IndexedDB repository adapter without changing the store or UI.

## Moving a draft to the real backend

First enable the generated project's local backend:

```bash
yarn backend:enable
yarn dev
```

The guided command uses the port block reserved during draft creation, starts
Supabase, prepares Prisma's shadow database, and applies migrations. Draft
fixture data remains in memory and is not copied into the database.

The store and UI do not change. Compose the store with the HTTP repository and
provide its authenticated runtime context:

```ts
const store = new AdvancedPostStore(
  queryClient,
  createHttpPostRepository(),
  {
    scope: session.user.id,
    enabled: true,
    accessToken: session.access_token,
    currentUser: session.user,
  },
);
```

This adapter boundary is intentionally explicit. Data-source selection happens
at composition boundaries rather than through conditional behavior spread
throughout the application.
