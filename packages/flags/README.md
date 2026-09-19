# @kingstack/flags

Typed feature definitions, OpenFeature server evaluation, and identity-scoped
browser snapshots. Applications own their provider, authentication, analytics,
and transport. Nest is optional.

**Initial release:** runtime recipes and mocked provider tests are available.
Live PostHog verification, template wiring, and the first downstream adoption
remain separate milestones. Version `0.0.0` is reserved for package bootstrap;
use `0.1.0` or later in applications.

## Package boundaries

| Import | Responsibility | Consumer dependencies |
| --- | --- | --- |
| `@kingstack/flags` | Definitions, validation, snapshot types | None |
| `@kingstack/flags/server` | Evaluator and standard HTTP route handler | OpenFeature server SDK and its core peer for enabled evaluation/types |
| `@kingstack/flags/http` | Browser loader with injectable authenticated fetch | None |
| `@kingstack/flags/mobx` | State, identity changes, loading and cleanup | MobX |
| `@kingstack/flags/react` | Context and thin lifecycle/access hooks | React; store uses MobX |
| `@kingstack/flags/testing` | Deterministic snapshots and loaders | None |

Both ESM and CommonJS builds ship. The core requires Node 20+ on the server.
Provider packages have their own engine requirements; see the
[PostHog recipe](./docs/posthog.md). No Next, Nest, Supabase, or provider SDK is
imported by the core/browser entry points. The server borrows an OpenFeature
client; it never sets global context or shuts down the application client.

Framework composition uses the same evaluator directly. There are no `/next` or
`/nest` wrappers in this version: the standard Request/Response handler works as
a Next route, and Nest can inject the evaluator with a normal factory provider.

## Define the application catalog

Keep project flags in `packages/shared/feature-flags`, exporting a separate
browser catalog when some definitions must remain private.

```ts
import { booleanFlag, defineFlags, variantFlag } from "@kingstack/flags";

export const flags = defineFlags({
  newDashboard: booleanFlag({
    key: "new-dashboard",
    description: "Show the new dashboard",
    defaultValue: false,
    clientVisible: true,
  }),
  checkoutLayout: variantFlag({
    key: "checkout-layout",
    description: "Checkout presentation",
    variants: ["control", "compact"],
    defaultValue: "control",
    clientVisible: true,
  }),
});
```

`clientVisible` defaults to false and permits serialization into browser
snapshots. It does not grant permissions or hide code imported into a browser
bundle. Catalogs reject duplicate provider keys and invalid defaults; provider
responses and snapshots are also validated at runtime.

Select bounded named catalogs for individual surfaces, for example
`defineFlags({ checkoutLayout: flags.checkoutLayout })`. Use the same selected
catalog in that endpoint and its store. Missing requested flags become errors
with their declared defaults; unrelated and private keys are discarded.

## Evaluate on either server

```ts
import { createFlagEvaluator } from "@kingstack/flags/server";

// Application setup supplies an initialized OpenFeature client, or null for none.
const evaluator = createFlagEvaluator({ client });
const enabled = await evaluator.evaluate(flags.newDashboard, {
  targetingKey: verifiedUser.id,
});
const snapshot = await evaluator.snapshot(flags, {
  scope: `user:${verifiedUser.id}`,
  context: { targetingKey: verifiedUser.id },
});
```

Pass trusted context per invocation. Never set a user's identity on process-wide
OpenFeature context. `scope` identifies the browser identity **and relevant
targeting revision**, for example `user:123:plan-v2`. Both hosts derive it from
the same application rule. It must contain only browser-safe data and is not an
authentication credential. The server verifies the principal independently.
Scope revision changes invalidate existing assignments; refreshing an access
token alone does not require changing scope.

Defaults: 1,500 ms total snapshot deadline, at most 16 client-visible flags per
snapshot, at most four concurrent evaluations. Customize `timeoutMs`,
`maxSnapshotFlags`, and `concurrency` deliberately. The evaluator bounds waiting;
OpenFeature does not expose transport cancellation, so also set SDK request
timeouts and retry limits. Never evaluate remotely inside a gameplay tick.

`onEvaluation` receives the flag key, status, normalized reason, and duration.
It excludes targeting context, tokens, and provider exception messages. Connect
it to application metrics/logging and throttle repeated error logs there.

## Enable and disable

Use one application configuration selector, `FEATURE_FLAGS_PROVIDER`, with
`none` as the default and `posthog` as the initial hosted choice. This package
does not read environment variables or initialize clients at import time.

| Selection | Server composition | Browser composition |
| --- | --- | --- |
| `none` | `createFlagEvaluator({ client: null })` | Store with `enabled: false` |
| `posthog` | Initialize provider, inject OpenFeature client | `enabled: true`, configured loader |

Derive both sides from the same config input. `none` uses each declared default,
including default-true booleans. It requires no flag I/O, identity, credentials,
or polling. Existing analytics remains independently configurable. Provider
selection with missing credentials should throw at application startup.

This is deployment configuration. It is not an instantaneous kill switch in
open tabs. An active store receiving a `disabled` snapshot clears assignments
and stops further loads. Recreate it when new deployment configuration enables
the system again. Verify any existing browser analytics SDK has its own remote
flag loading disabled if snapshots are the sole source.

## Browser state and lifecycle

```ts
import { FeatureFlagStore } from "@kingstack/flags/mobx";
import { createHttpSnapshotLoader } from "@kingstack/flags/http";

const featureFlags = new FeatureFlagStore({
  catalog: flags,
  enabled: flagsEnabledFromConfig,
  scope: null, // identity not ready yet
  loadSnapshot: createHttpSnapshotLoader({
    url: "/api/feature-flags", // or the direct Nest control-plane URL
    fetch: fetchWithAuth, // adapter resolves the latest access token per call
  }),
});

// RootStore's session propagation owns this, including resetting to null on logout.
featureFlags.setScope(`user:${verifiedSession.user.id}`);

// Host mount and cleanup; constructor and reads are inert.
const release = featureFlags.acquire();
featureFlags.get(flags.checkoutLayout); // "control" | "compact"
release();
// Permanent owner teardown only; don't dispose during React lifecycle replay.
featureFlags.dispose();
```

The store cancels old requests and rejects late results by generation, even if
a loader ignores cancellation. Failed refreshes clear stale success values and
expose `status: "degraded"`. Valid flags survive errors in other flags. Reads
never fetch or record exposure. `getDecision(flag)` also returns decision status.

Use the exported catalogs for comparisons. Types are derived from these named
values, including `DecisionStatuses`, `SnapshotModes`, and `FlagKinds` in the
core entry, `FeatureFlagStoreStatuses` and `SnapshotFailureReasons` in `/mobx`,
and `EvaluationReasons` in `/server`.

```ts
import { DecisionStatuses } from "@kingstack/flags";
import { FeatureFlagStoreStatuses } from "@kingstack/flags/mobx";

if (featureFlags.status === FeatureFlagStoreStatuses.Degraded) {
  // The surface can indicate that fallback values are in use.
}
const decision = featureFlags.getDecision(flags.checkoutLayout);
if (decision.status === DecisionStatuses.Resolved) {
  // The provider supplied a valid assignment.
}
```

No interval polling runs by default. `refresh()` coalesces active requests and
does no work while inactive. Set `refreshIntervalMs` only after measuring traffic
and latency. `timeoutMs` defaults to 5,000 ms for browser loading. Multiple
acquisitions share one lifecycle; final release stops timers and requests after
a microtask so React setup/cleanup/setup replay does not duplicate work.

Provide `initialSnapshot` and its matching `scope` for SSR. A mismatched snapshot
throws during construction. Create stores per application/provider instance,
never as process-global holders of personalized SSR data. An enabled store waits
for identity; a disabled store is ready immediately.

React calls `useFeatureFlagLifecycle(store)` at its runtime boundary, provides
`FeatureFlagContext.Provider`, and reads `useFeatureFlags()` inside MobX
`observer` components. Hooks return the existing store; no mirrored React state
or flag-specific effect logic is needed. See the
[Next and Nest composition guide](./docs/composition.md).

## Frontend drafts and tests

```ts
import { createFixtureLoader } from "@kingstack/flags/testing";

const store = new FeatureFlagStore({
  catalog: flags,
  enabled: true,
  scope: "draft",
  loadSnapshot: createFixtureLoader(flags, { checkoutLayout: "compact" }),
});
```

Fixtures use catalog property names and retain literal variant types. They need
no backend or Supabase and carry `fixture` status instead of production assignment
status. In-memory OpenFeature substitution is also tested on the server.

## Experiments

This version supports named variant selection and suppresses snapshot-generated
exposure in the PostHog setup recipe. It does **not yet provide a complete,
validated experiment integration or an exposure recorder**.

Decision status separates `resolved`, `default`, `error`, and `fixture` values.
`default` can also be a valid provider default: PostHog reports an off boolean
with OpenFeature reason `DEFAULT`. Its false value must be preserved even when
the application's fallback is true. Neither value equality nor a default reason
alone proves experiment enrollment.

Before production experiments, add an explicit feature-use exposure owner using
the actual consumed decision and matching analytics identity, reject default,
error and fixture enrollment, test lifecycle deduplication and identity readiness,
and verify subsequent outcomes in PostHog. Keep ordinary reads and snapshot loads
free of analytics side effects. Provider initialization must set
`sendFeatureFlagEvents: false`; the generic evaluator cannot override another
provider's event policy.

## Validation and release

```sh
yarn workspace @kingstack/flags test
yarn workspace @kingstack/flags typecheck
yarn workspace @kingstack/flags lint
yarn workspace @kingstack/flags test:pack
```

The pack check loads isolated ESM/CommonJS consumers without optional peers,
checks browser import boundaries, then verifies TypeScript consumers with the
required peers. It does not start an application server or publish anything.

Before npm release: run checks on supported deployment Node versions, verify
PostHog assignments/failure behavior and measured latency against the target
project, review the release version, and follow the repository release process.
Wire the generator/config/example catalog to an **available published version**.
Then prepare CycleArena and install the release, following its KingStack review
document. The library alone does not migrate an existing application's runtime.
