# Automated Hosted Stack Deployment Plan

Status: draft for review

## Purpose

Build one guided command that can take a KingStack checkout from local source to
a working hosted deployment across Supabase, Vercel, and DigitalOcean:

```bash
yarn deploy:stack production
```

The command should feel magical, but its implementation should remain a small
orchestrator over independently usable provider operations. A failure must be
diagnosable, and rerunning the command must continue safely without creating
duplicate projects or hosts.

## Recommended approach

Implement an explicit, ordered deployment workflow for the single paved path we
support today:

- hosted Supabase project;
- Next.js on Vercel;
- one NestJS Droplet on DigitalOcean;
- trusted HTTPS using the Droplet's public IPv4 address; and
- KingStack's ignored `config/<environment>.ts` file as the local source of
  truth.

Do not build a generic workflow engine or provider plugin system. Extract typed
operations from the existing commands, then call them from a small stage
runner.

### Pros

- Reuses provider behavior that has already been exercised manually.
- Keeps every underlying command available for repair and advanced use.
- Supports safe reruns by inspecting real provider state.
- Produces a compelling clone-to-production demonstration.
- Limits the first implementation to one well-understood deployment topology.

### Cons

- Coordinates three independently authenticated providers.
- Cannot provide an atomic rollback across providers or database migrations.
- Must account for provider propagation delays and partially completed runs.
- Initial provisioning can create billable resources before a later stage
  fails.

## Scope

### Version-one goals

1. Guide the user through provider choices and costs.
2. Print one complete, redacted plan before creating billable resources.
3. Create or reuse a Supabase project.
4. Import Supabase credentials into the selected KingStack environment.
5. Create or reuse and link a Vercel project with `apps/next` as its root.
6. Discover and save the stable Vercel production hostname.
7. Configure and verify hosted Supabase Auth.
8. Apply Prisma production migrations exactly once per run.
9. Create or reuse a DigitalOcean Droplet and deploy NestJS over trusted HTTPS.
10. Save the verified Nest hostname to KingStack configuration.
11. Generate service environment files and sync Vercel environment variables.
12. Deploy the final Next.js application to Vercel production.
13. Verify public frontend, backend, and authentication dependencies.
14. Rerun safely after failure without duplicating provider resources.

### Version-one non-goals

- Supporting cloud providers other than Vercel and DigitalOcean.
- Supporting multiple NestJS Droplets or rolling fleets in the orchestrator.
- Purchasing or configuring a custom domain.
- Creating GitHub integrations or modifying repository settings.
- Running unattended in CI.
- Automatically deleting provider resources after failure.
- Providing automatic database migration rollback.
- Supporting every flag exposed by the underlying provider commands.

The existing standalone tools continue to cover advanced deployment shapes.

## User experience

With no flags, the command opens a wizard:

```text
KingStack hosted deployment

Environment: production

Supabase:      create project kingstack
Vercel:       create project kingstack-prod
DigitalOcean: create 1 Droplet in nyc2, s-1vcpu-1gb
Auth:         immediate signup; Site URL from Vercel
Routing:      trusted HTTPS using the Droplet public IP

Estimated recurring provider costs:
  ...provider-reported guidance...

Execute this deployment plan? [y/N]
```

The plan must distinguish resources that will be created from resources that
will be reused. Security-sensitive choices, especially disabling email
confirmation and allowing SSH from any address, remain visible.

Initial command surface:

```text
yarn deploy:stack [environment]

--dry-run    Inspect providers and print the plan without making changes
--yes        Accept the final plan in a non-interactive terminal
--debug      Include redacted command diagnostics and stage timings
--help       Show usage
```

Provider-specific non-interactive flags can be added after the interactive path
is stable. Version one should not expose every existing provider option through
the top-level command.

## Dependency sequence

```text
preflight and provider discovery
              |
              v
ensure Supabase project -> import credentials
              |
              v
ensure Vercel project -> record stable NEXT_HOST
              |
              +----------------------+
              |                      |
              v                      v
configure Supabase Auth       generate service env files
              |                      |
              +-----------+----------+
                          v
                apply Prisma migrations
                          |
                          v
             provision and deploy NestJS
                          |
                          v
                 record verified NEST_HOST
                          |
                          v
              sync final Vercel environment
                          |
                          v
               deploy Next.js to production
                          |
                          v
                 end-to-end verification
```

The preferred path deploys Vercel only once. If Vercel exposes the stable
project `*.vercel.app` domain immediately after project creation, that hostname
is enough to configure Supabase Auth and Nest before the final frontend
deployment. If live testing proves that the production domain is unavailable
until a deployment exists, add a minimal bootstrap deployment as an explicit
fallback stage rather than assuming two deployments are always necessary.

## Resumability and source of truth

Do not add a deployment-state file in version one. It would duplicate provider
state and could become stale.

Instead, determine stage status from:

- `config/<environment>.ts` for selected non-secret identifiers and hosts;
- `.vercel/project.json` for the local Vercel association;
- Supabase Management API and CLI responses;
- Vercel project, domain, environment, and deployment responses;
- DigitalOcean Droplet tags, names, firewalls, and public addresses; and
- public health probes.

Each stage begins with an inspection and has one of these outcomes:

```ts
type StageStatus =
  | { kind: "ready" }
  | { kind: "needs-change"; reason: string }
  | { kind: "blocked"; reason: string };
```

`ready` stages are skipped. `needs-change` stages contribute actions to the
plan. `blocked` stages stop before mutation when possible and print the exact
standalone command needed to repair the condition.

An optional non-secret execution receipt can be reconsidered later if live use
reveals information that cannot be reconstructed. It should not be added in
anticipation of that problem.

## Stage design

### 1. Preflight and discovery

Inspect without changing state:

- parse the root package name and hosted environment definition;
- verify compatible Supabase, Vercel, and DigitalOcean CLIs;
- verify Supabase, Vercel, and `doctl` authentication;
- verify Docker, SSH, and SCP when a Nest image deployment is required;
- load partial environment values without requiring not-yet-provisioned keys;
- query existing projects, Droplets, regions, sizes, SSH keys, and costs; and
- detect conflicting local/provider identifiers.

The preflight produces a fully typed plan. It must not prompt for database
passwords or retrieve secret API keys until after confirmation.

### 2. Ensure Supabase project

Refactor `supabase:provision` into an operation that returns at least:

```ts
interface SupabaseProjectResult {
  projectRef: string;
  name: string;
  region: string;
  created: boolean;
}
```

Reuse an explicitly selected or exactly matching healthy project. Never infer
that two same-named projects are interchangeable. After creation, poll until
the project can return API keys or report a bounded timeout with a rerun
instruction.

### 3. Import Supabase credentials

Refactor `supabase:provision:get-secrets` into a callable operation. Preserve
its current guarantees:

- modern publishable and secret keys only;
- hidden database-password entry;
- verified pooler region;
- surgical updates to `config/<environment>.ts`;
- no secret values in logs, plans, errors, or result objects intended for
  serialization.

Return only non-secret metadata and whether the environment file changed.

### 4. Ensure Vercel project and canonical hostname

Add a Vercel project operation that can:

- list accessible scopes and projects;
- select an exact existing project or create a new one;
- set or verify `rootDirectory: "apps/next"`;
- link the repository root through `.vercel/project.json`;
- retrieve the project and organization IDs; and
- select the stable verified production domain, preferring a custom domain and
  otherwise the project `*.vercel.app` domain.

Prefer Vercel CLI commands and `vercel api` so an existing interactive CLI
login can be reused. Do not require `VERCEL_TOKEN` merely to bootstrap from an
authenticated developer machine. Vercel documents non-interactive linking with
`vercel link --yes --project <name>`, project creation with
`vercel project add`, and project creation/update through its REST API:

- https://vercel.com/docs/cli/link
- https://vercel.com/docs/cli/project
- https://vercel.com/docs/projects/managing-projects

Before implementation, run one focused spike against a disposable or selected
project to answer two questions:

1. Can the stable project domain be read before the first deployment?
2. Which CLI/API sequence sets the root directory without an interactive
   service-detection prompt?

Record the answers in this document before finalizing the adapter.

### 5. Configure hosted Supabase Auth

Call the operation behind `supabase:auth:configure` after `NEXT_HOST` is known.
For the demo path, default to immediate signup while showing the security
tradeoff in the plan. Support opting into required email confirmation.

The stage remains narrowly scoped to:

- `site_url`; and
- `mailer_autoconfirm`.

Read the resulting Auth configuration back and fail if it does not match.

### 6. Generate config and apply migrations

Run KingStack environment generation after the Supabase and Vercel values are
available. Apply `prisma migrate deploy` once, before deploying NestJS.

Do not attempt to roll migrations back. The plan and failure message must state
that migrations are durable and must remain compatible with both old and new
application versions.

### 7. Ensure and deploy NestJS

Reuse the typed DigitalOcean planning, provisioning, firewall, image,
migration-skip, Caddy, and verification operations already present. The
orchestrator's version-one defaults are:

- one Droplet;
- deterministic environment tag and name;
- user-selected live region and size;
- trusted public-IP HTTPS;
- no billable backups unless explicitly selected; and
- no second Prisma migration invocation.

The Nest deploy operation must return its verified public host:

```ts
interface NestDeploymentResult {
  host: string;
  dropletId: number;
  publicIp: string;
  created: boolean;
  deployed: boolean;
}
```

Only write `NEST_HOST` after the trusted HTTPS probe succeeds.

### 8. Sync Vercel configuration

Generate the final service files, then call the existing KingStack-to-Vercel
sync operation. Keep `config/<environment>.ts` authoritative; do not pull
generated runtime variables back from Vercel.

The sync must:

- compare before writing;
- redact values;
- update only the selected environment target; and
- verify that required Vercel identifiers and access are available at this
  stage rather than requiring them in the global schema.

### 9. Deploy Next.js production

Run the Vercel deployment from the monorepo root so Yarn workspace resolution
remains valid. Capture the deployment URL from stdout, wait for completion, and
verify that the stable production domain points at the successful deployment.

Vercel documents that deployment stdout is the deployment URL and supports
production deployment through `vercel deploy --prod`:

- https://vercel.com/docs/cli/deploy

### 10. End-to-end verification

Verification should be cheap, bounded, and visible:

1. GET the stable frontend URL and require an expected success response.
2. GET the public Nest endpoint and require an expected success response.
3. Verify Supabase Auth still reports the requested Site URL and confirmation
   policy.
4. Verify the Vercel project contains the expected public and server runtime
   keys without printing their values.
5. Print an authenticated-flow manual test for the user until a safe automated
   signup test account strategy exists.

Do not create a persistent demo user merely to declare deployment success.

## Code organization

Proposed files:

```text
scripts/deploy/stack.ts
scripts/deploy/stack/
  options.ts
  plan.ts
  runner.ts
  verify.ts
  stack-deployment.test.ts
```

Provider implementations remain in their existing folders. Refactor CLI-only
functions into exported operations without changing the standalone command
behavior:

```text
scripts/deploy/supabase/
scripts/deploy/vercel/
scripts/deploy/nest-digitalocean/
```

Keep the hot orchestration path in plain TypeScript. Provider command execution
should sit behind small injected adapters so tests can use deterministic fakes.
Avoid subprocess output parsing when a JSON CLI or API response is available.

## Safety rules

- Perform read-only discovery before the final confirmation.
- Clearly label every resource creation and recurring cost.
- Require confirmation before billable creation or project-wide Auth changes.
- Never print tokens, database passwords, API keys, generated environment
  files, or Authorization headers.
- Redact subprocess commands containing sensitive arguments.
- Use exact provider IDs after selection; do not rely on names after planning.
- Never delete projects, Droplets, domains, databases, or migrations during
  automatic recovery.
- On failure after creation, report the resource ID, whether it may be billable,
  and the exact resume command.
- Reject conflicting provider IDs instead of silently relinking or overwriting
  configuration.

## Instrumentation

Every run should print named stages and elapsed time:

```text
[3/10] Ensuring Vercel project... ready (1.2s)
[4/10] Configuring Supabase Auth... changed and verified (0.8s)
```

With `--debug`, include redacted commands, provider response status codes,
polling attempts, and selected resource IDs. Default output should remain
compact.

The final summary should include:

- reused and created resources;
- canonical frontend and backend URLs;
- completed and skipped stages;
- total duration;
- any durable side effects such as applied migrations; and
- relevant standalone repair commands.

## Testing strategy

### Unit tests

- option parsing and defaults;
- dependency ordering;
- plan formatting and redaction;
- stage inspection outcomes;
- rerun behavior for ready resources;
- provider JSON parsing;
- partial failure and resume decisions; and
- conflicting-resource rejection.

### Integration-style tests with fakes

Use injected command and fetch adapters to simulate:

- a completely new deployment;
- fully existing healthy infrastructure;
- failure after each mutating stage;
- Supabase and Vercel propagation delays;
- a wrong Vercel root directory;
- an unhealthy Droplet;
- Vercel environment drift; and
- verification failure after a successful provider command.

Assert that secret values never enter captured logs or serialized plans.

### Live smoke test

Run one manually supervised deployment against explicitly selected provider
accounts. Record resource IDs before execution, verify that a second run makes
no duplicate resources, and remove test resources manually after review.

Automated tests must not create live provider resources.

## Delivery phases

### Phase 1: reusable operations

- Extract callable Supabase credential import and Auth configuration.
- Extract callable Vercel config import and sync.
- Normalize existing NestJS result types.
- Preserve all current standalone command behavior and tests.

Exit condition: each provider operation can be invoked without parsing its
human console output.

### Phase 2: read-only planner

- Add top-level options and wizard.
- Inspect all three providers.
- Print actions, costs, security decisions, and blockers.
- Implement `--dry-run` with no provider mutations.

Exit condition: the full intended deployment is reviewable before execution.

### Phase 3: execution and resume

- Execute the ordered stages.
- Reinspect after every mutation.
- Skip stages already in the desired state.
- Produce precise standalone recovery instructions.

Exit condition: injected failure after any stage can be followed by a safe
rerun.

### Phase 4: verification and live smoke test

- Add bounded health checks and final report.
- Perform one supervised new-stack deployment.
- Perform a second no-duplicate rerun.
- Update deployment documentation and generated-project documentation.

Exit condition: frontend, backend, Supabase Auth, and environment wiring are
verified from public endpoints and provider APIs.

## Definition of done

Version one is complete when a user can run:

```bash
yarn deploy:stack production
```

from a configured KingStack checkout and obtain a working hosted demo after one
aggregate plan confirmation plus unavoidable secret entry. Interrupting the
run after any completed stage and rerunning it must not create a duplicate
Supabase project, Vercel project, or DigitalOcean Droplet.

The completed deployment must support:

- immediate registration or explicitly required email confirmation;
- correct hosted Auth redirects;
- browser-to-Nest HTTPS requests;
- successful Prisma schema deployment;
- Vercel runtime configuration sourced from KingStack config; and
- standalone provider commands for diagnosis and repair.

## Open decisions for review

1. Should the public command be `deploy:stack`, `kingstack:deploy`, or
   `deploy:hosted`?
2. Should version one support both `development` and `production`, or expose
   only `production` until the workflow is proven?
3. Should immediate signup remain the orchestrator default, or should the
   wizard always ask?
4. Should unrestricted key-only SSH remain the default, or should production
   require explicit CIDR selection?
5. Does Vercel expose the stable production domain before its first deployment
   in the exact CLI/API flow we choose?
6. Should the orchestrator create Vercel projects through `vercel link`,
   `vercel project add`, or the API through `vercel api`?


