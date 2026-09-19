# PostHog server setup

Verified dependency versions in the local contract test:

| Package | Version |
| --- | --- |
| `@openfeature/server-sdk` | `1.23.0` |
| `@openfeature/core` | `1.12.0` |
| `@posthog/openfeature-node-provider` | `0.1.1` |
| `posthog-node` | `5.52.4` |

The tested PostHog packages require Node `^20.20.0 || >=22.22.0`. A Docker image
tag of `node:20` alone does not prove an already-built deployment meets that
patch requirement. Check the actual deployed runtime. The SDK versions declared
by CycleArena have not been substituted into this contract test.

After the flags package is published, install it and server peers in the
evaluating workspace with Yarn. A Next-only application installs these on Next;
Nest delivery installs them on Nest. Do not install Nest in a Next-only project.

```sh
yarn workspace <server-workspace> add @kingstack/flags @openfeature/server-sdk@1.23.0 @openfeature/core@1.12.0 @posthog/openfeature-node-provider@0.1.1 posthog-node@5.52.4
```

Create the client once at application composition, in the enabled branch:

```ts
import { OpenFeature } from "@openfeature/server-sdk";
import { PostHogServerProvider } from "@posthog/openfeature-node-provider";
import { PostHog } from "posthog-node";
import { createFlagEvaluator } from "@kingstack/flags/server";

export async function initializeFlags(config: {
  provider: "none" | "posthog";
  projectKey?: string;
  host?: string;
}) {
  if (config.provider === "none") {
    return { evaluator: createFlagEvaluator({ client: null }), shutdown: () => Promise.resolve() };
  }
  if (!config.projectKey || !config.host) {
    throw new Error("PostHog flags require a project key and regional host");
  }

  // Alternatively inject the application's shared PostHog client here.
  const posthog = new PostHog(config.projectKey, {
    host: config.host,
    featureFlagsRequestTimeoutMs: 1000,
    featureFlagsRequestMaxRetries: 0,
  });
  const domain = "application-flags";
  try {
    await OpenFeature.setProviderAndWait(
      domain,
      new PostHogServerProvider(posthog, { sendFeatureFlagEvents: false }),
    );
    // Application composition owns this runtime and calls shutdown exactly once.
    // Reuse the evaluator across requests; don't register providers in routes.
    return {
      evaluator: createFlagEvaluator({ client: OpenFeature.getClient(domain) }),
      shutdown: () => posthog.shutdown(),
    };
  } catch (error) {
    await posthog.shutdown();
    throw error;
  }
}
```

When the client also handles analytics, create it if **either** subsystem needs
it, gate analytics capture separately, and give it one shutdown owner. Neither
the evaluator nor the official provider closes a borrowed PostHog client. Do
not set the whole client's `disabled` option just to turn off analytics capture
if flags still need it. Next serverless hosts must flush captured events through
their platform lifecycle; Nest typically does this in module shutdown.

Create the matching keys, booleans/variants, targeting rules, and rollout in
PostHog. Code declarations do not create remote flags. `targetingKey` is the
analytics distinct ID; other evaluation context fields map to person properties,
with `groups` and `groupProperties` handled specially by the official provider.
The application derives all trusted properties after authentication.

## Request count and exposure evidence

The contract test uses real SDKs above with mocked HTTP and no live credentials.
A two-flag snapshot issues **two `/flags/` requests**. The provider calls
`getFeatureFlagResult` per flag; remote evaluation is not automatically batched.
With `sendFeatureFlagEvents: false`, no `capture` calls occur. Closing the
OpenFeature domain does not call the borrowed client's `shutdown()`.

This justifies small named snapshot sets, bounded concurrency, and polling off
by default for the initial implementation. It is not a live latency measurement
or an efficiency claim for large catalogs. Before high-volume use, measure real
cost and latency and evaluate PostHog-supported local evaluation or a separately
tested bulk path. Do not add a global personalized-result cache to hide requests.

Pros: uses the official provider unchanged, keeps context invocation-scoped, and
avoids maintaining a second provider abstraction. Cons: request count grows with
the number of visible flags, SDK transport requests cannot be cancelled by the
OpenFeature interface, and experiments still need an explicit exposure path.

References:

- [PostHog OpenFeature installation and options](https://posthog.com/docs/feature-flags/installation/openfeature-js)
- [OpenFeature JavaScript server SDK and client ownership](https://openfeature.dev/docs/reference/sdks/server/javascript/)
- [PostHog experiment exposures](https://posthog.com/docs/experiments/exposures)
