# Package Status: @kingstack/advanced-optimistic-store

## Current state

The package is an internal, private ESM workspace package used by the Next
application. Its public API is `createOptimisticStore`, `ObservableUIData`,
explicit data transformers, query-client access, and normalized remote changes.

## Implemented

- MobX entity projection with O(1) ID lookup
- TanStack Query fetching, cache synchronization, and invalidation
- Configurable query keys for user, tenant, and filter isolation
- Zero QueryObserver subscriptions while a store is disabled
- Fresh-cache reuse when a store becomes active
- Optimistic create, update, and delete
- Mutation-specific rollback without a shared global snapshot
- Deterministic handling of overlapping and out-of-order local mutations
- Query-scope isolation for mutations that settle after an identity change
- Pending-operation counters
- Explicit API-to-UI transformers
- Transport-independent `applyRemote()` reconciliation
- Query-scope and collection-membership handling for remote changes
- Local optimistic layers preserved over incoming confirmed remote bases
- Optional self-origin and application conflict filtering
- Native Node ESM output and TypeScript declarations

## Verification

```bash
yarn workspace @kingstack/advanced-optimistic-store typecheck
yarn workspace @kingstack/advanced-optimistic-store lint
yarn workspace @kingstack/advanced-optimistic-store test
yarn workspace @kingstack/advanced-optimistic-store build
```

The regression suite includes overlapping creates, out-of-order updates,
rollback after a newer failure, query-cache synchronization, and direct
remote/local conflict cases. It also verifies inactive observer counts,
fresh-cache activation, and mutation completion across query-scope changes.

The package README is the canonical entry point. Focused references live in
`docs/`; superseded marketing and example documents have been removed rather
than retained as competing documentation.

## Deliberate boundaries

- Mutation endpoints must return the complete authoritative entity.
- AOS does not own transports or decode wire events. Domain stores normalize
  them into `RemoteChange` values.
- Remote changes use arrival order by default. Applications that need revision,
  vector-clock, or CRDT conflict handling should implement it with
  `remote.shouldApply`.
- `createDefaultTransformer` remains available as an explicit legacy heuristic.
  Omitting `transformer` now means API and UI data have the same runtime shape.

## Before external publication

- Replace compatibility `any` defaults with a versioned strict-input API.
- Add a changelog and release automation.
- Decide whether to publish a separate CommonJS build; the current package is
  intentionally ESM-only.
