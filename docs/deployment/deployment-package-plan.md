# KingStack Deployment Package Plan

Status: approved for implementation

## Decision summary

Move KingStack's reusable hosted-deployment implementation into one versioned
public package:

```text
@kingstack/deploy
```

The package will expose one compiled CLI, executed by Bun:

```text
king-deploy
```

Generated projects will depend on an explicit package version and keep their
current Yarn script names as compatibility aliases. A package update will never
run automatically and will never trigger a deployment by itself.

Keep project-specific deployment artifacts in generated projects. The package
will operate on those artifacts through a small, validated KingStack project
contract; it will not overwrite them during an ordinary package upgrade.

This is a KingStack-specific deployment package, not a generic cloud deployment
framework and not a provider plugin system.

## Why package the deployment logic

Generated projects currently receive `scripts/deploy` as copied source. The
copy includes approximately:

| Area | Source lines | Test lines | Current responsibilities |
| --- | ---: | ---: | --- |
| NestJS on DigitalOcean | 2,895 | 485 | Droplets, firewall, Docker rollout, Caddy, migrations, verification, rollback |
| Hosted Supabase | 1,896 | 552 | Project provisioning, credential import, hosted Auth configuration |
| Vercel configuration | 573 | 157 | Linked-project metadata and canonical hostname import |
| Shared environment writer | 199 | 0 | Surgical `config/<environment>.ts` updates |
| Total | 5,563 | 1,194 | Copied into each generated project |

Those copies are correct when a project is created but receive no later safety
fixes or provider compatibility updates. A package gives generated projects a
normal, inspectable upgrade path while keeping deployments reproducible through
the project's manifest and lockfile.

### Pros

- One tested deployment implementation becomes authoritative.
- Existing projects can receive bug fixes without regenerating or manually
  copying scripts.
- Generated repositories lose roughly 6,700 lines of implementation and test
  code that they do not own.
- The current Changesets and npm release pipeline can publish the package.
- Provider operations gain a clear home for the future unified stack
  orchestrator.
- Package versions and changelogs make deployment behavior auditable.

### Cons

- Deployment releases require strict compatibility and review discipline
  because the code is privileged.
- An npm dependency cannot automatically update project-owned Dockerfiles,
  GitHub Actions workflows, schemas, or migrations.
- Provider CLI and API changes still require compatibility testing.
- Package and template evolution can diverge unless the project contract is
  explicit and validated.
- Existing projects must deliberately opt into each upgrade.

## Goals

1. Ship the existing deployment behavior from a versioned npm package.
2. Preserve the current commands and safety defaults during extraction.
3. Let generated projects upgrade deployment tooling with a normal dependency
   change.
4. Separate provider operations from terminal prompting and process exit
   behavior.
5. Keep provider operations independently usable for diagnosis and repair.
6. Make those operations callable by a future `king-deploy stack` command.
7. Remove deployment implementation and its unit tests from generated project
   source.
8. Validate compatibility before any cloud, database, host, or configuration
   mutation.

## Non-goals

- Supporting arbitrary repository layouts in version one.
- Supporting cloud providers beyond the providers already implemented.
- Designing a general provider plugin API.
- Automatically updating or rewriting project-owned deployment artifacts.
- Automatically installing a newer deployment package at execution time.
- Moving local Supabase development utilities into this package.
- Implementing the unified full-stack orchestrator as part of the extraction.
- Changing existing deployment semantics merely because code is moving.

## Current deployment surface

### Hosted deployment commands to move

| Existing Yarn command | Current entrypoint | Package command |
| --- | --- | --- |
| `yarn deploy:nest` | `scripts/deploy/nest-digitalocean.ts` | `king-deploy nest` |
| `yarn supabase:provision` | `scripts/deploy/supabase.ts` | `king-deploy supabase provision` |
| `yarn supabase:provision:get-secrets` | `scripts/deploy/supabase/get-secrets.ts` | `king-deploy supabase pull` |
| `yarn supabase:auth:configure` | `scripts/deploy/supabase/configure-auth.ts` | `king-deploy supabase auth` |
| `yarn vercel:config:pull` | `scripts/deploy/vercel/get-config.ts` | `king-deploy vercel pull` |

The existing Yarn commands remain in root `package.json` and delegate to the
package binary. Users do not need to relearn the current workflow.

### Existing packaged functionality to reuse

`@kingstack/config` already owns:

- schema definition and resolution;
- environment generation and validation;
- GitHub and Vercel secret synchronization; and
- environment discovery used by its CLI.

The deployment package will depend on `@kingstack/config`. Configuration logic
must not be copied into a second public package.

### Project-owned artifacts that stay in the template

- `config/schema.ts`
- `config/<environment>.ts`
- `apps/nest/Dockerfile`
- `apps/next/vercel.json`
- `.github/workflows/*.yml`
- `packages/prisma/schema.prisma` and migrations
- `supabase/config.toml`
- root package scripts and workspace manifests
- provider-specific project links such as `.vercel/project.json`

These files describe an individual application or repository. Updating a
library dependency must not silently replace them.

### Deployment-adjacent tools that stay out of the package

- `scripts/enable-backend.ts`
- `scripts/project-mode.ts`
- `scripts/setup-shadow-db.ts`
- `scripts/supabase-check-config.ts`
- `scripts/supabase-list-instances.ts`
- `scripts/supabase-status.ts`

These support local development and template lifecycle rather than hosted
deployment. They can be evaluated separately if their own update problem
becomes material.

## Proposed command surface

```text
king-deploy --help
king-deploy --version

king-deploy nest
king-deploy nest provision <environment> [options]
king-deploy nest deploy <environment> [options]

king-deploy supabase provision [project-name] [options]
king-deploy supabase pull [environment] [options]
king-deploy supabase auth [environment] [options]

king-deploy vercel pull [environment] [options]
```

Future, after the separate orchestrator plan is implemented:

```text
king-deploy stack <environment> [options]
```

Generated projects retain compatibility aliases:

```json
{
  "scripts": {
    "deploy:nest": "king-deploy nest",
    "supabase:provision": "king-deploy supabase provision",
    "supabase:provision:get-secrets": "king-deploy supabase pull",
    "supabase:auth:configure": "king-deploy supabase auth",
    "vercel:config:pull": "king-deploy vercel pull"
  }
}
```

## Package organization

Start with the smallest structure that reflects the current domains:

```text
packages/deploy/
  package.json
  README.md
  CHANGELOG.md
  LICENSE
  tsconfig.json
  tsconfig.build.json
  src/
    cli.ts
    project.ts
    common/
      command.ts
      prompt.ts
    nest/
      cli.ts
      digitalocean/
    supabase/
      cli.ts
    vercel/
      cli.ts
```

Do not split providers into separate npm packages. They share the KingStack
project contract, configuration model, command execution, prompts, redaction,
and release cadence.

Provider folders may export typed operations internally. Version one does not
promise public package imports such as `@kingstack/deploy/supabase`; only the
`king-deploy` command surface is stable for external consumers. The future
stack orchestrator can call the typed operations from inside the same package
without prematurely freezing their function signatures.

## KingStack project contract

Every mutating command begins by resolving a project root from `--cwd` or the
current working directory and validating only what that command requires.

The standard version-one layout is:

```text
package.json
config/schema.ts
config/<environment>.ts
apps/nest/Dockerfile
packages/prisma/package.json
```

The project adapter returns an explicit project context containing the resolved
root. Every project path and subprocess working directory must derive from that
context; operations must not fall back to `process.cwd()` after resolution or
change the process-wide working directory with `process.chdir()`.

The project adapter is responsible for:

- loading the root package name;
- loading the user schema and selected values through `@kingstack/config`;
- listing hosted environments;
- resolving required service mappings such as `nest` and `prisma` envfiles;
- resolving the Nest port and configured backend URL;
- resolving the Prisma workspace;
- checking required project paths; and
- producing actionable compatibility errors before mutation.

Tests must invoke commands from outside a fixture project and use `--cwd` to
prove that configuration access, provider links, Docker builds, migrations, and
other project commands all use the resolved root.

Do not add a new deployment manifest in version one. The standard KingStack
layout and configuration schema already contain the required information. Add
an explicit manifest only after a real supported layout cannot be represented
without one.

Breaking the required project contract requires a package major version or a
compatibility bridge. Older projects should fail during preflight with exact
missing paths or schema requirements, never halfway through a deployment.

## Configuration ownership

Before extracting provider code, promote the reusable project I/O currently
split between `@kingstack/config` internals and
`scripts/deploy/environment-file.ts` into a supported `@kingstack/config` API.

The supported API should cover:

- loading a user schema from a supplied project root;
- loading one environment's value file;
- listing declared environments;
- resolving and validating an environment; and
- surgically updating selected values in an ignored environment file while
  preserving unrelated values.

`@kingstack/deploy` consumes those APIs. `@kingstack/config` must not depend on
the deployment package.

The environment writer must retain its current guarantees:

- validate environment names;
- refuse to write credential-bearing files that are not ignored by Git;
- update only explicitly supplied keys;
- preserve unrelated Supabase, Vercel, and application values; and
- emit valid typed KingStack value files when a file must be created.

## Operation and CLI separation

Each provider action should have three narrow layers:

1. **Options:** parse and validate command-line input.
2. **Operation:** inspect provider/project state and perform the requested
   action through explicit dependencies.
3. **CLI:** prompt, print the redacted plan, confirm, invoke the operation, and
   set the process exit code.

Do not introduce a general dependency injection framework. Pass a small command
runner or fetch function only where tests need to prevent real provider access.

Operation results should contain typed non-secret facts needed by callers. They
must not require another command to parse human console output. Examples:

```ts
interface SupabaseProjectResult {
  projectRef: string;
  name: string;
  region: string;
  created: boolean;
}

interface VercelConfigResult {
  projectId: string;
  organizationId: string;
  host: string;
  configChanged: boolean;
}

interface NestDeploymentResult {
  host?: string;
  targetIds: number[];
  deployed: boolean;
  hostReconfigured: boolean;
}
```

Secret keys, passwords, tokens, rendered environment files, and authorization
headers must never appear in serializable result objects.

## Runtime and dependencies

### Runtime

- Build the package to ESM JavaScript.
- Use `#!/usr/bin/env bun` for the published binary.
- Declare a supported Bun version or range before release and test the package
  against it.
- Do not require consumers to execute TypeScript source from `node_modules`.
- Load project-owned `config/schema.ts` and `config/<environment>.ts` through
  Bun from the resolved project root.
- Continue invoking project commands through Yarn.

Yarn remains the package manager and project-command entrypoint. Bun is the
runtime for the compiled deployment CLI, matching the existing deployment
scripts and avoiding a second TypeScript-loading contract for project-owned
configuration.

### npm dependencies

Expected direct runtime dependencies include:

- `@kingstack/config`
- the keyring implementation used for Supabase CLI credentials

Keep the keyring as a normal runtime dependency during the initial extraction,
but load it lazily only when the Supabase credential path needs keychain access.
Help, Nest, Vercel, and unrelated Supabase commands must not initialize the
native keyring integration. Evaluate making it optional as a separate
compatibility improvement.

The TypeScript compiler dependency needed by safe environment editing should be
owned by whichever package exposes that editor, rather than being assumed from
the consuming project.

### Provider tools

Keep these outside the npm package bundle and validate them during preflight:

- `doctl`
- Docker and Docker Buildx
- SSH and SCP
- `gzip`
- Git
- Bash

Preflight should probe required commands directly instead of introducing a
separate dependency on `which` merely to find them.

Keep compatible Supabase and Vercel CLI versions in generated project
development dependencies. The deployment package should state and validate its
supported ranges instead of downloading provider CLIs while running.

## Versioning and upgrades

Deployment tooling is privileged code. Upgrades must be deliberate and
reviewable.

For the initial package:

- publish through the existing Changesets workflow;
- include a changelog entry for every behavior change;
- pin the initial generated-project dependency to an explicit version while
  the package is `0.x`;
- commit the resolved version in the project lockfile;
- print the package version in `--help`, `--version`, plans, and failures;
- never self-update; and
- never execute code from an unpinned `latest` download.

An existing project's upgrade workflow is:

```bash
yarn add --dev --exact @kingstack/deploy@<version>
git diff
yarn test
yarn deploy:nest deploy production --dry-run
```

The dry run does not prove that an upgrade is risk-free, but it exposes changed
planning, compatibility, target selection, and provider assumptions before
execution. Package upgrade PRs should summarize deployment behavior changes,
not only dependency metadata.

After a stable `1.0.0` contract exists, a compatible semver range can be
reconsidered. The lockfile remains authoritative in all cases.

`create-kingstack` currently embeds published-package versions when projecting
a generated repository. Every `@kingstack/deploy` release intended to become
the default for new projects must update that exact version, test the generated
manifest, and publish a coordinated `create-kingstack` release. A deployment
package release may deliberately remain available only for manual adoption,
but that choice must be explicit in its release notes.

## Safety invariants

Packaging must preserve these existing rules:

- Discovery and compatibility checks precede mutation.
- Billable resource creation requires an explicit reviewed plan.
- Destructive resource deletion is never part of automatic recovery.
- Routine Nest releases preserve firewall, SSH, Caddy, port binding, and local
  configuration unless host reconfiguration is explicit.
- Database migrations are durable and are never described as rolled back.
- Secrets are redacted from plans, commands, errors, and test snapshots.
- Provider IDs selected during planning are reused during execution.
- Configuration writes are scoped and verified.
- Partial failure reports completed durable side effects and exact repair or
  resume commands.
- Tests never create live provider resources.

A package upgrade alone must not contact a provider, modify a project file, or
deploy anything.

## Migration phases

### Phase 1: stabilize shared configuration I/O

Work:

- Add supported schema/value loading APIs to `@kingstack/config`.
- Move or reimplement the safe environment-value updater there.
- Add focused tests for ignored-file enforcement and surgical updates.
- Replace direct static imports of this repository's `config/schema.ts` in the
  deployment code with root-relative runtime loading.

Exit condition:

All existing deployment commands use the same public configuration-loading and
environment-update APIs without behavior changes.

### Phase 2: create and dogfood `@kingstack/deploy`

Work:

- Create the public workspace package and compiled Bun-powered `king-deploy`
  binary.
- Add the project adapter and shared command/prompt utilities.
- Move Vercel configuration pull first as a complete vertical slice.
- Build and pack that slice, install it into a temporary generated project with
  Yarn, and run its help, version, and compatibility checks through Bun before
  moving the larger providers.
- Move the remaining provider code and Bun tests into the package without
  changing command behavior.
- Make the repository's existing Yarn script aliases invoke the workspace
  package binary.
- Keep provider-specific operations independently callable inside the package.

Suggested extraction order:

1. Vercel configuration pull and the first packed-package smoke test.
2. Supabase provision, credential pull, and Auth configuration.
3. NestJS DigitalOcean provision and deployment.

Exit condition:

The KingStack repository uses the workspace package for every existing hosted
deployment command, the Vercel vertical slice has already passed outside the
workspace boundary, and all migrated Bun tests pass.

### Phase 3: strengthen package-boundary tests

Work:

- Add CLI parsing and help tests for the unified command tree.
- Add project-contract fixtures for compatible and incompatible generated
  projects.
- Add `--cwd` fixtures that execute from outside the project root.
- Inject command/fetch boundaries into mutating provider operations.
- Assert that routine Nest deploys cannot call firewall or Caddy mutation
  operations.
- Assert that secrets never enter captured logs or operation results.
- Extend the Phase 2 packed-package test to cover every provider command's
  local `--help`, `--version`, and compatibility checks.

Exit condition:

Tests exercise the built package rather than succeeding only through monorepo
TypeScript path aliases. No test contacts a live provider.

### Phase 4: switch the generated-project boundary

Work:

- Add `@kingstack/deploy` to the root workspace `devDependencies` and
  `create-kingstack` published-package version map.
- Update generated root script aliases to call `king-deploy`.
- Remove `scripts/deploy` from the template allowlist.
- Update generated-boundary tests to require the dependency and reject copied
  deployment source.
- Retain project-owned deployment artifacts and documentation.
- Update the Nest Dockerfile projection only if removing a workspace package
  changes its copied manifests.

Exit condition:

A locally generated project installs successfully, contains no copied
`scripts/deploy` implementation, and all compatibility aliases reach the
packed deployment CLI.

### Phase 5: release and adoption

Work:

- Add a Changeset and publish the initial package.
- Generate a fresh project using the released package rather than a workspace
  or local tarball.
- Run the package test suite and generated-project boundary suite.
- Review a Nest dry run and provider configuration pull from a real KingStack
  project without performing live mutations.
- Document the explicit update process for older generated projects.
- Perform any live deployment smoke test only under manual supervision with
  explicitly selected resources.

Exit condition:

New generated projects consume the released package, and one existing project
can upgrade to it without copied deployment source or command-name changes.

## Deferred follow-on: unified stack orchestration

This work belongs to [the stack deployment plan](./stack-deploy-plan.md), not
to the initial package extraction or its definition of done. After phases 1–5
are complete and provider operations return typed results, add the small ordered
`king-deploy stack <environment>` orchestrator inside `@kingstack/deploy`.

The orchestrator must own the migration stage once per run and pass migration
skip intent to Nest deployment. Today both Nest deployment and the Vercel
GitHub workflows may apply Prisma migrations independently; standalone paths
can remain idempotent, but one orchestrated run must not invoke the same stage
twice.

## Testing strategy

### Unit tests

- Bun-based CLI and operation tests;
- option parsing and command routing;
- project-root and environment discovery;
- provider JSON parsing;
- plan formatting and redaction;
- generated cloud-init, Caddy, and remote rollout scripts;
- safe environment-file updates;
- compatibility errors; and
- result-object secret exclusion.

### Integration-style tests with fakes

- successful and failed provider commands;
- cancelled confirmations;
- dry runs with no mutating calls;
- existing and missing resources;
- partial multi-host Nest rollout and rollback;
- application-only versus host-reconfiguration call boundaries;
- environment updates after provider verification; and
- provider propagation delays where currently supported.

### Package smoke tests

- build the ESM package and declarations;
- inspect the packed file list;
- install the tarball into a temporary generated project using Yarn;
- run `king-deploy --help` and `--version` through Bun from that project;
- load fixture KingStack schemas and values through the built package;
- verify no source-tree-relative imports remain;
- invoke `--cwd` from outside the fixture root; and
- run under the declared supported Bun version or range.

### Live tests

Live provider tests are manual, supervised release checks. Record selected
resource IDs before execution, use dry run first, and never create or delete
resources from the automated test suite.

## Documentation changes

The package README becomes authoritative for command and option reference.
Generated project documentation retains:

- the normal deployment workflow;
- prerequisites and provider account setup;
- project-owned artifact guidance;
- current compatibility aliases; and
- links to the installed package's documentation and changelog.

When behavior changes, update package documentation in the same pull request
and include a Changeset. Only update the template documentation when the
generated-project workflow or project contract changes.

Keep this plan separate from
[the stack deployment plan](./stack-deploy-plan.md):

- this document owns code distribution, package boundaries, compatibility, and
  upgrades;
- the stack plan owns provider sequencing, resumability, and end-to-end hosted
  deployment.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A package release breaks older templates | Validate the project contract before mutation; use major versions or compatibility bridges for contract changes |
| Users unknowingly execute new deployment behavior | Pin versions during `0.x`, commit lockfiles, publish changelogs, never self-update |
| Package tests pass only inside the monorepo | Install and execute the packed tarball in a temporary generated project |
| Secrets leak through reusable operation results | Return non-secret metadata only and assert redaction in tests |
| Provider CLI versions drift | Declare supported ranges, retain generated-project pins, and fail preflight with installed/found versions |
| Project-root resolution differs across commands | Pass one explicit project context to every path and subprocess; test `--cwd` from outside the project |
| Bun runtime behavior drifts | Declare and test a supported Bun version or range against the packed package |
| New projects receive an older deploy package | Coordinate the exact generated dependency and `create-kingstack` release when changing the default |
| Static workflows or Dockerfiles become stale | Keep them project-owned and update through explicit template/dependency PRs; do not overwrite them from package install hooks |
| Extraction changes behavior accidentally | Migrate one provider at a time while retaining existing tests and command aliases |
| Migrations run twice in an orchestrated deployment | Give the future stack runner sole migration ownership and invoke Nest with migrations skipped |

## Rollback strategy

Package adoption must be recoverable without changing cloud state:

- Before the first public release, the repository dogfoods the workspace
  package while Git history retains the previous scripts.
- Generated projects pin the installed package version.
- If an upgrade is faulty, revert the dependency and lockfile to the last known
  version; do not attempt to reverse provider state automatically.
- Release notes must identify durable changes such as migrations or provider
  configuration updates that package downgrade cannot undo.

## Definition of done

The extraction is complete when:

1. `@kingstack/deploy` is built and published through the existing release
   pipeline.
2. All current hosted deployment commands run through `king-deploy`.
3. Current command names and safety defaults remain compatible.
4. Generated projects contain the package dependency but no copied
   `scripts/deploy` source or tests.
5. The built-package smoke test passes in a generated project.
6. Configuration loading and updates use supported `@kingstack/config` APIs.
7. Provider operations can be called internally without parsing console text.
8. No automated test contacts or mutates a live provider.
9. Upgrade and downgrade instructions are documented.
10. The unified stack orchestrator can be implemented inside the package
    without moving provider code again.

## Decisions

1. Pin the exact `0.x` version.
2. Keep keyring behavior and dependency status unchanged during extraction,
   but load it lazily inside the Supabase keychain path; evaluate optional
   installation separately.
3. Keep the CLI as the only documented stable interface.
4. Defer `doctor`; scoped preflight is sufficient until repeated support issues
   show a need.
5. Keep all current aliases and add no new generic alias until
   `king-deploy stack` exists.

These choices minimize simultaneous behavior and distribution changes while
still solving the copied-script upgrade problem.
