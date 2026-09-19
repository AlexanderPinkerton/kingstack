# Compose Next or Nest with the same library

These are integration recipes, not changes already applied to the KingStack
template or CycleArena. Application-specific imports represent the host's
existing authentication, catalog, configuration, and analytics composition.

## Next-only snapshot host

Create the evaluator once in a server-only application module. Initialize the
provider as described in [PostHog setup](./posthog.md); default to `client: null`
when the provider selector is `none`. `flags` below is the bounded client catalog.

```ts
// app/api/feature-flags/route.ts
import { createSnapshotHandler } from "@kingstack/flags/server";
import { flags } from "@/feature-flags/catalog";
import { evaluator } from "@/feature-flags/server";
import { authenticateBearerRequest } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";
export const GET = createSnapshotHandler({
  catalog: flags,
  evaluator,
  resolveContext: async request => {
    // Adapt to the host verifier's return type and intended access policy.
    const auth = await authenticateBearerRequest(request);
    if (!auth) return null;
    return {
      scope: `user:${auth.userId}`,
      context: { targetingKey: auth.userId },
    };
  },
});
```

The standard handler returns private/no-store responses, rejects non-GET
requests, and returns 401 for a null context. Verifier exceptions propagate to
the host's error handling; they never become provider fallbacks. Authentication
comes before evaluation even if the provider is disabled. Public snapshots need
an explicitly public context resolver and stable visitor identity policy.

In an actual application, use its canonical identity resolver rather than
assuming JWT subject is always the analytics distinct ID. Include relevant
targeting revisions in scope and use the same scope calculation in the browser.

## Optional Nest snapshot host

Register the existing evaluator as a factory/value provider; use the same
catalog and invocation context as Next. No wrapper around Nest DI is needed.

```ts
// FeatureFlagsController.ts
import { Controller, Get, Header, Inject, Req, UseGuards } from "@nestjs/common";
import type { FlagEvaluator } from "@kingstack/flags/server";
import { SNAPSHOT_CACHE_CONTROL } from "@kingstack/flags/server";
import { flags } from "./catalog";
import { VerifiedSessionGuard, type VerifiedRequest } from "../auth/verified-session";

export const FLAG_EVALUATOR = Symbol("FLAG_EVALUATOR");

@Controller("feature-flags")
@UseGuards(VerifiedSessionGuard)
export class FeatureFlagsController {
  constructor(@Inject(FLAG_EVALUATOR) private readonly evaluator: FlagEvaluator) {}

  @Get()
  @Header("Cache-Control", SNAPSHOT_CACHE_CONTROL)
  @Header("Vary", "Authorization")
  snapshot(@Req() request: VerifiedRequest) {
    return this.evaluator.snapshot(flags, {
      scope: request.flagIdentity.scope,
      context: { targetingKey: request.flagIdentity.distinctId },
    });
  }
}
```

The host module registers `{ provide: FLAG_EVALUATOR, useValue: evaluator }` or
an async factory that waits for initialization. Mount it in the control-plane
role when that is the snapshot host. The application's PostHog client owner
handles shutdown once; the evaluator has no shutdown side effects. Backend
services can inject the same evaluator and call `evaluate` independently of
browser decisions. Keep authorization checks at the service boundary.

For direct Nest delivery, set the browser loader URL to
`${NEXT_PUBLIC_NEST_BACKEND_URL}/feature-flags` and configure the backend's CORS
policy for the frontend origin and Authorization header. There is no Next proxy.
Next-only delivery uses `/api/feature-flags` with the identical store contract.

## Browser runtime

The host RootStore constructs the flag store inertly and propagates verified
session changes. An application adapter supplies authenticated fetch and derives
flags enablement from the same selector as the server. Read the latest token
inside the fetch adapter, and preserve its incoming abort signal/cache options.

```ts
// RootStore composition (abbreviated)
this.featureFlags = new FeatureFlagStore({
  catalog: flags,
  enabled: config.flagsEnabled,
  loadSnapshot: createHttpSnapshotLoader({
    url: config.snapshotUrl,
    fetch: authenticatedFetch,
  }),
});

// Session propagation, outside React's rendering path:
if (session) {
  this.featureFlags.setScope(`user:${session.user.id}`);
} else {
  this.featureFlags.setScope(null);
}
// Permanent RootStore disposal:
this.featureFlags.dispose();
```

The provider owns one stable RootStore instance. Choose one activation owner:
either its existing mount/release lifecycle acquires the flag store, or use the
thin hook at the application runtime boundary:

```tsx
"use client";
import { useState, type ReactNode } from "react";
import { FeatureFlagContext, useFeatureFlagLifecycle, useFeatureFlags } from "@kingstack/flags/react";
import { observer } from "mobx-react-lite";
import { RootStore } from "./RootStore";

export function AppProviders({ children }: { children: ReactNode }) {
  const [root] = useState(() => new RootStore());
  // The host also mounts its existing session/runtime lifecycle here.
  const flags = useFeatureFlagLifecycle(root.featureFlags);
  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
}

export const Dashboard = observer(function Dashboard() {
  const featureFlags = useFeatureFlags();
  if (featureFlags.get(flags.newDashboard)) return <NewDashboard />;
  return <CurrentDashboard />;
});
```

`flags`, `NewDashboard`, and `CurrentDashboard` are the project's catalog and
components. React manages the lifecycle bridge and rendering; TypeScript owns
identity, flags, refresh policy, and analytics readiness. Avoid disposing the
store during React's temporary effect cleanup; release is replay-safe.

For authenticated SSR, resolve identity through an explicit verified integration,
evaluate a snapshot, and construct a per-provider store with that snapshot and
matching scope. Browser-only anonymous identity is insufficient for personalized
SSR until the application establishes a server-readable identity mechanism.

## Existing application adoption

1. Install the released package and only the peers required in each workspace.
2. Add a shared typed catalog with defaults that preserve current behavior.
3. Add one provider selector, server credentials, and derived public enablement
   to the application's config schema/output mappings; regenerate env files.
4. Compose the server provider with explicit client ownership and identity rules.
5. Expose one bounded snapshot endpoint on either Next or Nest.
6. Construct the MobX store, forward identity/targeting changes, and mount/release
   it at the host lifecycle boundary. Use fixtures for local playgrounds.
7. Integrate one presentation flag; test account changes, failure, disabled mode,
   and direct delivery before enabling rollout. No schema migration is inherent.

Pros: endpoint location and provider setup can change without rewriting feature
checks; projects can adopt one surface at a time. Cons: authentication, analytics
identity, CORS, deployment configuration, and optional experiment exposure remain
application integration work. Validate these in the actual adopter after release.
